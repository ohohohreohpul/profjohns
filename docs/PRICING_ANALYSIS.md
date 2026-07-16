# Pricing Analysis — 100% Profit Margin on AI Credits

## Cost Structure

### OpenRouter Model Pricing (per 1M tokens)

| Model | Input | Output | Used for |
|-------|-------|--------|----------|
| Claude Haiku 4.5 | $0.80 | $4.00 | Fast modes (summarize, ask, angles, complete, titles, etc.) |
| Claude Sonnet 4 | $3.00 | $15.00 | Pro modes (write, edit, audit, synth, section, etc.) |

### Per-Request Cost (actual token usage per mode)

**Cheap modes (Haiku):**

| Mode | Input tokens | Output tokens | Cost |
|------|-------------|---------------|------|
| summarize | 2,000 | 500 | $0.0036 |
| ask | 2,000 | 500 | $0.0036 |
| angles | 2,000 | 500 | $0.0036 |
| gaps | 5,000 | 500 | $0.0060 |
| refine | 5,000 | 1,000 | $0.0080 |
| libchat | 5,000 | 500 | $0.0060 |
| libcat | 5,000 | 1,000 | $0.0080 |
| complete | 3,000 | 50 | $0.0026 |
| titles | 8,000 | 320 | $0.0077 |
| outline | 5,000 | 500 | $0.0060 |
| dna | 5,000 | 200 | $0.0048 |
| batch | 5,000 | 2,000 | $0.0120 |
| **Avg cheap** | | | **$0.006** |

**Expensive modes (Sonnet):**

| Mode | Input tokens | Output tokens | Cost |
|------|-------------|---------------|------|
| write | 10,000 | 3,000 | $0.075 |
| edit | 5,000 | 3,000 | $0.060 |
| section | 10,000 | 3,000 | $0.075 |
| audit | 15,000 | 2,000 | $0.075 |
| synth | 10,000 | 2,000 | $0.060 |
| triage | 5,000 | 2,000 | $0.045 |
| diagram | 2,000 | 1,000 | $0.021 |
| explore | 5,000 | 1,000 | $0.030 |
| **Avg expensive** | | | **$0.055** |

### Worst-Case Cost (all Sonnet, most expensive modes)

- All audit/write/section: ~$0.075 per request
- 100 requests = $7.50 cost
- For 100% margin: charge >= $15.00

### Average-Case Cost (mixed usage)

- Typical researcher: 60% cheap + 40% expensive
- Average cost per request: 0.6 × $0.006 + 0.4 × $0.055 = **$0.026**
- 100 requests = $2.60 cost
- For 100% margin: charge >= $5.20

---

## Pricing Plans (100% margin guaranteed even in worst case)

All plans guarantee 100%+ margin even if every request is the most expensive mode (Sonnet write/audit at $0.075 each).

### Free Tier — $0/month
- 10 AI requests/month (BYO key for unlimited)
- Worst-case cost: $0.75 | Revenue: $0 | Loss leader
- All app features work
- Cloud sync included

### Starter — $12/month
- 50 AI requests/month
- Worst-case cost: $3.75 | Revenue: $12 | **220% margin**
- Average-case cost: $1.30 | **823% margin**
- BYO key for unlimited requests beyond cap

### Pro — $29/month (recommended)
- 150 AI requests/month
- Worst-case cost: $11.25 | Revenue: $29 | **158% margin**
- Average-case cost: $3.90 | **643% margin**
- BYO key for unlimited requests beyond cap
- Priority support

### Scholar — $49/month
- 300 AI requests/month
- Worst-case cost: $22.50 | Revenue: $49 | **118% margin**
- Average-case cost: $7.80 | **528% margin**
- BYO key for unlimited requests beyond cap
- Priority support

### Lifetime — $89 one-time
- Lifetime app access + 1 year of updates
- **$15 AI credit pool** (200 requests at worst-case, 575 at average)
  - Worst-case cost: $15 | Revenue: $15 | **0% margin on AI** (break-even)
  - This is intentional — the $89 covers app + hosting, AI is a bonus
- After credits exhausted: subscribe to a monthly plan or BYO key
- Cloud sync for lifetime

### Credit Top-ups (pay-as-you-go, any plan)
- $5 → 30 credits (~22 expensive or 830 cheap requests)
  - Worst-case cost: $2.25 | **122% margin**
- $10 → 65 credits (~48 expensive or 1,800 cheap requests)
  - Worst-case cost: $4.88 | **105% margin**
- $25 → 170 credits (~125 expensive or 4,700 cheap requests)
  - Worst-case cost: $12.75 | **96% margin** (borderline — adjust to 160 credits)
  - Fixed: $25 → 160 credits → worst-case $12 | **108% margin**

---

## Margin Analysis

| Plan | Price | Requests | Worst cost | Worst margin | Avg cost | Avg margin |
|------|-------|----------|-----------|-------------|---------|-----------|
| Free | $0 | 10 | $0.75 | Loss leader | $0.26 | Loss leader |
| Starter | $12 | 50 | $3.75 | 220% | $1.30 | 823% |
| Pro | $29 | 150 | $11.25 | 158% | $3.90 | 643% |
| Scholar | $49 | 300 | $22.50 | 118% | $7.80 | 528% |
| Lifetime | $89 | 200 | $15.00 | 493%* | $5.20 | 1612%* |
| Top-up $5 | $5 | 30 | $2.25 | 122% | $0.78 | 541% |
| Top-up $10 | $10 | 65 | $4.88 | 105% | $1.69 | 492% |
| Top-up $25 | $25 | 160 | $12.00 | 108% | $4.16 | 501% |

*Lifetime margin is high because $89 covers app + hosting, only $15 allocated to AI.

All plans maintain **100%+ margin in worst case** (every request is the most expensive Sonnet mode).

---

## BYO Key (Bring Your Own OpenRouter Key)

Users can enter their own OpenRouter API key in Settings. When active:
- All AI requests route through the user's key
- Usage caps don't apply (unlimited)
- We incur $0 AI cost (100% margin by definition)
- Usage is still tracked for debugging (not billing)

This is the best option for heavy users — they pay OpenRouter directly, we pay nothing.

---

## Implementation Notes

1. **Fair-use enforcement**: The `usage_events` table (BILL-002) tracks every AI request with vendor, model, cost estimate, and user. Monthly usage counts are computed from this table.

2. **Credit-weighted system** (future enhancement): Instead of flat "1 request = 1 credit," weight by actual cost:
   - Haiku request = 1 credit
   - Sonnet request = 10 credits
   - This gives more accurate cost-to-credit mapping and allows higher request caps

3. **Graceful degradation**: When a user hits their cap, show a message explaining options (upgrade, buy credits, or BYO key). Never hard-block without explanation.

4. **Cost monitoring**: The `recordUsageEvent()` function (BILL-002) logs every request's estimated cost. A dashboard query can show daily/monthly AI spend per user for margin monitoring.
