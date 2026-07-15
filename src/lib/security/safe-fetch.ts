import { promises as dns } from "dns";

/**
 * Hardened URL-fetching service with comprehensive SSRF protections.
 *
 * Defenses:
 * 1. Permit only HTTP and HTTPS schemes
 * 2. Reject URLs containing credentials (user:pass@host)
 * 3. Resolve DNS and reject private/loopback/link-local/multicast/reserved addresses
 * 4. Block cloud metadata endpoints (169.254.169.254, fd00:ec2::254, etc.)
 * 5. Revalidate every redirect destination (no auto-follow)
 * 6. Limit redirect count (default 5)
 * 7. Apply connection and response timeouts via AbortSignal
 * 8. Stream with a maximum byte limit
 * 9. Validate content types before processing
 */

export interface SafeFetchOptions {
  /** Maximum redirects to follow. Default: 5 */
  maxRedirects?: number;
  /** Connection + response timeout in ms. Default: 15_000 */
  timeoutMs?: number;
  /** Maximum response body size in bytes. Default: 5_000_000 (5MB) */
  maxBytes?: number;
  /** Allowed content types. If set, rejects responses with other content types. */
  allowedContentTypes?: string[];
  /** Custom headers to send with the request. */
  headers?: Record<string, string>;
  /** User-Agent string. */
  userAgent?: string;
}

export interface SafeFetchResult {
  ok: boolean;
  status: number;
  statusText: string;
  headers: Headers;
  /** The final URL after all redirects. */
  finalUrl: string;
  /** Read the response body as text (respecting maxBytes). */
  text(): Promise<string>;
  /** Read the response body as ArrayBuffer (respecting maxBytes). */
  arrayBuffer(): Promise<ArrayBuffer>;
  /** Get the Content-Type header. */
  contentType: string;
}

export class SsrfError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SsrfError";
  }
}

// Cloud metadata endpoints and known internal addresses to block
const BLOCKED_HOSTS = new Set([
  "169.254.169.254", // AWS/GCP/Azure metadata
  "fd00:ec2::254",   // AWS IPv6 metadata
  "metadata.google.internal", // GCP metadata
  "metadata.aws.internal",    // AWS metadata
]);

// Private/reserved IPv4 ranges (CIDR notation)
const PRIVATE_IPV4_RANGES: [number, number][] = [
  [0x00000000, 0xFFFFFFFF],   // 0.0.0.0/8 — reserved
  [0x0A000000, 0x0AFFFFFF],   // 10.0.0.0/8 — private
  [0x7F000000, 0x7FFFFFFF],   // 127.0.0.0/8 — loopback
  [0xA9FE0000, 0xA9FEFFFF],   // 169.254.0.0/16 — link-local
  [0xAC100000, 0xAC1FFFFF],   // 172.16.0.0/12 — private
  [0xC0A80000, 0xC0A8FFFF],   // 192.168.0.0/16 — private
  [0xC6120000, 0xC612FFFF],   // 198.18.0.0/15 — benchmarking
  [0xC6336400, 0xC63364FF],   // 198.51.100.0/24 — documentation
  [0xCB007100, 0xCB0071FF],   // 203.0.113.0/24 — documentation
  [0xE0000000, 0xFFFFFFFF],   // 224.0.0.0/4 — multicast
  [0xF0000000, 0xFFFFFFFF],   // 240.0.0.0/4 — reserved
];

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let result = 0;
  for (const part of parts) {
    const n = parseInt(part, 10);
    if (isNaN(n) || n < 0 || n > 255) return null;
    result = (result << 8) | n;
  }
  return result >>> 0; // unsigned
}

function isPrivateIPv4(ip: string): boolean {
  const int = ipv4ToInt(ip);
  if (int === null) return false;
  return PRIVATE_IPV4_RANGES.some(([start, end]) => int >= start && int <= end);
}

function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  // ::1 loopback
  if (lower === "::1") return true;
  // fc00::/7 — unique local
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true;
  // fe80::/10 — link-local
  if (lower.startsWith("fe80:") || lower.startsWith("fe90:") || 
      lower.startsWith("fea0:") || lower.startsWith("feb0:")) return true;
  // ff00::/8 — multicast
  if (lower.startsWith("ff")) return true;
  // :: — unspecified
  if (lower === "::" || lower === "0:0:0:0:0:0:0:0") return true;
  return false;
}

function isPrivateAddress(ip: string): boolean {
  // IPv6 in brackets
  const clean = ip.replace(/^\[|\]$/g, "");
  
  // Check if it's IPv4 or IPv6
  if (clean.includes(":")) {
    return isPrivateIPv6(clean);
  }
  return isPrivateIPv4(clean);
}

/**
 * Validates a URL for SSRF safety. Throws SsrfError if the URL is unsafe.
 */
