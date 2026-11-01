"use client";

import { Search, SlidersHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, type ReactElement, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  countActiveFilters,
  PAGE_SIZE,
  type RadarFilters,
  SORT_LABEL,
  SORT_OPTIONS,
  type SortOption,
  TAG_OPTIONS,
  type TagOption,
  toSearchParams,
} from "../filters";
import type { CatalogFacts } from "../queries";
import {
  CategorySelect,
  CompetitionChips,
  MinEarningsSelect,
  TagChips,
} from "./filter-controls";

type Category = { slug: string; label: string };

/** Every change goes straight into the URL; the server renders the new list. */
function useRadarNavigation(filters: RadarFilters) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function update(changes: Partial<RadarFilters>): void {
    // Any new filter starts again from the first page.
    const next = { ...filters, ...changes, limit: PAGE_SIZE };
    const query = toSearchParams(next).toString();

    startTransition(() => {
      router.push(query.length > 0 ? `/radar?${query}` : "/radar", {
        scroll: false,
      });
    });
  }

  return { update, isPending };
}

function SearchBox(props: {
  value: string | null;
  onSearch: (value: string | null) => void;
}): ReactElement {
  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();

    const text = new FormData(event.currentTarget).get("busca");
    const value = typeof text === "string" ? text.trim() : "";

    props.onSearch(value.length === 0 ? null : value);
  }

  return (
    <search className="min-w-0 flex-1">
      <form onSubmit={handleSubmit} className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          name="busca"
          type="search"
          aria-label="Buscar produto"
          placeholder="Buscar produto"
          defaultValue={props.value ?? ""}
          className="h-10 pl-9 text-base sm:text-sm"
        />
      </form>
    </search>
  );
}

/** "Amostra grátis" only when some product has one; the Shopee API never says it. */
function availableTags(facts: CatalogFacts): TagOption[] {
  return TAG_OPTIONS.filter(
    (tag) => tag !== "amostra-gratis" || facts.hasFreeSamples,
  );
}

function FilterFields(props: {
  filters: RadarFilters;
  categories: readonly Category[];
  facts: CatalogFacts;
  update: (changes: Partial<RadarFilters>) => void;
}): ReactElement {
  const { filters, update } = props;

  return (
    <>
      {props.facts.hasAffiliateCounts && (
        <CompetitionChips
          value={filters.competition}
          onChange={(competition) => update({ competition })}
        />
      )}
      <CategorySelect
        categories={props.categories}
        value={filters.category}
        onChange={(category) => update({ category })}
      />
      <MinEarningsSelect
        valueCents={filters.minEarningsCents}
        onChange={(minEarningsCents) => update({ minEarningsCents })}
      />
      <TagChips
        options={availableTags(props.facts)}
        value={filters.tags}
        onChange={(tags) => update({ tags })}
      />
    </>
  );
}

const CLEARED: Partial<RadarFilters> = {
  category: null,
  competition: null,
  minEarningsCents: null,
  tags: [],
};

export function RadarFilterBar(props: {
  filters: RadarFilters;
  categories: readonly Category[];
  facts: CatalogFacts;
  total: number;
}): ReactElement {
  const { update, isPending } = useRadarNavigation(props.filters);
  const activeCount = countActiveFilters(props.filters);

  return (
    <section
      aria-label="Filtros"
      aria-busy={isPending}
      className="flex flex-col gap-3"
    >
      <div className="flex items-center gap-2">
        {/* The key resets the box when the search changes from outside (e.g. "Limpar tudo"). */}
        <SearchBox
          key={props.filters.search ?? ""}
          value={props.filters.search}
          onSearch={(search) => update({ search })}
        />

        <Sheet>
          <SheetTrigger
            render={
              <Button className="h-10 gap-1.5 px-3 md:hidden">
                <SlidersHorizontal className="size-4" aria-hidden />
                Filtros{activeCount > 0 ? ` (${activeCount})` : ""}
              </Button>
            }
          />
          <SheetContent
            side="bottom"
            className="max-h-[85dvh] overflow-y-auto rounded-t-2xl"
          >
            <SheetHeader>
              <SheetTitle>Filtros</SheetTitle>
            </SheetHeader>
            <div className="flex flex-col items-start gap-4 px-4">
              <FilterFields
                filters={props.filters}
                categories={props.categories}
                facts={props.facts}
                update={update}
              />
            </div>
            <SheetFooter className="flex-row gap-2">
              <Button
                variant="outline"
                className="h-11 flex-1"
                onClick={() => update(CLEARED)}
              >
                Limpar
              </Button>
              <SheetClose render={<Button className="h-11 flex-[2]" />}>
                {isPending ? "Atualizando…" : `Ver ${props.total} produtos`}
              </SheetClose>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>

      <div className="hidden flex-wrap items-center gap-2 md:flex">
        <FilterFields
          filters={props.filters}
          categories={props.categories}
          facts={props.facts}
          update={update}
        />
        {activeCount > 0 && (
          <Button
            variant="ghost"
            className="h-9"
            onClick={() => update(CLEARED)}
          >
            Limpar filtros
          </Button>
        )}
      </div>
    </section>
  );
}

/** "Menos concorrência" only makes sense once some product has an affiliate count. */
function availableSorts(
  facts: CatalogFacts,
  current: SortOption,
): SortOption[] {
  return SORT_OPTIONS.filter(
    (option) =>
      option !== "concorrencia" ||
      facts.hasAffiliateCounts ||
      option === current,
  );
}

export function SortSelect(props: {
  filters: RadarFilters;
  facts: CatalogFacts;
}): ReactElement {
  const { update } = useRadarNavigation(props.filters);

  return (
    <label className="flex items-center gap-2 text-sm text-muted-foreground">
      Ordenar
      <select
        value={props.filters.sort}
        onChange={(event) => {
          const sort = SORT_OPTIONS.find(
            (option) => option === event.target.value,
          );

          if (sort == null) return;

          update({ sort });
        }}
        className="h-9 rounded-lg border border-input bg-transparent px-2 text-sm font-medium text-foreground"
      >
        {availableSorts(props.facts, props.filters.sort).map((option) => (
          <option key={option} value={option}>
            {SORT_LABEL[option]}
          </option>
        ))}
      </select>
    </label>
  );
}
