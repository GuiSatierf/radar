import { ExternalLink } from "lucide-react";
import Link from "next/link";
import type { ReactElement } from "react";
import { ProductImage } from "@/features/radar/components/product-image";
import { formatCents } from "@/features/radar/domain/format";
import { cn } from "@/lib/utils";
import { AD_PLATFORM_LABEL, formatDaysOnAir } from "../domain/ads";
import type { AdCardData } from "../queries";

const BUTTON_CLASS =
  "inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg border border-input px-2 text-sm font-medium whitespace-nowrap hover:bg-muted";

/** One curated ad: how long it has run, who runs it, its text and the product it sells. */
export function AdCard(props: { ad: AdCardData }): ReactElement {
  const { ad } = props;
  const platforms = ad.platforms
    .map((platform) => AD_PLATFORM_LABEL[platform])
    .join(" · ");

  return (
    <article className="flex w-full flex-col overflow-hidden rounded-2xl border border-border bg-card">
      <div className="relative">
        <ProductImage
          url={ad.product?.imageUrl ?? null}
          alt={ad.product?.name ?? "Produto do anúncio"}
          sizes="(min-width: 640px) 33vw, 100vw"
          className="aspect-[2/1] sm:aspect-[4/3]"
        />
        <span
          className={cn(
            "absolute top-2 left-2 rounded-full px-2.5 py-1 text-xs font-semibold",
            ad.isActive
              ? "bg-accent text-accent-foreground"
              : "bg-muted text-muted-foreground",
          )}
        >
          {formatDaysOnAir(ad.daysOnAir, ad.isActive)}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <div>
          <h2 className="font-medium">{ad.advertiserName}</h2>
          {platforms.length > 0 && (
            <p className="text-xs text-muted-foreground">{platforms}</p>
          )}
        </div>

        {ad.adText.length > 0 && (
          <p className="line-clamp-3 text-sm text-muted-foreground">
            “{ad.adText}”
          </p>
        )}

        {ad.product == null ? (
          <p className="text-sm text-muted-foreground">
            Produto fora do nosso catálogo.
          </p>
        ) : (
          <div className="border-t border-border pt-2">
            <p className="line-clamp-2 text-sm font-medium">
              {ad.product.name}
            </p>
            <p className="text-sm">
              {formatCents(ad.product.priceCents)}
              <span className="font-semibold text-primary">
                {" "}
                · Você ganha {formatCents(ad.product.earningsCents)}
              </span>
            </p>
          </div>
        )}

        <div className="mt-auto flex gap-2 pt-1">
          <a
            href={ad.libraryUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={BUTTON_CLASS}
            aria-label={`Ver o anúncio de ${ad.advertiserName} na biblioteca da Meta`}
          >
            <ExternalLink className="size-4" aria-hidden />
            Ver anúncio
          </a>
          {ad.product != null && (
            <Link href={`/radar/${ad.product.id}`} className={BUTTON_CLASS}>
              Ver produto
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}
