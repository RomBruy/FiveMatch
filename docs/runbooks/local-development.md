# Local Development

## Requirements

- Node.js 20+
- pnpm 10+
- Docker Desktop, when running PostgreSQL and Redis locally

## Install

```bash
pnpm install
```

## Environment

Copy `.env.example` into your local environment manager or shell and set:

```bash
API_PORT=3000
EXPO_PUBLIC_API_BASE_URL=http://localhost:3000/api/v1
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your-clerk-publishable-key
CLERK_SECRET_KEY=sk_test_your-clerk-secret-key
CLERK_JWT_KEY="-----BEGIN PUBLIC KEY-----\nyour-clerk-jwt-public-key\n-----END PUBLIC KEY-----"
```

For Android emulators, use `http://10.0.2.2:3000/api/v1` instead of `localhost`.

Clerk keys come from the Clerk Dashboard. The publishable key is safe for the Expo app because it uses the `EXPO_PUBLIC_` prefix; never expose `CLERK_SECRET_KEY` with that prefix.

## Local Services

```bash
docker compose -f infra/docker-compose.local.yml up -d
```

## Run

```bash
pnpm dev:api
pnpm dev:mobile
```

The API health endpoint is available at:

```bash
curl http://localhost:3000/api/v1/health
```

## Validate

```bash
pnpm typecheck
pnpm lint
pnpm test
```
