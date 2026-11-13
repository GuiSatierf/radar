"use client";

import {
  type FormEvent,
  type ReactElement,
  useState,
  useTransition,
} from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useIsClient } from "@/lib/use-is-client";
import { MAX_FILE_CHARACTERS } from "@/sources/products/affiliate-counts/parse-affiliate-file";
import { importAffiliateCounts } from "../affiliate-actions";

type Outcome = { ok: true; text: string } | { ok: false; text: string };

const TOO_LARGE =
  "O arquivo passou de 900 KB. Divida em partes menores e envie uma de cada vez.";

export function AffiliateImportForm(): ReactElement {
  const [isPending, startTransition] = useTransition();
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const isReady = useIsClient();

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const file = new FormData(event.currentTarget).get("arquivo");

    if (file instanceof File === false || file.size === 0) {
      setOutcome({
        ok: false,
        text: "Escolha o arquivo resultado.csv do robô antes de enviar.",
      });
      return;
    }

    if (file.size > MAX_FILE_CHARACTERS) {
      setOutcome({ ok: false, text: TOO_LARGE });
      return;
    }

    setOutcome(null);
    startTransition(async () => {
      const result = await importAffiliateCounts({ text: await file.text() });

      setOutcome(
        result.ok
          ? { ok: true, text: result.summary }
          : { ok: false, text: result.message },
      );
    });
  }

  return (
    <form
      method="post"
      onSubmit={handleSubmit}
      className="flex flex-col gap-3"
      aria-describedby="arquivo-resultado"
    >
      <label htmlFor="arquivo" className="text-sm font-medium">
        Arquivo do robô (resultado.csv) ou planilha com as colunas product_id e
        numero_afiliados
      </label>
      <Input
        id="arquivo"
        name="arquivo"
        type="file"
        accept=".csv,text/csv"
        className="h-11 text-base"
      />
      <Button
        type="submit"
        className="h-11 sm:self-start"
        disabled={isReady === false || isPending}
      >
        {isPending ? "Enviando…" : "Enviar arquivo"}
      </Button>
      <p
        id="arquivo-resultado"
        role="status"
        aria-live="polite"
        className={
          outcome == null
            ? "sr-only"
            : outcome.ok
              ? "rounded-xl bg-muted px-4 py-3 text-sm"
              : "rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive"
        }
      >
        {outcome?.text ?? ""}
      </p>
    </form>
  );
}
