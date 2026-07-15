"use client";

import * as React from "react";
import Link from "next/link";
import { Graph as Network, Books as Library, Image as ImageIcon, Link as Link2, ArrowUpRight } from "@phosphor-icons/react";
import { useWorkspaceStore } from "@/store/workspace-store";
import { InlineEdit } from "@/components/ui/inline-edit";
import { cn } from "@/lib/utils";

type SpaceTab = "canvases" | "library" | "media" | "links";

const TABS: readonly { key: SpaceTab; label: string; href: string; icon: typeof Network }[] = [
  { key: "canvases", label: "Canvases", href: "/canvases", icon: Network },
  { key: "library", label: "Library", href: "/library", icon: Library },
  { key: "media", label: "Media", href: "/media", icon: ImageIcon },
  { key: "links", label: "Links", href: "/links", icon: Link2 },
];

/**
 * A project opens as a Space: one header with the project name + tabs across
 * its surfaces, so Canvases/Library/Media/Links read as a single place.
 */
export function SpaceLayout({
  active,
  projectId,
  children,
}: {
  active: SpaceTab;
  projectId: string;
  children: React.ReactNode;
}) {
  const project = useWorkspaceStore((s) =>
    s.projects.find((p) => p.id === projectId),
  );
  const updateProject = useWorkspaceStore((s) => s.updateProject);
  const latestCanvas = useWorkspaceStore((s) =>
    s.canvases
      .filter((c) => c.projectId === projectId)
      .sort((a, b) => b.updatedAt - a.updatedAt)[0],
  );
  const q = projectId ? `?project=${projectId}` : "";

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-14 shrink-0 items-center gap-5 border-b border-grey-200 bg-paper px-6">
        <InlineEdit
          value={project?.name ?? ""}
          onCommit={(name) => updateProject(projectId, { name })}
          placeholder="Untitled project"
        />
        <nav className="flex min-w-0 items-center gap-1">
          {TABS.map((t) => {
            const Icon = t.icon;
            const isActive = t.key === active;
            return (
              <Link
                key={t.key}
                href={`${t.href}${q}`}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition-colors",
                  isActive
                    ? "bg-grey-100 text-ink"
                    : "text-grey-500 hover:bg-grey-50 hover:text-ink",
                )}
              >
                <Icon className="size-[15px]" />
                {t.label}
              </Link>
            );
          })}
        </nav>
        {latestCanvas && (
          <Link
            href={`/canvas?project=${projectId}&canvas=${latestCanvas.id}`}
            className="ml-auto flex shrink-0 items-center gap-1.5 rounded-lg bg-ink px-3 py-1.5 text-[12px] font-semibold text-paper transition-colors hover:bg-grey-800"
          >
            Open board
            <ArrowUpRight className="size-3.5" />
          </Link>
        )}
      </header>
      <div className="min-h-0 flex-1 overflow-auto p-6">{children}</div>
    </div>
  );
}
