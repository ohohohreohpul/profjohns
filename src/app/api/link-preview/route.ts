import { NextRequest, NextResponse } from "next/server";
import { safeFetch, SsrfError } from "@/lib/security/safe-fetch";
import { requireUser, authErrorResponse, AuthError } from "@/lib/auth/server-auth";
import { canUseLocalMode } from "@/lib/config/env";
import { checkRateLimits, getClientIP, RATE_LIMITS } from "@/lib/security/rate-limit";

/**
 * Fetches a web URL and returns Open Graph / meta preview data for the canvas
 * Link node (FigJam-style card): title, description, image, site name, favicon,
 * published date. Full article text is a separate concern — the node's "Make
 * readable" action calls /api/readable for that.
 *
 * Protected by authentication, rate limiting, and SSRF-safe fetching.
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
  // Authentication
  let userId: string;
  try {
    if (canUseLocalMode()) {
      userId = "local-user";
    } else {
      const user = await requireUser();
      userId = user.id;
    }
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error) as NextResponse<ApiResponse<LinkPreview>>;
    throw error;
  }

  // Rate limiting
  const ip = getClientIP(request);
  const rateResult = checkRateLimits(userId, ip, "/api/link-preview", RATE_LIMITS.readable);
  if (!rateResult.allowed) {
    return NextResponse.json(
      { success: false, data: null, error: "Rate limit exceeded. Please slow down." },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil((rateResult.resetAt - Date.now()) / 1000)) },
      },
    );
  }

  const url = request.nextUrl.searchParams.get("url")?.trim() ?? "";

  if (!url || !/^https?:\/\//i.test(url)) {
    return NextResponse.json(
      { success: false, data: null, error: "A valid http(s) URL is required." },
      { status: 400 },
    );
  }

  try {
    const res = await safeFetch(url, {
      timeoutMs: 10_000,
      maxBytes: 600_000, // 600KB max for HTML preview
      allowedContentTypes: ["text/html", "application/xhtml+xml"],
    });

    if (!res.ok) {
      return NextResponse.json(
        { success: false, data: null, error: `Source responded with ${res.status}.` },
        { status: 502 },
      );
    }

    const resolved = new URL(res.finalUrl);
    const html = await res.text();

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
    const message = error instanceof SsrfError
      ? error.message
      : "Failed to fetch the preview.";

    return NextResponse.json(
      { success: false, data: null, error: message },
      { status: error instanceof SsrfError ? 400 : 502 },
    );
  }
}