async function validateUrl(urlStr: string): Promise<URL> {
  // 1. Scheme check
  if (!/^https?:\/\//i.test(urlStr)) {
    throw new SsrfError("Only HTTP and HTTPS URLs are allowed.");
  }

  let parsed: URL;
  try {
    parsed = new URL(urlStr);
  } catch {
    throw new SsrfError("Invalid URL.");
  }

  // 2. Reject credentials in URL
  if (parsed.username || parsed.password) {
    throw new SsrfError("URLs with credentials are not allowed.");
  }

  // 3. Check blocked hosts
  if (BLOCKED_HOSTS.has(parsed.hostname.toLowerCase())) {
    throw new SsrfError("That host is not allowed.");
  }

  // 4. Quick regex check for obvious private hosts
  if (/^(localhost|127\.|0\.0\.0\.0|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(parsed.hostname)) {
    throw new SsrfError("That host is not allowed.");
  }

  // 5. DNS resolution and IP validation
  // For IPs already in the hostname, check directly
  const isDirectIP = /^\[?[0-9a-fA-F:.]+\]?$/.test(parsed.hostname);
  
  if (isDirectIP) {
    if (isPrivateAddress(parsed.hostname)) {
      throw new SsrfError("That host is not allowed.");
    }
  } else {
    // Resolve DNS and check all resolved addresses
    let addresses: string[];
    try {
      const result = await dns.resolve4(parsed.hostname);
      addresses = result;
      // Also try IPv6
      try {
        const v6 = await dns.resolve6(parsed.hostname);
        addresses = [...addresses, ...v6];
      } catch {
        // May not have AAAA records — that's fine
      }
    } catch {
      throw new SsrfError("Could not resolve the hostname.");
    }

    for (const addr of addresses) {
      if (isPrivateAddress(addr)) {
        throw new SsrfError("That host is not allowed.");
      }
    }
  }

  return parsed;
}

/**
 * Hardened fetch with SSRF protections. Handles redirects manually to
 * revalidate each destination.
 */
export async function safeFetch(
  urlStr: string,
  options: SafeFetchOptions = {},
): Promise<SafeFetchResult> {
  const {
    maxRedirects = 5,
    timeoutMs = 15_000,
    maxBytes = 5_000_000,
    allowedContentTypes,
    headers = {},
    userAgent = "ProfJohns/1.0 (research assistant; +https://profjohns.com)",
  } = options;

  let currentUrl = urlStr;
  let redirectCount = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    // Validate the URL (SSRF check) before every fetch, including redirects
    const validated = await validateUrl(currentUrl);

    // Set up timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(validated.toString(), {
        headers: {
          "User-Agent": userAgent,
          ...headers,
        },
        redirect: "manual", // Handle redirects ourselves
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Handle redirects
      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get("location");
        if (!location) {
          throw new SsrfError("Redirect response missing Location header.");
        }

        redirectCount++;
        if (redirectCount > maxRedirects) {
          throw new SsrfError(`Too many redirects (max ${maxRedirects}).`);
        }

        // Resolve relative redirect URLs
        currentUrl = new URL(location, validated.toString()).toString();
        continue;
      }

      if (!res.ok) {
        return {
          ok: false,
          status: res.status,
          statusText: res.statusText,
          headers: res.headers,
          finalUrl: validated.toString(),
          contentType: res.headers.get("content-type") ?? "",
          text: async () => {
            const reader = res.body?.getReader();
            if (!reader) return "";
            return readStream(reader, maxBytes);
          },
          arrayBuffer: async () => {
            const reader = res.body?.getReader();
            if (!reader) return new ArrayBuffer(0);
            const text = await readStream(reader, maxBytes);
            return new TextEncoder().encode(text).buffer;
          },
        };
      }

      const contentType = res.headers.get("content-type") ?? "";

      // Content type validation
      if (allowedContentTypes && allowedContentTypes.length > 0) {
        const isAllowed = allowedContentTypes.some((ct) =>
          contentType.toLowerCase().includes(ct.toLowerCase()),
        );
        if (!isAllowed) {
          throw new SsrfError(
            `Unexpected content type: ${contentType}. Expected one of: ${allowedContentTypes.join(", ")}.`,
          );
        }
      }

      return {
        ok: true,
        status: res.status,
        statusText: res.statusText,
        headers: res.headers,
        finalUrl: validated.toString(),
        contentType,
        text: async () => {
          const reader = res.body?.getReader();
          if (!reader) return "";
          return readStream(reader, maxBytes);
        },
        arrayBuffer: async () => {
          const reader = res.body?.getReader();
          if (!reader) return new ArrayBuffer(0);
          const text = await readStream(reader, maxBytes);
          return new TextEncoder().encode(text).buffer;
        },
      };
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof SsrfError) throw error;
      if (error instanceof Error && error.name === "AbortError") {
        throw new SsrfError("Request timed out.");
      }
      throw new SsrfError(
        error instanceof Error ? error.message : "Fetch failed.",
      );
    }
  }
}

/**
 * Reads a stream with a maximum byte limit. Throws if the limit is exceeded.
 */
async function readStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  maxBytes: number,
): Promise<string> {
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;

    totalBytes += value.byteLength;
    if (totalBytes > maxBytes) {
      throw new SsrfError(`Response exceeds the ${maxBytes} byte limit.`);
    }
    chunks.push(value);
  }

  const total = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    total.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(total);
}
