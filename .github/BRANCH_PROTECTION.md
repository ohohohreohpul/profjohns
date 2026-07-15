# Branch Protection Rules

## `launch-readiness` branch

Configure in GitHub: Settings -> Branches -> Branch protection rules

### Required status checks
All of the following must pass before merge:

1. **Lint, Typecheck, Build** (`quality`)
2. **Token and Accessibility Gates** (`token-and-accessibility-gates`)
3. **Playwright Tests** (`tests`)
4. **Dependency Vulnerability Scan** (`dependency-scan`)

### Additional rules
- Require pull request before merging
- Require approvals: 1 (minimum)
- Dismiss stale pull request approvals when new commits are pushed
- Require status checks to pass before merging
- Require branches to be up to date before merging
- Do not allow bypassing the above settings

### Environment secrets
Production environment secrets (Supabase production URL/keys, OpenRouter production key,
Replicate production token, CRON_SECRET, billing webhook secret) must be configured in:

GitHub Settings -> Environments -> Production

These must NOT be available to pull-request builds. Configure the Production environment
to require review and restrict to the `launch-readiness` and `main` branches only.

Preview/staging secrets go in:

GitHub Settings -> Environments -> Preview

Local development uses `.env.local` (gitignored).
