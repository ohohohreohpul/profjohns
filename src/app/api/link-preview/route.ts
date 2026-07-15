import { NextRequest, NextResponse } from "next/server";

/**
 * Fetches a web URL and returns Open Graph / meta preview data for the canvas
 * Link node (FigJam-style card): title, description, image, site name, favicon,
 * published date. Full article text is a separate concern — the node's "Make
 * readable" action calls /api/readable for that.
 */

interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: string | null;
}

export interface LinkPreview {
  url: string;
  resolvedUrl: string;
  title: string;
  description: string;
  image: string | null;
  siteName: string | null;
  favicon: string | null;
  publishedYear: number | null;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unexpected error";
}

const PRIVATE_HOST =
  /^(localhost|127\.|0\.0\.0\.0|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?|\[?fc00:|\[?fe80:)/i;

/**
 * Reject non-http(s) schemes and obvious internal targets before fetching
 * user-supplied URLs (SSRF guard). For production this should be paired with
 * DNS-resolution checks / an egress allowlist — see CLAUDE.md.
 */
function assertSafeUrl(raw: string): URL {
  if (!/^https?:\/\//i.test(raw)) {
    throw new Error("A valid http(s) URL is required.");
  }
  const parsed = new URL(raw);
  if (PRIVATE_HOST.test(parsed.hostname)) {
    throw new Error("That host is not allowed.");
  }
  return parsed;
}

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&#x2F;/g, "/")
    .trim();
}

/** Pull the content of the first matching <meta property|name="key"> tag. */
function metaContent(html: string, keys: string[]): string | null {
  for (const key of keys) {
    const esc = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(
      `<meta[^>]+(?:property|name)=["']${esc}["'][^>]*content=["']([^"']*)["']`,
      "i",
    );
    const alt = new RegExp(
      `<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${esc}["']`,
      "i",
    );
    const m = html.match(re) ?? html.match(alt);
    if (m?.[1]) return decodeEntities(m[1]);
  }
  return null;
}

function titleTag(html: string): string | null {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m?.[1] ? decodeEntities(m[1].replace(/\s+/g, " ")) : null;
}

function faviconHref(html: string): string | null {
  const m = html.match(
    /<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]*href=["']([^"']+)["']/i,
  );
  return m?.[1] ?? null;
}

function absolutize(href: string | null, base: URL): string | null {
  if (!href) return null;
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}

function publishedYear(html: string): number | null {
  const raw = metaContent(html, [
    "article:published_time",
    "og:article:published_time",
    "datePublished",
  ]);
  const year = raw ? Number(raw.slice(0, 4)) : NaN;
  return Number.isInteger(year) && year > 1990 && year < 2100 ? year : null;
}

export async function GET(
  request: NextRequest,
): Promise<NextResponse<ApiResponse<LinkPreview>>> {
  const url = request.nextUrl.searchParams.get("url")?.trim() ?? "";

  let safe: URL;
  try {
    safe = assertSafeUrl(url);
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, data: null, error: getErrorMessage(error) },
      { status: 400 },
    );
  }

  try {
    const res = await fetch(safe.toString(), {
      headers: { "User-Agent": "ProfJohns/0.1 (research canvas prototype)" },
      redirect: "follow",
    });
    if (!res.ok) throw new Error(`Source responded with ${res.status}`);

    const resolved = new URL(res.url || safe.toString());
    const html = (await res.text()).slice(0, 600_000);

    const title =
      metaContent(html, ["og:title", "twitter:title"]) ??
      titleTag(html) ??
      resolved.hostname;
    const description =
      metaContent(html, ["og:description", "twitter:description", "description"]) ??
      "";
    const siteName =
      metaContent(html, ["og:site_name"]) ?? resolved.hostname.replace(/^www\./, "");

    return NextResponse.json({
      success: true,
      data: {
        url,
        resolvedUrl: resolved.toString(),
        title,
        description,
        image: absolutize(
          metaContent(html, ["og:image", "twitter:image", "twitter:image:src"]),
          resolved,
        ),
        siteName,
        favicon:
          absolutize(faviconHref(html), resolved) ??
          `${resolved.origin}/favicon.ico`,
        publishedYear: publishedYear(html),
      },
      error: null,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, data: null, error: getErrorMessage(error) },
      { status: 502 },
    );
  }
}
