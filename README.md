# Tarot

A small web app to keep score across French-Tarot nights: register players,
record deals, and watch the leaderboard and per-player stats update.

Full TypeScript, Docker-first. Built as an npm-workspace monorepo:

| Package           | What it is                                                            |
| ----------------- | --------------------------------------------------------------------- |
| `packages/shared` | Pure, unit-tested tarot **scoring engine** + shared types.            |
| `packages/api`    | **Fastify + Prisma** REST API. Cookie sessions, approval-gated auth.  |
| `packages/web`    | **Vite + React** SPA with a small hand-rolled design system.          |

## Scoring

The engine lives in [`packages/shared/src/scoring.ts`](packages/shared/src/scoring.ts)
and is the single source of truth (the API imports it; the web previews with it).
It computes a deal's value to the attack:

```
base = sign·(25 + |pointsMade − target|)·multiplier   (contract; sign = won ? +1 : −1)
     + petitAuBout·10·multiplier
     + misère·10·multiplier
     + poignée·value·sign                               (flat: 20 / 30 / 40)
```

`petitAuBout` and `misère` carry the sign of the camp that earned them, and are
separate terms — *not* folded into the contract before it is negated (failing by
5 while taking the petit is `−30·m + 10·m`, not `−40·m`). The poignée is flat and
always goes to whichever camp **wins the deal**, whoever declared it, so it takes
the contract's own sign.

then splits it **zero-sum** across the table (3, 4 or 5 players, with or without
a called partner). Per-player results are stored in `GamePlayer`; every
leaderboard and statistic is aggregated from those rows — nothing is kept as a
running total.

Run the tests: `npm test`.

## Players and guests

**A player is an approved member** — there is no separate roster. You become
seatable by registering an account and having an admin approve it, and each
account carries a role (`admin` / `member`). That's also what makes "your
statistics" answerable: the Stats page opens on *you*.

Any seat can instead be filled by a **Guest**. A guest counts for the scoring
maths — table size and the zero-sum split are computed with them — but nothing
about them is stored: no `GamePlayer` row, so they never appear on a
leaderboard. The taker and partner must be members, since the game record keys
off them via FKs; a guest can only defend. Because guest scores aren't recorded,
leaderboard totals only sum to zero for games played entirely by members.

An account that has played can't be deleted (it would tear holes in past
leaderboards) — demote it instead.

## Seasons

The scoreboard is scoped to a **season**, so starting a new one *is* the score
reset. Closed seasons keep their games forever and stay browsable from the
season selector on the Scoreboard and Stats pages (`season=all` spans them all).

Admins pick the cadence on the Admin page: manual only, or automatically every
N months (monthly, quarterly, yearly…). Rollover is **lazy** — evaluated when a
game is saved or a scoreboard is read, so no scheduler is needed. A season runs
N months from its start; when that elapses it closes *at its boundary* and the
next opens there, keeping the cadence aligned rather than drifting to whenever
someone next opened the app.

Not standard FFT, for the record: **misère** (±10 × multiplier) is a house rule
carried over from the old app, and **chelem** isn't implemented.

## Auth

Email + password, stored in Postgres. Sessions are a signed JWT in an httpOnly
cookie; role and status are re-read from the DB on every request, so a change
takes effect on the account's next call.

Registration is **approval-gated**:

- A bootstrap **admin** is created on first start from `ADMIN_EMAIL` /
  `ADMIN_PASSWORD` (only while no admin exists yet).
- New sign-ups land in a **pending** state and cannot log in until an admin
  **approves** them — this keeps strangers out.
- An admin can **promote** a member to admin, **demote**, and **delete**
  accounts. The app refuses any action that would leave zero admins.
- Recommended flow: log in as the bootstrap admin → approve + promote your real
  account → delete the bootstrap admin. It won't be recreated while another
  admin exists (but it *will* respawn as a break-glass if every admin is
  removed).

Set `ALLOW_SIGNUP=false` to freeze registration entirely.

## Run it locally (Docker)

```bash
cp .env.example .env          # then fill SESSION_SECRET (openssl rand -hex 32)
docker compose up --build     # postgres → migrate → api → web
```

App: <http://localhost:8080> — the API is proxied at `/api`.

## Develop without Docker

```bash
npm install
npm run generate                                  # prisma client
export DATABASE_URL=postgresql://tarot:tarot@localhost:5432/tarot
export SESSION_SECRET=$(openssl rand -hex 32)
npm run migrate                                   # or: npx prisma db push
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
`SESSION_SECRET`, `ALLOW_SIGNUP`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and
`WEB_PORT` (docker-compose host port).
