import type { Metadata } from "next";
import type { ReactElement, ReactNode } from "react";
import { getDatabase } from "@/db/client";
import { AdminTabs } from "@/features/admin/components/admin-tabs";
import {
  type ModelOption,
  ProviderKeyRow,
  VideoAiPicker,
  VideoLimitForm,
} from "@/features/admin/components/video-ai-setup";
import { formatUpdatedAt } from "@/features/radar/domain/format";
import {
  SAMPLE_VIDEO_CHOICE,
  VIDEO_PROVIDER_IDS,
  VIDEO_PROVIDERS,
} from "@/features/video-ai/providers";
import {
  getVideoSettings,
  listSavedVideoKeys,
  type SavedVideoKey,
} from "@/features/video-ai/settings";
import { getServerEnv } from "@/lib/env";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "Admin · Vídeo com IA" };

function SetupStep(props: {
  title: string;
  hint: string;
  children: ReactNode;
}): ReactElement {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border p-4">
      <div>
        <h3 className="font-medium">{props.title}</h3>
        <p className="text-sm text-muted-foreground">{props.hint}</p>
      </div>
      {props.children}
    </section>
  );
}

/** One option per model of each service that has a key saved. */
function listModelOptions(saved: readonly SavedVideoKey[]): ModelOption[] {
  return saved.flatMap((key) => {
    const provider = VIDEO_PROVIDERS[key.provider];

    return provider.models.map((model) => ({
      value: `${provider.id}:${model.id}`,
      label: `${model.label} · ${model.costHint}`,
    }));
  });
}

export default async function AdminVideoPage(): Promise<ReactElement> {
  await requireAdmin();
  const db = getDatabase();
  const [settings, savedKeys] = await Promise.all([
    getVideoSettings(db),
    listSavedVideoKeys(db),
  ]);
  const canSaveKeys = getServerEnv().VIDEO_KEYS_SECRET != null;
  const savedAt = new Map(
    savedKeys.map((key) => [key.provider, key.updatedAt]),
  );
  const current =
    settings.chosen == null
      ? SAMPLE_VIDEO_CHOICE
      : `${settings.chosen.provider}:${settings.chosen.model}`;

  return (
    <div className="flex flex-col gap-6">
      <AdminTabs active="video" />

      <section className="flex flex-col gap-3" aria-label="Vídeo com IA">
        <h2 className="text-lg font-semibold">Vídeo com IA</h2>

        <SetupStep
          title="1 · Limite de vídeos por pessoa"
          hint="Quantos vídeos cada pessoa pode criar e de quanto em quanto tempo a conta zera, no horário de Brasília: o dia vira à meia-noite, a semana na segunda e o mês no dia 1. Zero desliga o Studio."
        >
          <VideoLimitForm limit={settings.limit} />
        </SetupStep>

        <SetupStep
          title="2 · IA que cria os vídeos"
          hint="Aparecem as IAs que já têm chave salva no passo 3. A troca vale para o próximo vídeo."
        >
          <VideoAiPicker
            options={listModelOptions(savedKeys)}
            current={current}
          />
        </SetupStep>

        <SetupStep
          title="3 · Chaves dos serviços"
          hint="Cole a chave da conta de vocês em cada serviço. Depois de salva, ela não aparece de novo, nem aqui: só dá para trocar ou tirar."
        >
          {canSaveKeys === false && (
            <p
              role="status"
              className="rounded-xl bg-amber-100 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100"
            >
              O servidor ainda não está pronto para guardar chaves. Fale com
              quem cuida da hospedagem.
            </p>
          )}
          <ul className="flex flex-col divide-y divide-border">
            {VIDEO_PROVIDER_IDS.map((id) => {
              const updatedAt = savedAt.get(id);

              return (
                <ProviderKeyRow
                  key={id}
                  provider={VIDEO_PROVIDERS[id]}
                  savedLabel={
                    updatedAt == null
                      ? null
                      : `Salva em ${formatUpdatedAt(updatedAt)}`
                  }
                />
              );
            })}
          </ul>
        </SetupStep>
      </section>
    </div>
  );
}
