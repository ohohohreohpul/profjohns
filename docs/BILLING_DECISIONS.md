# Billing Decisions (BILL-001)

## Commerce Model

**Provider:** Stripe (checkout sessions + webhooks)

**Pricing:** $89 one-time payment

### What's included
- Lifetime access to the ProfJohns web application
- One year of free updates (new features, bug fixes)
- Hosted AI usage subject to fair-use limits (see below)
- Cloud sync across devices

### What's NOT included
- Unlimited hosted AI usage (financially unsafe without quotas)
- Native desktop apps (future)
- Offline mode (future)

### Fair-use limits on hosted AI
| Feature | Monthly limit |
|---------|--------------|
| AI writing/editing | 500 requests |
| AI summarization/analysis | 1,000 requests |
| Background agent (scheduled watch) | 50 runs |
| CLIP figure search | 200 requests |
| PDF extraction | 100 requests |

Limits reset monthly. Unused quota does not roll over.
When limits are reached, users can provide their own OpenRouter API key
for unlimited usage.

### Bring-your-own-key
Users can enter their own OpenRouter API key in Settings. When a BYO key
is active:
- All AI requests route through the user's key
- Fair-use limits do not apply
- The hosted key is not used
- Usage is not tracked for billing (but is for debugging)

### Refund policy
- 30-day money-back guarantee, no questions asked
- Refunds processed via Stripe dashboard
- Refunded purchases revoke all entitlements

### Tax/VAT
- Handled by Stripe Tax (automatic)
- Prices displayed include estimated tax where required

### After the included year
- Users retain access to the app (lifetime license)
- Free updates end after 1 year
- A renewal option ($29/year) extends updates
- Hosted AI fair-use continues for lifetime license holders

## Entitlement feature keys
```
ai.write        — AI writing and editing
ai.audit        — Citation auditing
ai.voice        — Writing DNA (voice profile)
agent.background — Scheduled source watch
semantic.search  — Semantic search over sources
figure.search    — CLIP figure search
cloud.sync       — Cross-device canvas sync
```
