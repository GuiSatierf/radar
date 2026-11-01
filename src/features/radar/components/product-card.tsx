import Link from "next/link";
import type { ReactElement } from "react";
import { formatCents, formatMonthlySales } from "../domain/format";
import type { ProductCardData } from "../queries";
import { CompetitionBadge } from "./competition-badge";
import { ProductImage } from "./product-image";
import { ProductTags } from "./product-tags";

/** One product in the list: a column card on wide screens, a compact row on phones. */
export function ProductCard(props: { product: ProductCardData }): ReactElement {
  const { product } = props;

  return (
    <Link
      href={`/radar/${product.id}`}
      className="group grid w-full grid-cols-[88px_1fr] gap-3 rounded-2xl border border-border bg-card p-2.5 transition-colors hover:border-primary/40 focus-visible:outline-2 focus-visible:outline-ring sm:grid-cols-1 sm:p-0"
    >
      <ProductImage
        url={product.imageUrl}
        alt={product.name}
        sizes="(min-width: 640px) 33vw, 88px"
        className="aspect-square rounded-xl sm:aspect-[4/3] sm:rounded-b-none sm:rounded-t-2xl"
      />

      <div className="flex min-w-0 flex-col gap-1.5 sm:p-3 sm:pt-1">
        <ProductTags product={product} className="hidden sm:flex" />
        <p className="line-clamp-2 text-sm leading-snug font-medium">
          {product.name}
        </p>
        <p className="text-xs text-muted-foreground">
          {formatCents(product.priceCents)}
        </p>
        <p className="text-base font-semibold text-primary">
          Você ganha {formatCents(product.earningsCents)}
        </p>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <CompetitionBadge
            affiliateCount={product.affiliateCount}
            affiliateCountIsMinimum={product.affiliateCountIsMinimum}
          />
          <span className="text-xs text-muted-foreground">
            {formatMonthlySales(product.monthlySales)}
          </span>
        </div>

        <div className="mt-auto flex items-center justify-between border-t border-border pt-1.5 text-xs">
          <span className="text-muted-foreground">Nota de oportunidade</span>
          <span className="font-semibold">{product.opportunityScore}</span>
        </div>
      </div>
    </Link>
  );
}
