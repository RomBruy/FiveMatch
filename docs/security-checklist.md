# FiveMatch — Security Checklist

_Completed as part of Story 7.3 (NFR-9 pre-launch gate)._

---

## Git History — No Secrets Committed

- [ ] Run: `git log --all -S 'POSTGRES_PASSWORD' -- . | head` — should return no commits
- [ ] Run: `git log --all -S 'ADMIN_USER_IDS' -- . | head` — should return no commits
- [ ] Run: `git log --all -S 'B2_APPLICATION_KEY' -- . | head` — should return no commits
- [ ] Run: `git log --all -S 'CLERK_SECRET' -- . | head` — should return no commits
- [ ] Verify `.env`, `.env.production`, `.env.staging` are listed in `.gitignore`
- [ ] Verify `.github/workflows/` does not hard-code any secret values (all secrets via `${{ secrets.* }}`)

## Environment Variables — Server-Side Only

- [ ] `ADMIN_USER_IDS` — set only in server `.env` / VPS environment, never in client bundle
- [ ] `POSTGRES_PASSWORD` — set only in server `.env`, never in any response or log line
- [ ] `B2_KEY_ID`, `B2_APPLICATION_KEY` — set only on VPS, used only in `backup-pg.sh`
- [ ] `CLERK_SECRET_KEY` — set only on server; `CLERK_PUBLISHABLE_KEY` is the only Clerk value in the mobile app
- [ ] `SENTRY_DSN` — acceptable in client bundle (Sentry DSNs are designed to be public)

## API Routes — Auth Coverage

- [ ] All routes under `/v1/` except the following require a valid Clerk JWT:
  - `/v1/health` (health check — unauthenticated by design)
  - `/v1/webhooks/clerk` (Clerk webhook — verified by `Clerk-Signature` header, not JWT)
- [ ] Verify `requireAuth()` + `attachUser` is applied in `routes/index.ts` before all domain routes
- [ ] Verify `GET /v1/health` is registered BEFORE `requireAuth()` middleware

## Rate Limiting

- [ ] Global rate limit (`express-rate-limit`) is mounted in `app.ts` — 100 req/min per IP
- [ ] Team generation rate limit — 10 req/min per group — applied to `/v1/groups/:groupId/matches/:matchId/generate-teams`
- [ ] Image generation rate limit — 3 per user per month — enforced at DB level in card route, before Gemini API call

## HTTPS

- [ ] HTTPS is enforced at the reverse-proxy level (Nginx/Caddy/Hetzner load balancer) — the Express API itself listens on HTTP 3000 internally; TLS termination is at the edge
- [ ] HTTP → HTTPS redirect is configured at the reverse proxy
- [ ] `HSTS` header is set at the reverse proxy level

## Clerk JWT Verification

- [ ] `middleware/auth.ts` uses Clerk's `requireAuth()` from `@clerk/express` on every protected route
- [ ] Clerk JWT is verified cryptographically on every request — not just decoded
- [ ] `req.user.userId` is populated from the verified JWT, never from a request body or header

## Data Leakage Prevention

- [ ] `raterPlayerId` is stripped in the ratings response serializer — never present in API responses
- [ ] `ADMIN_USER_IDS` never appears in any API response body, error body, or Pino log line
- [ ] `ovrScore` returns `null` for players with `matchCount < 4` — enforced at `OvrService` layer

---

_Last reviewed: 2026-06-21_
_Reviewer: Roro_
