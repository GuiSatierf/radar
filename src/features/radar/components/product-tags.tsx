import type { ReactElement } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function ProductTags(props: {
  product: { hasExtraCommission: boolean; hasFreeSample: boolean };
  className?: string;
}): ReactElement | null {
  const tags = [
    props.product.hasExtraCommission ? "Comissão extra" : null,
    props.product.hasFreeSample ? "Amostra grátis" : null,
  ].filter((tag) => tag != null);

  if (tags.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap gap-1", props.className)}>
      {tags.map((tag) => (
        <Badge
          key={tag}
          variant="secondary"
          className="bg-accent text-accent-foreground"
        >
          {tag}
        </Badge>
      ))}
    </div>
  );
}
