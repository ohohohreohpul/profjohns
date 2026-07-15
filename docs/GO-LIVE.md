# Go-Live Runbook

Everything through Phase 5 is built and deploy-ready. This is the one-time
setup that turns the deploy-dependent features on. Do it in order.

Project: `profjohns` · Supabase ref `qoalswvmtubdbdsjxnvb`.

---

## 1. Database — DONE

`supabase/reset.sql` then `supabase/schema.sql` ran green. That covers every
table: profiles, projects, canvases, sources, pinned_sources, media, agents,
standing_tasks, findings, pgvector on sources, figures.

Re-run `schema.sql` any time you pull new DB changes — it's idempotent.

---

## 2. Deploy the embedding Edge Function (text semantic search)

Needed for the Readroom "Semantic search". Uses Supabase's built-in gte-small
model — no external key.

```bash
# from the repo root; the CLI is already linked to the project
supabase functions deploy embed
```

Verify: Supabase dashboard → Edge Functions → `embed` is listed.

---

## 3. Environment variables on Vercel

Vercel → your project → Settings → Environment Variables. Add for
**Production + Preview**:

| Name | Value | Powers |
|------|-------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | (already set) | auth + all DB |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | (already set) | auth + all DB |
| `OPENROUTER_API_KEY` | (already set) | all AI |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → `service_role` | background sweep (Watch) |
| `CRON_SECRET` | `openssl rand -hex 32` | protects the cron route |
| `REPLICATE_API_TOKEN` | replicate.com → account → API tokens | figure search (CLIP) |

Rules:
- `SUPABASE_SERVICE_ROLE_KEY` is a SECRET — never prefix with `NEXT_PUBLIC_`,
  never commit it. It bypasses row-level security.
- Missing any of the bottom three only disables that one feature; the rest of
  the app is unaffected.

---

## 4. Redeploy

Trigger a fresh Vercel deploy (push, or "Redeploy" in the dashboard) so the new
env vars + `vercel.json` cron schedule take effect.

---

## 5. Smoke test (signed in, on the live URL)

The only true end-to-end check — do this once after deploy:

- [ ] Sign up / sign in with email.
- [ ] Create a canvas, add a node, reload — it persists.
- [ ] Open it in a second browser — same board (cross-device).
- [ ] `/agents` — edit an agent's prompt; reload — it sticks.
- [ ] A Sources node — the agent picker shows "Scout"; run a search.
- [ ] `/account` → Writing voice — paste a sample, Train — profile appears.
- [ ] `/watch` — create a standing search, Run now — findings appear.
- [ ] Readroom → Semantic search → Build index → search by meaning.
- [ ] A Media node → Describe with AI, then Index for figure search →
      Readroom → Figure search finds it.
- [ ] Wait for (or manually hit) the daily cron: `/api/jobs/run` should return
      `{ ranTasks, newFindings }` when called with the CRON_SECRET header.

---

## Known follow-ups (not blockers)

- Google OAuth: enable the provider in Supabase + Google Cloud (see the auth
  notes) — email sign-in works meanwhile.
- Figure `src` stores the image data-URL; uploading to Storage + storing a path
  is a refinement.
- Cron sweep surfaces new sources without AI scoring (Run-now scores); add
  scoring + notifications later.
- Web-scale semantic discovery (v1 searches your saved sources only).
- ROTATE the GitHub PAT that was pasted during development.
