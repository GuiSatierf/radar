"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { type ReactElement, useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ProductImage } from "@/features/radar/components/product-image";
import { formatCents } from "@/features/radar/domain/format";
import { searchStudioProducts } from "../actions";
import { MAX_PRODUCT_SEARCH_LENGTH } from "../domain/library";
import type { StudioProduct } from "../queries";

const SEARCH_DELAY_IN_MS = 300;

/** "R$ 12,36 por venda · concorrência baixa": what the person earns, and the competition when counted. */
export function describeStudioProduct(product: StudioProduct): string {
  const earnings = `${formatCents(product.earningsCents)} por venda`;

  if (product.competitionLabel == null) return earnings;

  return `${earnings} · ${product.competitionLabel.toLowerCase()}`;
}

type SearchState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "done"; products: StudioProduct[] }
  | { kind: "error"; message: string };

/** Waits for a pause in typing, then asks the server; an older answer never replaces a newer one. */
function useProductSearch(search: string): SearchState {
  const [state, setState] = useState<SearchState>({ kind: "idle" });

  useEffect(() => {
    if (search.trim() === "") {
      setState({ kind: "idle" });

      return;
    }

    let isCurrent = true;
    setState({ kind: "loading" });
    const timer = setTimeout(async () => {
      try {
        const result = await searchStudioProducts(search);

        if (isCurrent === false) return;

        setState(
          result.ok
            ? { kind: "done", products: result.products }
            : { kind: "error", message: result.message },
        );
      } catch {
        if (isCurrent === false) return;

        setState({
          kind: "error",
          message: "Não deu para buscar agora. Tente de novo.",
        });
      }
    }, SEARCH_DELAY_IN_MS);

    return () => {
      isCurrent = false;
      clearTimeout(timer);
    };
  }, [search]);

  return state;
}

function ProductOption(props: {
  product: StudioProduct;
  onPick: () => void;
}): ReactElement {
  const { product } = props;

  return (
    <li>
      <Link
        href={`/studio?produto=${encodeURIComponent(product.id)}`}
        scroll={false}
        onClick={props.onPick}
        className="flex min-h-14 items-center gap-3 rounded-xl p-2 hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
      >
        <div aria-hidden>
          <ProductImage
            url={product.imageUrl}
            alt=""
            sizes="44px"
            className="size-11 shrink-0 rounded-lg"
          />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{product.name}</p>
          <p className="text-xs text-muted-foreground">
            {describeStudioProduct(product)}
          </p>
        </div>
      </Link>
    </li>
  );
}

/** The list to pick a product from: the Radar's best opportunities first, or a search by name. */
export function ProductPicker(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suggestions: readonly StudioProduct[];
}): ReactElement {
  const [search, setSearch] = useState("");
  const state = useProductSearch(search);
  const products = state.kind === "done" ? state.products : props.suggestions;

  return (
    <Sheet open={props.open} onOpenChange={props.onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[85dvh] rounded-t-2xl sm:mx-auto sm:max-w-lg"
      >
        <SheetHeader className="pb-0">
          <SheetTitle>Escolha o produto</SheetTitle>
          <SheetDescription>
            Os produtos do Radar, com o que você ganha por venda.
          </SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-col gap-3 px-4 pb-4">
          <label htmlFor="studio-product-search" className="sr-only">
            Buscar no Radar
          </label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              id="studio-product-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar no Radar"
              maxLength={MAX_PRODUCT_SEARCH_LENGTH}
              className="h-11 pl-9"
            />
          </div>

          <div aria-live="polite" className="text-sm text-muted-foreground">
            {state.kind === "loading" && "Buscando…"}
            {state.kind === "error" && state.message}
            {state.kind === "done" &&
              state.products.length === 0 &&
              "Nenhum produto com esse nome. Tente outra palavra."}
          </div>

          <ul className="-mx-2 flex min-h-0 flex-col overflow-y-auto">
            {products.map((product) => (
              <ProductOption
                key={product.id}
                product={product}
                onPick={() => props.onOpenChange(false)}
              />
            ))}
          </ul>
        </div>
      </SheetContent>
    </Sheet>
  );
}
