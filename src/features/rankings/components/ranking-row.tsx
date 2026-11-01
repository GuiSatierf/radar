import Link from "next/link";
import type { ReactElement } from "react";
import { formatCalendarDay } from "@/features/ads/domain/ads";
import { ProductImage } from "@/features/radar/components/product-image";
import {
  formatCents,
  formatInteger,
  formatMonthlySales,
} from "@/features/radar/domain/format";
import type { RankingList } from "../filters";
import type { RankedProduct } from "../queries";

/** The number that puts the product in this position, said in words. */
function reasonText(list: RankingList, product: RankedProduct): string {
  if (list === "em-alta" && product.growth != null) {
    const since = formatCalendarDay(product.growth.since, { withYear: false });

    return `+${formatInteger(product.growth.sales)} vendas desde ${since}`;
  }

  return formatMonthlySales(product.monthlySales);
}

/** One numbered line of a ranking; opens the product in the Radar. */
export function RankingRow(props: {
  position: number;
  list: RankingList;
  product: RankedProduct;
}): ReactElement {
  const { product } = props;

  return (
    <Link
      href={`/radar/${product.id}`}
      className="grid grid-cols-[2rem_64px_1fr] items-center gap-3 rounded-2xl border border-border bg-card p-2.5 transition-colors hover:border-primary/40 focus-visible:outline-2 focus-visible:outline-ring"
    >
      <span className="text-center text-base font-semibold text-muted-foreground tabular-nums">
        {props.position}
      </span>
      <ProductImage
        url={product.imageUrl}
        alt={product.name}
        sizes="64px"
        className="aspect-square rounded-xl"
      />
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="line-clamp-2 text-sm leading-snug font-medium">
          {product.name}
        </p>
        <p className="text-sm font-semibold text-primary">
          Você ganha {formatCents(product.earningsCents)}
        </p>
        <p className="text-xs text-muted-foreground">
          {reasonText(props.list, product)}
        </p>
      </div>
    </Link>
  );
}
