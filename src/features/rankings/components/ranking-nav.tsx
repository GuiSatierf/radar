"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactElement, useTransition } from "react";
import { CategorySelect } from "@/features/radar/components/filter-controls";
import { cn } from "@/lib/utils";
import {
  RANKING_LABEL,
  RANKING_LISTS,
  type RankingFilters,
  toRankingParams,
} from "../filters";

function rankingHref(filters: RankingFilters): string {
  const query = toRankingParams(filters).toString();

  return query.length > 0 ? `/rankings?${query}` : "/rankings";
}

/** The three lists as links (each keeps the chosen category) and the category picker. */
export function RankingNav(props: {
  filters: RankingFilters;
  categories: readonly { slug: string; label: string }[];
}): ReactElement {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function changeCategory(category: string | null): void {
    startTransition(() => {
      router.push(rankingHref({ ...props.filters, category }), {
        scroll: false,
      });
    });
  }

  return (
    <div
      aria-busy={isPending}
      className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <nav aria-label="Listas" className="grid grid-cols-3 gap-2 sm:flex">
        {RANKING_LISTS.map((list) => (
          <Link
            key={list}
            href={rankingHref({ ...props.filters, list })}
            scroll={false}
            aria-current={props.filters.list === list ? "page" : undefined}
            className={cn(
              "inline-flex h-11 items-center justify-center rounded-lg border px-3 text-sm font-medium whitespace-nowrap transition-colors sm:h-10 sm:px-4",
              props.filters.list === list
                ? "border-transparent bg-accent text-accent-foreground"
                : "border-input hover:bg-muted",
            )}
          >
            {RANKING_LABEL[list]}
          </Link>
        ))}
      </nav>
      <CategorySelect
        categories={props.categories}
        value={props.filters.category}
        onChange={changeCategory}
      />
    </div>
  );
}
