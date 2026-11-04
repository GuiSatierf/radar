import {
  ArrowLeft,
  Clapperboard,
  ExternalLink,
  Lock,
  Star,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactElement, ReactNode } from "react";
import { getDatabase } from "@/db/client";
import { canUseTool } from "@/features/plans/access";
import { LockedTool } from "@/features/plans/components/locked-tool";
import {
  COMPETITION_COLOR,
  formatAffiliates,
} from "@/features/radar/components/competition-badge";
import { CopyLinkButton } from "@/features/radar/components/copy-link-button";
import { ProductGallery } from "@/features/radar/components/product-gallery";
import { ProductTags } from "@/features/radar/components/product-tags";
import type { CommissionProfile } from "@/features/radar/domain/commission";
import { shopeeRateBasisPoints } from "@/features/radar/domain/commission";
import {
  COMPETITION_LABEL,
  type CompetitionDisplay,
  classifyCompetition,
} from "@/features/radar/domain/competition";
import {
  formatBasisPoints,
  formatCents,
  formatCompact,
  formatInteger,
  formatRating,
  formatUpdatedAt,
} from "@/features/radar/domain/format";
import { describeOpportunity } from "@/features/radar/domain/opportunity-score";
import {
  getProductDetail,
  type ProductDetailData,
} from "@/features/radar/queries";
import { checkToolAccess } from "@/lib/session";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Produto" };

function StatBlock(props: {
  label: string;
  value: ReactNode;
  hint: string;
  className?: string;
}): ReactElement {
  return (
    <div className={cn("rounded-xl bg-muted p-3", props.className)}>
      <p className="text-xs opacity-80">{props.label}</p>
      <p className="mt-0.5 text-xl font-semibold">{props.value}</p>
      <p className="mt-0.5 text-xs opacity-80">{props.hint}</p>
    </div>
  );
}

function priceText(product: ProductDetailData): string {
  if (product.priceMaxCents === product.priceCents)
    return formatCents(product.priceCents);

  return `${formatCents(product.priceCents)} a ${formatCents(product.priceMaxCents)}`;
}

function commissionHint(
  product: ProductDetailData,
  profile: CommissionProfile,
): string {
  const total = formatBasisPoints(product.totalRateBasisPoints);
  const shopee = formatBasisPoints(shopeeRateBasisPoints(profile));

  if (product.sellerRateBasisPoints === 0) return `${total} pagos pela Shopee`;

  return `${total} (Shopee ${shopee} + loja ${formatBasisPoints(product.sellerRateBasisPoints)})`;
}

const COMPETITION_HINT: Record<CompetitionDisplay, string> = {
  baixa: "divulgando este produto",
  media: "divulgando este produto",
  alta: "divulgando este produto",
  incerta: "a Shopee mostra só o mínimo; podem ser muitos mais",
  "sem-contagem": "quantas pessoas divulgam este produto",
};

function ProductStats(props: {
  product: ProductDetailData;
  profile: CommissionProfile;
}): ReactElement {
  const { product } = props;
  const level = classifyCompetition(product);

  return (
    <div className="grid grid-cols-2 gap-2">
      <StatBlock
        label="Você ganha por venda"
        value={formatCents(product.earningsCents)}
        hint={commissionHint(product, props.profile)}
        className="bg-accent text-accent-foreground [&>p:nth-child(2)]:text-primary"
      />
      <StatBlock
        label={COMPETITION_LABEL[level]}
        value={formatAffiliates(product)}
        hint={COMPETITION_HINT[level]}
        className={COMPETITION_COLOR[level]}
      />
      <StatBlock
        label="Nota de oportunidade"
        value={`${product.opportunityScore} de 100`}
        hint={describeOpportunity(product.opportunityScore, {
          isCompetitionKnown: product.affiliateCount != null,
        })}
      />
      <StatBlock
        label="Vendas no último mês"
        value={formatInteger(product.monthlySales)}
        hint={
          product.stock == null
            ? "Estoque não informado"
            : `Estoque: ${formatInteger(product.stock)} unidades`
        }
      />
    </div>
  );
}

function TopVideos(props: { product: ProductDetailData }): ReactElement {
  const { videos } = props.product;

  return (
    <section
      aria-labelledby="videos-title"
      className="flex flex-col gap-2 border-t border-border pt-4"
    >
      <h2 id="videos-title" className="text-base font-semibold">
        Os vídeos com mais visualizações
      </h2>
      <p className="text-sm text-muted-foreground">
        Veja como outras pessoas mostraram este produto.
      </p>

      {videos.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {/* No count means nobody looked yet: "no videos" would be a guess. */}
          {props.product.affiliateCount == null
            ? "Ainda não buscamos os vídeos deste produto."
            : "Ainda não achamos vídeos deste produto. Pode ser a sua chance de ser a primeira."}
        </p>
      ) : (
        <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {videos.map((video) => (
            <li
              key={video.rank}
              className="flex items-center gap-3 rounded-xl border border-border p-3"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold">
                {video.rank}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  @{video.creatorHandle}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatCompact(video.views)} visualizações
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/** Opens the Studio with this product picked; without Studio in the plan it lands on the lock screen. */
function StudioLink(props: {
  productId: string;
  isLocked: boolean;
}): ReactElement {
  const Icon = props.isLocked ? Lock : Clapperboard;

  return (
    <Link
      href={`/studio?produto=${encodeURIComponent(props.productId)}`}
      className="inline-flex h-11 items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-4 text-sm font-medium hover:bg-muted"
    >
      <Icon className="size-4" aria-hidden />
      Criar vídeo no Studio
      {props.isLocked && <span className="sr-only"> (sem acesso)</span>}
    </Link>
  );
}

export default async function ProductPage(
  props: PageProps<"/radar/[id]">,
): Promise<ReactElement> {
  const { user, isAllowed } = await checkToolAccess("radar");

  if (!isAllowed) return <LockedTool />;

  const { id } = await props.params;
  const product = await getProductDetail({
    db: getDatabase(),
    id,
    profile: user.commissionProfile,
  });

  if (product == null) notFound();

  return (
    <article className="flex flex-col gap-5">
      <Link
        href="/radar"
        className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Voltar ao Radar
      </Link>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <ProductGallery imageUrls={product.imageUrls} name={product.name} />

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <div className="flex flex-wrap gap-1">
              <ProductTags product={product} />
            </div>
            <h2 className="text-xl font-semibold leading-snug">
              {product.name}
            </h2>
            <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
              <span>{priceText(product)}</span>
              {product.ratingTenths != null && (
                <span className="flex items-center gap-1">
                  <Star className="size-3.5" aria-hidden />
                  {formatRating(product.ratingTenths)}
                  {product.ratingCount != null &&
                    ` (${formatInteger(product.ratingCount)} avaliações)`}
                </span>
              )}
              <span className="basis-full">
                {product.categoryLabel} · {product.shopName}
              </span>
            </p>
          </div>

          <ProductStats product={product} profile={user.commissionProfile} />

          <div className="flex flex-wrap gap-2">
            <a
              href={product.productUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/85"
            >
              Abrir na Shopee
              <ExternalLink className="size-4" aria-hidden />
            </a>
            <StudioLink
              productId={product.id}
              isLocked={canUseTool(user, "studio") === false}
            />
            <CopyLinkButton url={product.productUrl} />
          </div>

          <p className="text-xs text-muted-foreground">
            Dados atualizados em {formatUpdatedAt(product.collectedAt)}.
          </p>
        </div>
      </div>

      <TopVideos product={product} />
    </article>
  );
}
