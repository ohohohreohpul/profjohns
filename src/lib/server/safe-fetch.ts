import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * Server-side fetch for user-supplied URLs (SSRF guard).
 *
 * Refuses non-http(s) schemes and any host that resolves to a private,
 * loopback, link-local, CGNAT, multicast or cloud-metadata address, re-checks
 * every redirect hop, and caps size and time. Known limit: the fetch resolves
 * the name again, so a DNS-rebinding attacker could still race the check;
 * pinning the connection to the checked IP would close that.
 */

const MAX_REDIRECTS = 5;

export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeUrlError";
  }
}

function ipv4Parts(ip: string): number[] | null {
  const parts = ip.split(".").map(Number);
  return parts.length === 4 && parts.every((p) => Number.isInteger(p) && p >= 0 && p <= 255) ? parts : null;
}

function isPublicIPv4(ip: string): boolean {
  const p = ipv4Parts(ip);
  if (!p) return false;
  const [a, b] = p;
  if (a === 0 || a === 10 || a === 127) return false; // this-net, private, loopback
  if (a === 169 && b === 254) return false; // link-local + cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return false; // private
  if (a === 192 && b === 168) return false; // private
  if (a === 100 && b >= 64 && b <= 127) return false; // CGNAT
  if (a === 192 && b === 0) return false; // IETF protocol assignments
  if (a >= 224) return false; // multicast + reserved
  return true;
}

/** True only for globally routable unicast addresses. */
export function isPublicAddress(ip: string): boolean {
  const family = isIP(ip);
  if (family === 4) return isPublicIPv4(ip);
  if (family !== 6) return false;
  const lower = ip.toLowerCase();
  const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPublicIPv4(mapped[1]);
  if (lower === "::" || lower === "::1") return false;
  if (/^f[cd]/.test(lower)) return false; // unique local fc00::/7
  if (/^fe[89ab]/.test(lower)) return false; // link-local fe80::/10
  if (/^ff/.test(lower)) return false; // multicast
  return true;
}

/** Throws UnsafeUrlError unless `raw` is http(s) and every resolved address is public. */
export async function assertPublicUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnsafeUrlError("That link isn't a valid URL.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new UnsafeUrlError("Only http and https links can be opened.");
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(host)
    ? [host]
    : (await lookup(host, { all: true }).catch(() => [])).map((a) => a.address);
  if (addresses.length === 0 || !addresses.every(isPublicAddress)) {
    throw new UnsafeUrlError("That link points somewhere that can't be opened.");
  }
  return url;
}

export interface SafeFetchResult {
  readonly bytes: Uint8Array;
  readonly contentType: string;
  readonly finalUrl: string;
}

/** GET a public URL with redirect re-validation, a byte cap and a timeout. */
export async function safeFetch(
  raw: string,
  opts: { maxBytes: number; timeoutMs: number; headers?: Record<string, string> },
): Promise<SafeFetchResult> {
  let current = (await assertPublicUrl(raw)).toString();
  const signal = AbortSignal.timeout(opts.timeoutMs);

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const res = await fetch(current, { redirect: "manual", signal, headers: opts.headers });
    if (res.status >= 300 && res.status < 400) {
      const next = res.headers.get("location");
      if (!next) throw new UnsafeUrlError("The link redirected nowhere.");
      current = (await assertPublicUrl(new URL(next, current).toString())).toString();
      continue;
    }
    if (!res.ok) throw new Error(`Source responded with ${res.status}`);

    const declared = Number(res.headers.get("content-length") ?? 0);
    if (declared > opts.maxBytes) throw new UnsafeUrlError("That file is too large to open.");
    const reader = res.body?.getReader();
    if (!reader) throw new Error("Source returned no content.");
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > opts.maxBytes) {
        await reader.cancel();
        throw new UnsafeUrlError("That file is too large to open.");
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const c of chunks) {
      bytes.set(c, offset);
      offset += c.byteLength;
    }
    return { bytes, contentType: res.headers.get("content-type") ?? "", finalUrl: current };
  }
  throw new UnsafeUrlError("The link redirected too many times.");
}
