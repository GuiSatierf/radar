import { Package } from "lucide-react";
import Image from "next/image";
import type { ReactElement } from "react";
import { cn } from "@/lib/utils";

/** The product photo, or a plain placeholder when the source has none (the demo data never has). */
export function ProductImage(props: {
  url: string | null;
  alt: string;
  className?: string;
  sizes: string;
}): ReactElement {
  if (props.url == null) {
    return (
      <div
        role="img"
        aria-label={`${props.alt} (sem foto)`}
        className={cn(
          "flex items-center justify-center bg-muted text-muted-foreground",
          props.className,
        )}
      >
        <Package className="size-8 opacity-60" aria-hidden />
      </div>
    );
  }

  return (
    <div className={cn("relative overflow-hidden bg-muted", props.className)}>
      <Image
        src={props.url}
        alt={props.alt}
        fill
        sizes={props.sizes}
        className="object-cover"
        unoptimized
      />
    </div>
  );
}
