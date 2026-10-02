"use client";

import * as React from "react";
import { ImageBroken } from "@phosphor-icons/react";
import type { CardDataFor } from "@/lib/board/schema";
import { useFigureUrl } from "@/lib/figure-storage";
import { SourceCitation } from "./source-citation";
import { TextCardBody } from "./text-card";

interface FigureCardBodyProps {
  readonly data: CardDataFor["figure"];
  readonly onCaption: (caption: string) => void;
  readonly onOpenSource?: () => void;
}

/** The stored image, its shape reserved before it loads (no layout shift). */
export function FigureImage({ image, alt }: { readonly image: CardDataFor["figure"]["image"]; readonly alt: string }) {
  const { url, error } = useFigureUrl(image);
  const { width, height } = image;
  return (
    <div
      className="overflow-hidden rounded-md border border-grey-200 bg-white"
      style={width && height ? { aspectRatio: `${width} / ${height}` } : undefined}
    >
      {url ? (
        // Signed storage URLs are short-lived, so next/image caching doesn't apply.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={alt} width={width} height={height} loading="lazy" className="block size-full object-contain" />
      ) : (
        <div className="grid size-full min-h-24 place-items-center gap-1 p-3 text-center text-xs text-grey-600">
          {error ? (
            <>
              <ImageBroken className="size-5" />
              {error}
            </>
          ) : (
            "Loading image…"
          )}
        </div>
      )}
    </div>
  );
}

/** Alt text: the caption, else where the figure comes from. */
export const figureAlt = (data: CardDataFor["figure"]) =>
  data.caption || (data.source ? `Figure from ${data.source.title}` : "Figure");

/** A figure: the image, an editable caption, and where it comes from. */
export function FigureCardBody({ data, onCaption, onOpenSource }: FigureCardBodyProps) {
  return (
    <>
      <FigureImage image={data.image} alt={figureAlt(data)} />
      <div className="mt-2">
        <TextCardBody ariaLabel="Figure caption" value={data.caption} placeholder="Add a caption…" onSave={onCaption} />
      </div>
      {data.source && <SourceCitation source={data.source} page={data.page} onOpen={onOpenSource} />}
    </>
  );
}
