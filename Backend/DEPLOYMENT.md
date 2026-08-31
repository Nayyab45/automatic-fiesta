# Deploying the backend

This covers what any host needs, without committing to one — pick whichever
platform you like (Render, Railway, Fly.io, a plain VPS with Docker, etc.)
and follow its own "deploy a Docker image" instructions using the `Dockerfile`
in this folder.

## Required environment variables

| Variable | Required | Notes |
| --- | --- | --- |
| `JWT_SECRET` | Yes | Long random string. The server refuses to start without it. Generate one with `openssl rand -hex 32`. |
| `DB_HOST` / `DB_USER` / `DB_PASSWORD` / `DB_NAME` / `DB_PORT` | Yes | The live MySQL/MariaDB database. All state lives here. |
| `PORT` | No | Most platforms inject this themselves; only set it if yours doesn't. |
| `CORS_ORIGIN` | No | Comma-separated list of allowed origins. Unset = allow any origin, which is fine for local dev but **should be set in production** to your deployed frontend's real origin(s). |
| `PUBLIC_ASSET_BASE_URL` | No | This backend's own public origin, used to build URLs for the self-hosted restaurant/dish photos at `/images`. Defaults to `http://localhost:$PORT`, which is only correct for local dev -- **must be set to the real deployed origin** or every photo URL stored in the database points at your laptop. |
| `RESEND_API_KEY` / `RESEND_FROM_EMAIL` | No | Email delivery for `/auth/forgot-password` via [Resend](https://resend.com). Unset = the reset link is just logged server-side instead of emailed -- fine for dev, not for real users. |
| `PUBLIC_APP_URL` | No | Where the Angular frontend is actually hosted, used to build the link inside password-reset emails. Defaults to `http://localhost:8100` (`ionic serve`'s default). |
| `JAZZCASH_*` / `EASYPAISA_*` / `BANK_GATEWAY_*` | No | Payment gateway credentials -- see `.env.example` and `src/lib/paymentGateways/`. A provider whose vars are unset just responds "not connected yet" at checkout instead of failing to start. |

See `.env.example` for the same list with inline comments.

## No persistent volume needed

Unlike an earlier version of this backend (SQLite, a single file on local
disk), all state now lives in the remote MySQL database configured via
`DB_HOST`/etc. The container itself is stateless, so **any host works,
including purely serverless/ephemeral platforms** -- there's no filesystem
to lose on a cold start or redeploy.

The one thing to get right: the database itself needs to survive restarts,
which a real hosted MySQL/MariaDB instance already does (this project's dev
database is on a shared host at `ns3.netstech.net`) -- nothing further to
configure here.

## Verifying the Docker image locally

```bash
docker build -t whatshouldweeat-backend .
docker run --rm -p 3000:3000 \
  -e JWT_SECRET=dev-only-secret \
  -e DB_HOST=... -e DB_USER=... -e DB_PASSWORD=... -e DB_NAME=... \
  whatshouldweeat-backend
curl http://localhost:3000/api/health
```

## Wiring the frontend to the deployed backend

`Dinner-ionic/src/environments/environment.prod.ts` currently points
`apiUrl` at `https://api.whatshouldweeat.app/api` — a placeholder domain
that isn't live. Once you have a real deployed URL, update that file (and
rebuild/re-sync the Android app) to point at it.

## Not covered here

No CI/CD pipeline, no database migration framework (schema changes are
still hand-rolled `CREATE TABLE IF NOT EXISTS` — fine for one file, would
need a real migration tool before this has multiple people deploying
against the same database), and no monitoring beyond whatever the host's
own container logs give you.
