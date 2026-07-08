"use client";

import * as React from "react";
import Link from "next/link";
import {
  Plus,
  Compass,
  Stack as Layers,
  Books as Library,
  Robot as Bot,
  Plug,
  Clock,
  SidebarSimple as PanelLeftClose,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { ProfJohnsLogo } from "@/components/brand/profjohns-logo";
import { useAuth } from "@/lib/auth/auth-context";
import { useAuthActions } from "@/lib/auth/auth-actions";
import Image from "next/image";

export type SurfaceKey =
  | "discover"
  | "spaces"
  | "canvases"
  | "library"
  | "media"
  | "links"
  | "agents"
  | "mcp";

interface NavItem {
  key: SurfaceKey;
  label: string;
  href: string;
  icon: typeof Compass;
}

const NAV: readonly NavItem[] = [
  { key: "discover", label: "Discover", href: "/", icon: Compass },
  { key: "spaces", label: "Spaces", href: "/spaces", icon: Layers },
  { key: "library", label: "Readroom", href: "/library", icon: Library },
  { key: "agents", label: "Agents", href: "/agents", icon: Bot },
  { key: "mcp", label: "Connectors", href: "/mcp", icon: Plug },
];

export function WorkspaceSidebar({ active }: { active: SurfaceKey }) {
  const { user, enabled: authEnabled } = useAuth();
  const { signOut } = useAuthActions();

  const initial = user?.email?.[0]?.toUpperCase() ?? "?";

  return (
    <aside className="flex w-[260px] shrink-0 flex-col border-r border-grey-200 bg-grey-50">
      <div className="flex h-16 shrink-0 items-center gap-0 px-4">
        <ProfJohnsLogo size={64} className="shrink-0 -mr-1" />
        <object
          data="/profjohns-text.svg"
          type="image/svg+xml"
          className="h-[24px] w-auto"
          aria-label="ProfJohns"
        />
        <button
          aria-label="Collapse sidebar"
          className="ml-auto grid size-7 place-items-center rounded-md text-grey-400 transition-colors hover:bg-grey-200/60 hover:text-ink"
        >
          <PanelLeftClose className="size-4" />
        </button>
      </div>

      <div className="px-3 pb-2 pt-1">
        <Link
          href="/"
          className="flex items-center gap-2.5 rounded-lg border border-grey-200 bg-paper px-3 py-2.5 text-[13.5px] font-semibold text-ink shadow-sm transition-colors hover:bg-grey-50"
        >
          <Plus className="size-[18px]" />
          New research
        </Link>
      </div>

      <nav className="flex flex-col gap-0.5 px-3 py-1">
        {NAV.map((item) => {
          const Icon = item.icon;
          const isActive = item.key === active;
          return (
            <Link
              key={item.key}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13.5px] font-medium transition-colors",
                isActive
                  ? "bg-grey-200/70 text-ink"
                  : "text-grey-600 hover:bg-grey-200/50 hover:text-ink",
              )}
            >
              <Icon className="size-[17px] shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-0.5 px-3 pb-3">
        <button className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium text-grey-500 transition-colors hover:bg-grey-200/50 hover:text-ink">
          <Clock className="size-[17px] shrink-0" />
          History
        </button>
        {authEnabled && user ? (
          <button
            onClick={() => signOut()}
            className="mt-1 flex items-center gap-2.5 rounded-xl border border-grey-200 bg-paper px-3 py-2 text-[13px] font-medium text-grey-700 transition-colors hover:bg-grey-50"
          >
            {user.user_metadata?.avatar_url ? (
              <Image
                src={user.user_metadata.avatar_url}
                alt=""
                width={24}
                height={24}
                className="size-6 rounded-full"
              />
            ) : (
              <span className="grid size-6 place-items-center rounded-full bg-grey-200 text-[11px] font-semibold text-grey-600">
                {initial}
              </span>
            )}
            <span className="min-w-0 truncate">{user.email}</span>
          </button>
        ) : authEnabled ? (
          <Link
            href="/login"
            className="mt-1 flex items-center gap-2.5 rounded-xl border border-grey-200 bg-paper px-3 py-2 text-[13px] font-medium text-grey-700 transition-colors hover:bg-grey-50"
          >
            <span className="grid size-6 place-items-center rounded-full bg-grey-200 text-[11px] font-semibold text-grey-600">
              T
            </span>
            Sign in
          </Link>
        ) : (
          <div className="mt-1 flex items-center gap-2.5 rounded-xl border border-grey-200 bg-paper px-3 py-2 text-[13px] font-medium text-grey-700">
            <span className="grid size-6 place-items-center rounded-full bg-grey-200 text-[11px] font-semibold text-grey-600">
              T
            </span>
            Local mode
          </div>
        )}
      </div>
    </aside>
  );
}
