// Supabase Edge Function — text embeddings (VISION Phase 5).
//
// Uses the built-in `gte-small` model (384-d) in the Supabase Edge runtime —
// no external embedding vendor or API key. Deploy with:
//   supabase functions deploy embed
//
// Request:  POST { "text": "..." }
// Response: { "embedding": number[] }  (length 384)
//
// This file runs on Deno in Supabase's edge runtime, NOT in the Next app, so
// the `Supabase`/`Deno` globals and npm/deno imports below are expected to be
// unresolved in the app's TypeScript project (it's excluded from tsconfig).

// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const model = new Supabase.ai.Session("gte-small");

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const { text } = await req.json();
    if (typeof text !== "string" || !text.trim()) {
      return Response.json({ error: "No text." }, { status: 400, headers: CORS });
    }
    // mean_pool + normalize → a unit vector ready for cosine distance.
    const embedding = await model.run(text.slice(0, 8000), {
      mean_pool: true,
      normalize: true,
    });
    return Response.json({ embedding }, { headers: CORS });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "embed failed" },
      { status: 500, headers: CORS },
    );
  }
});
