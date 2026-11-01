# Local Development

Requires Node.js 24+, pnpm, and PostgreSQL.

```bash
pnpm install
cp .env.example .env.local
# In .env.local, set DATABASE_URL to your local Postgres and SESSION_SECRET
pnpm db:push
pnpm dev
```

Unit tests run with `pnpm test:run`. The browser smoke suite runs with `pnpm test:e2e` against a production build (`pnpm build` first) and a throwaway `tracker_tracker_e2e` database on the same Postgres server, which it wipes on every run; create that database once with `createdb tracker_tracker_e2e` and sync it with `POSTGRES_DB=tracker_tracker_e2e pnpm db:push`.
