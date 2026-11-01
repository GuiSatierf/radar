import { CircleAlert } from "lucide-react";
import type { Metadata } from "next";
import { after } from "next/server";
import type { ReactElement } from "react";
import { getDatabase } from "@/db/client";
import { LockedTool } from "@/features/plans/components/locked-tool";
import { PLANS } from "@/features/plans/plans";
import { CreateVideoForm } from "@/features/studio/components/create-video-form";
import { RefreshWhileGenerating } from "@/features/studio/components/refresh-while-generating";
import { VideoLibrary } from "@/features/studio/components/video-library";
import { VideoQuotaBox } from "@/features/studio/components/video-quota-box";
import { shouldNudgeWorker } from "@/features/studio/domain/library";
import {
  BUSY_MESSAGE,
  describeQuotaBlock,
} from "@/features/studio/domain/messages";
import {
  calculateVideoQuota,
  formatQuotaRenewal,
  type VideoQuota,
} from "@/features/studio/domain/quota";
import {
  getStudioLibrary,
  getStudioProduct,
  listStudioProducts,
} from "@/features/studio/queries";
import { runVideoQueue } from "@/features/studio/run-queue";
import { checkToolAccess } from "@/lib/session";

export const metadata: Metadata = { title: "Studio" };

// Product ids are short letters, digits and dashes (src/sources/products/product-source.ts).
const PRODUCT_ID = /^[a-z0-9-]{1,40}$/;

function readProductId(value: string | string[] | undefined): string | null {
  const first = Array.isArray(value) ? value[0] : value;

  if (first == null || PRODUCT_ID.test(first) === false) return null;

  return first;
}

function describeBlock(input: {
  quota: VideoQuota;
  renewal: string;
  hasActiveVideo: boolean;
}): string | null {
  const quotaBlock = describeQuotaBlock(input.quota, input.renewal);

  if (quotaBlock != null) return quotaBlock;

  return input.hasActiveVideo ? BUSY_MESSAGE : null;
}

export default async function StudioPage(
  props: PageProps<"/studio">,
): Promise<ReactElement> {
  const { user, isAllowed } = await checkToolAccess("studio");

  if (!isAllowed) return <LockedTool tool="studio" plan={user.plan} />;

  const productId = readProductId((await props.searchParams).produto);
  const db = getDatabase();
  const now = new Date();
  const profile = user.commissionProfile;

  const [library, product, suggestions] = await Promise.all([
    getStudioLibrary({ db, userId: user.id, now }),
    productId == null ? null : getStudioProduct({ db, id: productId, profile }),
    listStudioProducts({ db, search: null, profile }),
  ]);
  const quota = calculateVideoQuota(
    PLANS[user.plan].monthlyVideos,
    library.usedThisMonth,
  );
  const renewal = formatQuotaRenewal(now);

  // Picks up a video whose worker was lost, even where the scheduled task is not set up yet.
  if (shouldNudgeWorker(library.activeVideoCreatedAt, now))
    after(runVideoQueue);

  return (
    <div className="flex flex-col gap-4">
      <VideoQuotaBox quota={quota} renewal={renewal} />

      {/* Leaves with slice 2, when a paid video API makes the real video. */}
      <p className="flex items-start gap-2 rounded-2xl bg-amber-100 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
        <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
        Fase de teste: o vídeo gerado é um exemplo, ainda não é do seu produto.
      </p>

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <CreateVideoForm
          product={product}
          suggestions={suggestions}
          blockedMessage={describeBlock({
            quota,
            renewal,
            hasActiveVideo: library.hasActiveVideo,
          })}
        />
        <VideoLibrary videos={library.videos} now={now} />
      </div>

      {library.hasActiveVideo && <RefreshWhileGenerating />}
    </div>
  );
}
