interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: string | null;
}

export interface ReadableResult {
  kind: "pdf" | "html";
  text: string;
  pages?: number;
  resolvedUrl: string;
}

/** Fetch readable full text for a source URL via the server route. */
export async function fetchReadable(url: string): Promise<ReadableResult> {
  const res = await fetch(`/api/readable?url=${encodeURIComponent(url)}`);
  const json = (await res.json()) as ApiResponse<ReadableResult>;
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.error ?? "Could not load this source.");
  }
  return json.data;
}
