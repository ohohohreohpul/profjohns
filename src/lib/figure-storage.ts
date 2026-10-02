/**
 * Figure images: downscale in the browser, store in the user's private
 * Supabase folder (media/<uid>/figures/), and resolve to short-lived signed
 * URLs for display. Signed out (local development only): inline data URL.
 */
import * as React from "react";
import { createClient } from "@/lib/supabase/client";

export const MAX_FIGURE_DIM = 2000;
export const MAX_FIGURE_BYTES = 15 * 1024 * 1024;
const JPEG_QUALITY = 0.9;
const SIGNED_URL_SECONDS = 3600;
/** Refresh a signed URL this long before it expires. */
const SIGNED_URL_MARGIN_MS = 5 * 60 * 1000;

export class FigureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FigureError";
  }
}

export interface StoredImage {
  readonly path?: string;
  readonly src?: string;
  readonly width: number;
  readonly height: number;
}

export function isImageFile(file: Blob): boolean {
  return file.type.startsWith("image/");
}

/** Fit within MAX_FIGURE_DIM; PNG stays PNG (crisp charts), photos -> JPEG. */
async function downscale(blob: Blob): Promise<{ blob: Blob; width: number; height: number; ext: string }> {
  const bitmap = await createImageBitmap(blob);
  const ratio = Math.min(1, MAX_FIGURE_DIM / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * ratio);
  const height = Math.round(bitmap.height * ratio);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new FigureError("This browser can't process images.");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const png = blob.type === "image/png" || blob.type === "image/gif";
  const type = png ? "image/png" : "image/jpeg";
  const out = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, JPEG_QUALITY));
  if (!out) throw new FigureError("Couldn't process that image.");
  return { blob: out, width, height, ext: png ? "png" : "jpg" };
}

function toDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new FigureError("Couldn't read that image."));
    r.readAsDataURL(blob);
  });
}

export async function storeFigureImage(input: Blob): Promise<StoredImage> {
  if (!isImageFile(input)) throw new FigureError("That file isn't an image.");
  if (input.size > MAX_FIGURE_BYTES) throw new FigureError("That image is over 15 MB. Try a smaller one.");
  const { blob, width, height, ext } = await downscale(input).catch((err: unknown) => {
    throw err instanceof FigureError ? err : new FigureError("That image couldn't be read.");
  });

  const sb = createClient();
  const session = sb ? (await sb.auth.getSession()).data.session : null;
  if (!sb || !session) return { src: await toDataUrl(blob), width, height };

  const path = `${session.user.id}/figures/${crypto.randomUUID()}.${ext}`;
  const { error } = await sb.storage.from("media").upload(path, blob, { contentType: blob.type, upsert: false });
  if (error) throw new FigureError("Couldn't upload that image. Check your connection and try again.");
  return { path, width, height };
}

const signedCache = new Map<string, { url: string; expires: number }>();

async function signedUrl(path: string): Promise<string> {
  const hit = signedCache.get(path);
  if (hit && hit.expires - SIGNED_URL_MARGIN_MS > Date.now()) return hit.url;
  const sb = createClient();
  if (!sb) throw new FigureError("Sign in to see this image.");
  const { data, error } = await sb.storage.from("media").createSignedUrl(path, SIGNED_URL_SECONDS);
  if (error || !data) throw new FigureError("Couldn't load this image.");
  signedCache.set(path, { url: data.signedUrl, expires: Date.now() + SIGNED_URL_SECONDS * 1000 });
  return data.signedUrl;
}

/** A loadable URL for a stored image: its data URL, or a signed storage URL. */
export async function figureUrl(image: { path?: string; src?: string }): Promise<string> {
  if (image.src) return image.src;
  if (!image.path) throw new FigureError("This image has no file.");
  return signedUrl(image.path);
}

/** Display URL for a stored image (signed for private storage). */
export function useFigureUrl(image: { path?: string; src?: string }): { url: string | null; error: string | null } {
  const [state, setState] = React.useState<{ url: string | null; error: string | null }>({
    url: image.src ?? null,
    error: null,
  });
  React.useEffect(() => {
    if (!image.path) {
      setState({ url: image.src ?? null, error: null });
      return;
    }
    let cancelled = false;
    signedUrl(image.path)
      .then((url) => !cancelled && setState({ url, error: null }))
      .catch((err: unknown) => !cancelled && setState({ url: null, error: err instanceof Error ? err.message : "Couldn't load this image." }));
    return () => {
      cancelled = true;
    };
  }, [image.path, image.src]);
  return state;
}
