# ProfJohns — Pricing & Paywall Brief

## Product Overview

ProfJohns is a web-based research canvas with AI-powered source discovery, reading, writing, and citation tools. AI features run through OpenRouter (Claude models). Lifetime license holders can bring their own OpenRouter API key for unlimited AI at zero cost to us.

---

## Pricing Plans

| Plan | Price | AI Requests/mo | Key Benefit |
|------|-------|---------------|------------|
| **Free** | $0 | 10 | Try every feature |
| **Starter** | $12/mo | 50 | Light researchers, occasional AI use |
| **Pro** | $29/mo | 150 | Active writers, daily AI use |
| **Scholar** | $49/mo | 300 | Heavy users, full papers |
| **Lifetime** | $89 once | 200 credits + BYO key | No subscription, own it, unlimited AI with your own key |
| **Top-up** | $5–$25 | 30–160 credits | Any plan, pay-as-you-go |

### What every plan includes
- Full canvas (nodes, edges, documents, sources, highlights)
- All research search providers (OpenAlex, arXiv, Semantic Scholar, Wikipedia)
- PDF extraction
- Cloud sync across devices
- All citation styles (APA, IEEE, Nature, MLA)
- Export (DOCX, Markdown, LaTeX)

### What AI credits cover
Every AI action consumes credits:
- **Cheap** (1 credit): summarize, ask, autocomplete, title suggestions, search angles, library chat
- **Expensive** (counts as ~5–10 credits): write from sources, edit prose, citation audit, synthesis, section drafting

### BYO Key — Lifetime only
Lifetime license holders can paste their own OpenRouter API key in Settings. When active:
- All AI requests route through the user's key (we pay $0 in AI costs)
- Request caps don't apply — unlimited AI
- 200 starter credits still included for when BYO key isn't configured
- This is the key differentiator of the Lifetime plan — it makes $89 a one-time cost for unlimited AI research

---

## Paywall Mechanics

### What free users CAN do
- Full canvas editing (unlimited)
- Research search (OpenAlex, arXiv, etc.)
- PDF extraction (10/month)
- Cloud sync
- Export
- 10 AI requests/month (any mode)

### What free users CANNOT do (after 10 AI requests)
- No AI writing, editing, summarizing, auditing, or autocomplete
- The app shows "You've used your 10 free AI requests this month" with upgrade options
- Canvas, search, and reading remain fully functional
- BYO key is NOT available on free or monthly plans — it's a Lifetime exclusive

### Paywall UX
- **Soft wall, not hard wall**: when AI credits run out, the AI panel shows upgrade options: subscribe to a monthly plan, buy top-up credits, or upgrade to Lifetime for BYO key
- **Never blocks research**: search, reading, PDF extraction, canvas editing, export always work
- **Visible usage**: a counter in the writing sidebar shows remaining credits (e.g., "142 / 150 requests this month")
- **Monthly reset**: credits reset on the 1st of each month
- **No surprise charges**: we never auto-charge; users explicitly buy top-ups or subscribe

### Entitlement enforcement
- Feature gates are checked **server-side** in the API route (not just hidden in the UI)
- Every `/api/ai` and `/api/clip` request checks the user's entitlement record in the database
- Revoked or refunded subscriptions immediately lose access
- Anonymous requests get 401, unauthorized get 403, rate-limited get 429

---

## Feature Gates (for dev team)

| Feature key | What it gates | Enforced where |
|-------------|--------------|----------------|
| `ai.write` | AI writing & editing | `/api/ai` (write, edit, section modes) |
| `ai.audit` | Citation auditing | `/api/ai` (audit mode) |
| `ai.voice` | Writing DNA (voice profile) | `/api/ai` (dna mode) |
| `agent.background` | Scheduled source watch | `/api/jobs/run` |
| `semantic.search` | Semantic search over sources | `/api/ai` (future embed routes) |
| `figure.search` | CLIP figure search | `/api/clip` |
| `cloud.sync` | Cross-device canvas sync | repo.ts sync hooks |

### Database tables (already migrated)
- `products` / `prices` — Stripe catalog mirror
- `customers` — user ↔ Stripe customer mapping
- `purchases` — transaction records with status (paid, refunded, disputed, revoked)
- `entitlements` — active feature grants per user (single source of truth)
- `usage_events` — every AI request logged with vendor, model, cost estimate, status
- `webhook_events` — idempotent Stripe webhook processing

### Stripe integration points
1. **Checkout**: Stripe Checkout Session → redirect to `/api/stripe/checkout`
2. **Webhook**: Stripe → `/api/stripe/webhook` (signature-validated, idempotent)
3. **Customer portal**: Stripe-hosted page for subscription management
4. **Entitlement grant**: webhook handler inserts into `entitlements` table
5. **Entitlement revoke**: refund/dispute webhook updates `entitlements.status` to `revoked`

---

## Margin Summary

All plans maintain **100%+ profit margin** on AI credits even in worst case (every request is the most expensive Claude Sonnet mode at $0.075).

| Plan | Revenue | Worst-case AI cost | Margin |
|------|---------|-------------------|--------|
| Free | $0 | $0.75 | Loss leader |
| Starter | $12 | $3.75 | 220% |
| Pro | $29 | $11.25 | 158% |
| Scholar | $49 | $22.50 | 118% |
| Lifetime | $89 | $15.00 | 493% |
| Top-up $5 | $5 | $2.25 | 122% |
| Top-up $25 | $25 | $12.00 | 108% |
| BYO key (Lifetime) | $0 | $0 | Infinite |

---

## Implementation Status

| Component | Status |
|-----------|--------|
| Entitlement schema (DB) | Migrated, RLS-protected |
| `checkEntitlement()` server-side | Implemented, queries DB |
| `requireEntitlement()` in API routes | Wired to `/api/ai`, `/api/clip` |
| `usage_events` table | Migrated, logging on every AI request |
| Rate limiting | In-memory (per-user + per-IP) |
| Stripe checkout | Not yet built |
| Stripe webhook | Not yet built |
| Usage counter UI | Not yet built |
| Paywall message UI | Not yet built |
| Customer portal link | Not yet built |

### Next dev steps
1. Build `/api/stripe/checkout` route (create Checkout Session)
2. Build `/api/stripe/webhook` route (process events, grant/revoke entitlements)
3. Add usage counter to writing sidebar (queries `usage_events` monthly count)
4. Add paywall message component (shows when credits exhausted)
5. Add Settings → Billing page (manage subscription, paste BYO key)
