# Deploying the backend

This covers what any host needs, without committing to one — pick whichever
platform you like (Render, Railway, Fly.io, a plain VPS with Docker, etc.)
and follow its own "deploy a Docker image" instructions using the `Dockerfile`
in this folder.

## Required environment variables

| Variable      | Required | Notes                                                                                                  |
| ------------- | -------- | -------------------------------------------------------------------------------------------------------- |
| `JWT_SECRET`  | Yes      | Long random string. The server refuses to start without it. Generate one with `openssl rand -hex 32`.    |
| `PORT`        | No       | Most platforms inject this themselves; only set it if yours doesn't.                                      |
| `CORS_ORIGIN` | No       | Comma-separated list of allowed origins. Unset = allow any origin, which is fine for local dev but **should be set in production** to your deployed frontend's real origin(s). |
| `DB_PATH`     | No       | Where the SQLite file lives. The Dockerfile sets this to `/app/data/app.sqlite` already — see below.       |

See `.env.example` for the same list with inline comments.

## The SQLite persistent-volume problem

This backend stores everything in a single SQLite file (`node:sqlite`, no
external database server). That file has to survive restarts and
redeploys, which means **the hosting platform needs a persistent volume
mounted at the path `DB_PATH` points to** (the Dockerfile mounts one at
`/app/data`).

- **Works as-is**: any host that supports attaching a persistent disk/volume
  to a container (Fly.io volumes, Railway volumes, Render persistent disks,
  a VPS with a real filesystem).
- **Does not work as-is**: purely serverless/ephemeral platforms (e.g. a
  bare Vercel/Netlify function, most "serverless container" tiers) — the
  filesystem resets on every cold start, which would silently wipe every
  user's data. Don't deploy this backend there without first swapping
  SQLite for a hosted Postgres/MySQL instance, which is a real migration
  (schema syntax, `node:sqlite`-specific query patterns), not a config
  change — out of scope here.

## Verifying the Docker image locally

```bash
docker build -t whatshouldweeat-backend .
docker run --rm -p 3000:3000 \
  -e JWT_SECRET=dev-only-secret \
  -v whatshouldweeat-data:/app/data \
  whatshouldweeat-backend
curl http://localhost:3000/api/health
```

`whatshouldweeat-data` is a named Docker volume standing in for whatever
persistent disk the real host provides — swap it for that host's actual
volume mechanism when deploying for real.

## Wiring the frontend to the deployed backend

`Dinner-ionic/src/environments/environment.prod.ts` currently points
`apiUrl` at `https://api.whatshouldweeat.app/api` — a placeholder domain
that isn't live. Once you have a real deployed URL, update that file (and
rebuild/re-sync the Android app) to point at it.

## Not covered here

No CI/CD pipeline, no database migration framework (schema changes are
still hand-rolled `CREATE TABLE IF NOT EXISTS` + the `ensureColumn` helper —
fine for one file, would need a real migration tool before this has
multiple people deploying against the same database), and no monitoring
beyond whatever the host's own container logs give you.
