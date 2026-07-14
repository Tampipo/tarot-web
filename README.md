# Tarot

A small web app to keep score across French-Tarot nights: register players,
record deals, and watch the leaderboard and per-player stats update.

Full TypeScript, Docker-first. Built as an npm-workspace monorepo:

| Package           | What it is                                                            |
| ----------------- | --------------------------------------------------------------------- |
| `packages/shared` | Pure, unit-tested tarot **scoring engine** + shared types.            |
| `packages/api`    | **Fastify + Prisma** REST API. Cookie sessions, Postgres or OIDC auth. |
| `packages/web`    | **Vite + React** SPA with a small hand-rolled design system.          |

## Scoring

The engine lives in [`packages/shared/src/scoring.ts`](packages/shared/src/scoring.ts)
and is the single source of truth (the API imports it; the web previews with it).
It computes a deal's value to the attack:

```
base = sign·(25 + |pointsMade − target|)·multiplier   (contract; sign = won ? +1 : −1)
     + petitAuBout·10·multiplier
     + misère·10·multiplier
     + poignée·value                                    (flat: 20 / 30 / 40)
```

then splits it **zero-sum** across the table (3, 4 or 5 players, with or without
a called partner). Per-player results are stored in `GamePlayer`; every
leaderboard and statistic is aggregated from those rows — nothing is kept as a
running total.

Run the tests: `npm test`.

## Auth

Set `AUTH_MODE` to `local` (email + password in Postgres), `oidc` (SSO only), or
`both`. OIDC turns on automatically once `OIDC_ISSUER` / `OIDC_CLIENT_ID` /
`OIDC_CLIENT_SECRET` are set. The login screen renders only the enabled methods.
Sessions are a signed JWT in an httpOnly cookie.

## Run it locally (Docker)

```bash
cp .env.example .env          # then fill SESSION_SECRET (openssl rand -hex 32)
docker compose up --build     # postgres → migrate+seed → api → web
```

App: <http://localhost:8080> — the API is proxied at `/api`.

## Develop without Docker

```bash
npm install
npm run generate                                  # prisma client
export DATABASE_URL=postgresql://tarot:tarot@localhost:5432/tarot
export SESSION_SECRET=$(openssl rand -hex 32)
npm run migrate                                   # or: npx prisma db push
npm run seed
npm run dev                                        # api :3000 + web :5173 (proxies /api)
```

## Images / CI

[`.github/workflows/build-push.yaml`](.github/workflows/build-push.yaml)
typechecks, runs the scoring tests, then builds and pushes two images to GHCR on
every push to `main` (and on `v*` tags):

- `ghcr.io/<owner>/tarot-api`
- `ghcr.io/<owner>/tarot-web`

Tags: `sha-<short>` (every build), `latest` (main), `vX.Y.Z` (release tags).
Pushing uses the built-in `GITHUB_TOKEN` — no extra secrets required. Deploying
the images onto k3s is handled outside this repo.

## Environment

See [`.env.example`](.env.example). Key variables: `DATABASE_URL`,
`SESSION_SECRET`, `AUTH_MODE`, `ALLOW_SIGNUP`, `API_PUBLIC_URL`, `WEB_ORIGIN`,
and the `OIDC_*` block.
