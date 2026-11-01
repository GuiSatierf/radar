"use client";

import { type ReactElement, useState } from "react";
import { cn } from "@/lib/utils";
import { ProductImage } from "./product-image";

export function ProductGallery(props: {
  imageUrls: readonly string[];
  name: string;
}): ReactElement {
  const [selected, setSelected] = useState(0);
  const current = props.imageUrls[selected] ?? null;

  return (
    <div className="flex flex-col gap-2">
      <ProductImage
        url={current}
        alt={props.name}
        sizes="(min-width: 1024px) 40vw, 100vw"
        className="aspect-square w-full rounded-2xl"
      />

      {props.imageUrls.length > 1 && (
        <div className="flex gap-2 overflow-x-auto">
          {props.imageUrls.map((url, index) => (
            <button
              key={url}
              type="button"
              aria-label={`Ver foto ${index + 1}`}
              aria-pressed={index === selected}
              onClick={() => setSelected(index)}
              className={cn(
                "size-16 shrink-0 overflow-hidden rounded-lg",
                index === selected && "outline-2 outline-primary",
              )}
            >
              <ProductImage
                url={url}
                alt=""
                sizes="64px"
                className="size-full"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
