"use client";

import { Copy } from "lucide-react";
import type { ReactElement } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function CopyLinkButton(props: { url: string }): ReactElement {
  async function handleCopy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(props.url);
      toast.success("Link copiado");
    } catch {
      // Some browsers block the clipboard (e.g. without HTTPS); the user can still open the link.
      toast.error("Não deu para copiar. Use o botão Abrir na Shopee.");
    }
  }

  return (
    <Button
      variant="outline"
      className="h-11 gap-1.5 px-4"
      onClick={handleCopy}
    >
      <Copy className="size-4" aria-hidden />
      Copiar link
    </Button>
  );
}
