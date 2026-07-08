"use client";

import * as React from "react";
import Link from "next/link";
import {
  FileText,
  BookOpen,
  Link as Link2,
  Image as ImageIcon,
  Quotes as Quote,
  Check,
  ArrowSquareOut as ExternalLink,
  FolderOpen,
  type Icon,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { formatCitation } from "@/lib/project-library";
import type { AccountLibraryItem, LibraryKind } from "@/lib/account-library";

const KIND_META: Record<
  LibraryKind,
  { label: string; icon: Icon; accent: string }
> = {
  document: { label: "Document", icon: FileText, accent: "var(--color-node-writing)" },
  source: { label: "Source", icon: BookOpen, accent: "var(--color-node-reader)" },
  link: { label: "Link", icon: Link2, accent: "var(--color-node-link)" },
  media: { label: "Media", icon: ImageIcon, accent: "var(--color-node-media)" },
};

export function LibraryCard({ item }: { item: AccountLibraryItem }) {
  const meta = KIND_META[item.kind];
  const Icon = meta.icon;
  const [copied, setCopied] = React.useState(false);

  function cite() {
    if (!item.source) return;
    navigator.clipboard?.writeText(formatCitation(item.source)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    });
  }

  const hasThumb = (item.kind === "media" || item.kind === "link") && !!item.thumb;

  return (
    <article
      style={{ "--accent": meta.accent } as React.CSSProperties}
      className="group flex flex-col overflow-hidden rounded-xl border border-grey-200 bg-paper shadow-sm transition-colors duration-200 hover:border-grey-300"
    >
      {hasThumb && (
        <div className="relative h-32 w-full overflow-hidden bg-grey-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.thumb}
            alt=""
            loading="lazy"
            className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
          <span className="absolute left-2.5 top-2.5 flex items-center gap-1 rounded-md border border-grey-200 bg-paper px-1.5 py-0.5 text-[10px] font-medium text-grey-600 shadow-sm">
            <Icon className="size-3" style={{ color: meta.accent }} />
            {meta.label}
          </span>
        </div>
      )}

      <div className="flex flex-1 flex-col p-4">
        {!hasThumb && (
          <div className="mb-2 flex items-center gap-1.5">
            <span
              className="grid size-6 place-items-center rounded-md"
              style={{ backgroundColor: `color-mix(in oklab, ${meta.accent} 14%, transparent)` }}
            >
              <Icon className="size-3.5" style={{ color: meta.accent }} />
            </span>
            <span className="text-[10px] font-medium uppercase tracking-wider text-grey-400">
              {meta.label}
            </span>
          </div>
        )}

        <p className="line-clamp-2 text-[13px] font-semibold leading-snug tracking-tight text-ink">
          {item.title}
        </p>
        {item.subtitle && (
          <p className="mt-1 line-clamp-1 text-[11px] text-grey-400">{item.subtitle}</p>
        )}
        {item.snippet && !hasThumb && (
          <p className="mt-1.5 line-clamp-2 flex-1 text-[11.5px] leading-relaxed text-grey-500">
            {item.snippet}
          </p>
        )}

        {/* Project provenance — where this item lives. */}
        <div className="mt-3 flex flex-wrap items-center gap-1">
          {item.projects.slice(0, 2).map((p) => (
            <span
              key={p.id}
              className="flex max-w-[140px] items-center gap-1 rounded-full bg-grey-100 px-2 py-0.5 text-[10px] font-medium text-grey-600"
            >
              <FolderOpen className="size-2.5 shrink-0 text-grey-400" />
              <span className="truncate">{p.name}</span>
            </span>
          ))}
          {item.projects.length > 2 && (
            <span className="rounded-full bg-grey-100 px-2 py-0.5 text-[10px] font-medium text-grey-500">
              +{item.projects.length - 2}
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="nodrag mt-3 flex items-center gap-1 border-t border-grey-100 pt-2.5">
          {item.kind === "document" && item.href && (
            <Link
              href={item.href}
              className="flex items-center gap-1 rounded-md border border-grey-200 px-2 py-1 text-[10.5px] font-medium text-grey-600 transition-colors hover:bg-grey-50 hover:text-ink"
            >
              <FileText className="size-3" />
              Open
            </Link>
          )}
          {item.source && (
            <button
              onClick={cite}
              className="flex items-center gap-1 rounded-md border border-grey-200 px-2 py-1 text-[10.5px] font-medium text-grey-600 transition-colors hover:bg-grey-50 hover:text-ink"
            >
              {copied ? (
                <Check className="size-3 text-emerald-600" />
              ) : (
                <Quote className="size-3" />
              )}
              {copied ? "Copied" : "Cite"}
            </button>
          )}
          {item.url && (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 rounded-md px-2 py-1 text-[10.5px] font-medium text-grey-500 transition-colors hover:bg-grey-100 hover:text-ink"
            >
              <ExternalLink className="size-3" />
              Open
            </a>
          )}
        </div>
      </div>
    </article>
  );
}
