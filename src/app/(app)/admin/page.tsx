import { Search } from "lucide-react";
import type { Metadata } from "next";
import type { ReactElement } from "react";
import { Badge } from "@/components/ui/badge";
import { getDatabase } from "@/db/client";
import { AdminTabs } from "@/features/admin/components/admin-tabs";
import { PlanOriginNote } from "@/features/admin/components/plan-origin-note";
import {
  CollectionCard,
  StatCard,
} from "@/features/admin/components/stat-cards";
import {
  BlockButton,
  PlanSelect,
} from "@/features/admin/components/user-controls";
import { describeTotal } from "@/features/admin/describe-total";
import {
  describePlanOrigin,
  type PlanOrigin,
} from "@/features/admin/plan-origin";
import {
  type AdminUserRow,
  countUsers,
  getLastCollection,
  listUsersForAdmin,
} from "@/features/admin/queries";
import { listRunningAccess } from "@/features/billing/access";
import { formatInteger, formatUpdatedAt } from "@/features/radar/domain/format";
import { requireAdmin } from "@/lib/session";

// On phones the collection card takes the whole row and the two counts share the next one.
const COLLECTION_CARD_CLASS = "col-span-2 sm:col-span-1";

export const metadata: Metadata = { title: "Admin" };

function UserItem(props: {
  row: AdminUserRow;
  origin: PlanOrigin;
  currentUserId: string;
}): ReactElement {
  const { row } = props;
  const canBlock = !row.isAdmin && row.id !== props.currentUserId;

  return (
    <li className="flex flex-col gap-3 rounded-xl border border-border p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2 font-medium">
          <span className="truncate">{row.name}</span>
          {row.isAdmin && <Badge variant="secondary">Admin</Badge>}
          {row.isBlocked && <Badge variant="destructive">Bloqueada</Badge>}
        </p>
        <p className="truncate text-sm text-muted-foreground">{row.email}</p>
        <p className="text-xs text-muted-foreground">
          Desde {formatUpdatedAt(row.createdAt)}
        </p>
        <PlanOriginNote origin={props.origin} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <PlanSelect userId={row.id} userName={row.name} plan={row.plan} />
        {canBlock && (
          <BlockButton
            userId={row.id}
            userName={row.name}
            isBlocked={row.isBlocked}
          />
        )}
      </div>
    </li>
  );
}

export default async function AdminPage(
  props: PageProps<"/admin">,
): Promise<ReactElement> {
  const admin = await requireAdmin();
  const params = await props.searchParams;
  const search = typeof params.busca === "string" ? params.busca.trim() : "";
  const db = getDatabase();

  const [users, totals, lastCollection] = await Promise.all([
    listUsersForAdmin({ db, search }),
    countUsers(db),
    getLastCollection(db, "products"),
  ]);
  const hotmartAccess = await listRunningAccess(
    db,
    users.items.map((row) => row.email.toLowerCase()),
    new Date(),
  );

  return (
    <div className="flex flex-col gap-6">
      <AdminTabs active="contas" />

      <section
        className="grid grid-cols-2 gap-3 sm:grid-cols-3"
        aria-label="Resumo"
      >
        <CollectionCard
          kind="products"
          run={lastCollection}
          className={COLLECTION_CARD_CLASS}
        />
        <StatCard title="Contas" value={formatInteger(totals.total)} />
        <StatCard title="Bloqueadas" value={formatInteger(totals.blocked)} />
      </section>

      <section className="flex flex-col gap-3" aria-label="Contas">
        <search>
          <form method="get" className="flex gap-2">
            <input
              type="search"
              name="busca"
              defaultValue={search}
              aria-label="Buscar conta"
              placeholder="Nome ou e-mail"
              className="h-11 min-w-0 flex-1 rounded-lg border border-input bg-transparent px-3 text-sm"
            />
            <button
              type="submit"
              className="inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Search className="size-4" aria-hidden />
              Buscar
            </button>
          </form>
        </search>

        <p className="text-sm text-muted-foreground">
          {describeTotal(users.total, search)}
        </p>

        <ul className="flex flex-col gap-2">
          {users.items.map((row) => (
            <UserItem
              key={row.id}
              row={row}
              origin={describePlanOrigin(
                row.plan,
                hotmartAccess.get(row.email.toLowerCase()),
              )}
              currentUserId={admin.id}
            />
          ))}
        </ul>
      </section>
    </div>
  );
}
