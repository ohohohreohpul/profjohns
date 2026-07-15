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
  Binoculars as Telescope,
  SidebarSimple as PanelLeftClose,
  List as MenuIcon,
  X,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { ProfJohnsLogo } from "@/components/brand/profjohns-logo";
import { useAuth } from "@/lib/auth/auth-context";
import { useAuthActions } from "@/lib/auth/auth-actions";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Gear, SignOut } from "@phosphor-icons/react";
import Image from "next/image";

export type SurfaceKey =
  | "discover"
  | "spaces"
  | "canvases"
  | "library"
  | "media"
  | "links"
  | "agents"
  | "mcp"
  | "watch"
  | "account";

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
  { key: "watch", label: "Watch", href: "/watch", icon: Telescope },
  { key: "agents", label: "Agents", href: "/agents", icon: Bot },
  { key: "mcp", label: "Connectors", href: "/mcp", icon: Plug },
];

export function WorkspaceSidebar({ active }: { active: SurfaceKey }) {
  const { user, enabled: authEnabled } = useAuth();
  const { signOut } = useAuthActions();

  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const initial = user?.email?.[0]?.toUpperCase() ?? "?";

  // Close mobile drawer on Escape
  React.useEffect(() => {
    if (!mobileOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [mobileOpen]);

  const sidebarContent = (
    <>
      {/* Header: logo + collapse (desktop only) */}
      <div className="flex h-16 shrink-0 items-center gap-0 px-4">
        <ProfJohnsLogo size={64} className="shrink-0 -mr-1" />
        {!collapsed && (
          <object
            data="/profjohns-text.svg"
            type="image/svg+xml"
            className="h-[24px] w-auto"
            aria-label="ProfJohns"
          />
        )}
        <button
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
          onClick={() => setCollapsed((c) => !c)}
          className="ml-auto grid size-7 place-items-center rounded-md text-grey-400 transition-colors hover:bg-grey-200/60 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          <PanelLeftClose className={cn("size-4 transition-transform", collapsed && "rotate-180")} />
        </button>
      </div>

      {/* New research CTA */}
      <div className="px-3 pb-2 pt-1">
        <Link
          href="/"
          className="flex items-center gap-2.5 rounded-lg border border-grey-200 bg-paper px-3 py-2.5 text-[13.5px] font-semibold text-ink shadow-sm transition-colors hover:bg-grey-50"
        >
          <Plus className="size-[18px] shrink-0" />
          {!collapsed && "New research"}
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex flex-col gap-0.5 px-3 py-1" aria-label="Main navigation">
        {NAV.map((item) => {
          const Icon = item.icon;
          const isActive = item.key === active;
          return (
            <Link
              key={item.key}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13.5px] font-medium transition-colors",
                collapsed && "justify-center px-2",
                isActive
                  ? "bg-grey-200/70 text-ink"
                  : "text-grey-600 hover:bg-grey-200/50 hover:text-ink",
              )}
            >
              <Icon className="size-[17px] shrink-0" />
              {!collapsed && item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer: account */}
      <div className="mt-auto flex flex-col gap-0.5 px-3 pb-3">
        {authEnabled && user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                data-testid="sidebar-account-trigger"
                aria-label="Account menu"
                className={cn(
                  "mt-1 flex w-full items-center gap-2.5 rounded-xl border border-grey-200 bg-paper px-3 py-2 text-[13px] font-medium text-grey-700 outline-none transition-colors hover:bg-grey-50 focus-visible:border-grey-400",
                  collapsed && "justify-center px-2",
                )}
              >
                {user.user_metadata?.avatar_url ? (
                  <Image
                    src={user.user_metadata.avatar_url}
                    alt=""
                    width={24}
                    height={24}
                    className="size-6 shrink-0 rounded-full"
                  />
                ) : (
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-grey-200 text-[11px] font-semibold text-grey-600">
                    {initial}
                  </span>
                )}
                {!collapsed && (
                  <span className="min-w-0 flex-1 truncate text-left">{user.email}</span>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[228px]">
              <DropdownMenuItem asChild>
                <Link href="/account" data-testid="menu-account-settings">
                  <Gear className="size-4 text-grey-500" />
                  Account settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => signOut()}
                data-testid="menu-sign-out"
                className="text-red-600 data-[highlighted]:bg-red-50"
              >
                <SignOut className="size-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : authEnabled ? (
          <Link
            href="/login"
            className={cn(
              "mt-1 flex items-center gap-2.5 rounded-xl border border-grey-200 bg-paper px-3 py-2 text-[13px] font-medium text-grey-700 transition-colors hover:bg-grey-50",
              collapsed && "justify-center px-2",
            )}
          >
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-grey-200 text-[11px] font-semibold text-grey-600">
              T
            </span>
            {!collapsed && "Sign in"}
          </Link>
        ) : (
          <div
            className={cn(
              "mt-1 flex items-center gap-2.5 rounded-xl border border-grey-200 bg-paper px-3 py-2 text-[13px] font-medium text-grey-700",
              collapsed && "justify-center px-2",
            )}
          >
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-grey-200 text-[11px] font-semibold text-grey-600">
              T
            </span>
            {!collapsed && "Local mode"}
          </div>
        )}
      </div>
    </>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden shrink-0 flex-col border-r border-grey-200 bg-grey-50 transition-[width] duration-200 md:flex",
          collapsed ? "w-[64px]" : "w-[260px]",
        )}
        aria-label="Sidebar"
      >
        {sidebarContent}
      </aside>

      {/* Mobile hamburger button (fixed top-left) */}
      <button
        aria-label="Open menu"
        aria-expanded={mobileOpen}
        onClick={() => setMobileOpen(true)}
        className="fixed left-3 top-3 z-40 grid size-10 place-items-center rounded-lg border border-grey-200 bg-paper text-grey-600 shadow-sm md:hidden"
      >
        <MenuIcon className="size-5" />
      </button>

      {/* Mobile drawer */}
      {mobileOpen && (
        <>
          {/* Scrim */}
          <div
            className="fixed inset-0 z-40 bg-black/30 md:hidden"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />

          {/* Drawer */}
          <aside
            className="fixed left-0 top-0 z-50 flex h-dvh w-[280px] max-w-[85vw] flex-col border-r border-grey-200 bg-grey-50 md:hidden"
            aria-label="Mobile sidebar"
            role="dialog"
            aria-modal="true"
          >
            {/* Close button */}
            <button
              aria-label="Close menu"
              onClick={() => setMobileOpen(false)}
              className="absolute right-2 top-4 grid size-8 place-items-center rounded-md text-grey-400 hover:bg-grey-200/60 hover:text-ink"
            >
              <X className="size-5" />
            </button>
            {sidebarContent}
          </aside>
        </>
      )}
    </>
  );
}
