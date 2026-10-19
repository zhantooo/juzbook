# Deploying Arena to Vercel

Arena is deployed from the same repository as the reader, but it is
self-contained: it reads its own database and never queries the reader's
PostgreSQL.

---

## What is deployed, and what is not

| Part | On Vercel | Why |
|---|---|---|
| Arena (subject picker, match, result) | **yes** | self-contained, reads its own database |
| Sign-in | **yes** | needs only the `User` table |
| Reader (textbooks, figures, notes) | **no content** | textbook PDFs and page crops are copyrighted and are not in version control |

The deployed site is therefore a working Arena with sign-in. The catalogue is
empty by design.

---

## Why two databases

| Database | Engine | Holds |
|---|---|---|
| Arena | **SQLite via Turso** | subjects, question bank, matches, ratings |
| Reader | PostgreSQL | user accounts (and, locally, the textbooks) |

Vercel's filesystem is ephemeral, so a SQLite *file* cannot survive there.
Turso is SQLite over the network: the same dialect, the same Prisma schema, no
file. The portability rule in `spec.md` still holds — no column type that only
one engine supports.

---

## One-time setup

### 1. Turso — Arena's database

1. Sign up at [turso.tech](https://turso.tech) with GitHub.
2. Create a database named `juzbook-arena`.
3. Copy its URL (`libsql://…`) and create an auth token.
4. Add both to `.env` locally:

   ```bash
   TURSO_DATABASE_URL="libsql://…"
   TURSO_AUTH_TOKEN="…"
   ```

5. Push the schema and the data:

   ```bash
   npm run arena:push     # creates the tables in Turso
   npm run arena:turso    # copies subjects and a balanced slice of questions
   ```

   `arena:turso` copies about 3 000 questions per subject by default, which is
   far more than a ten-question match needs and keeps the free tier comfortable.
   Pass `--questions=5000` to copy fewer.

### 2. Vercel — the app

1. In the Vercel dashboard, **Add New → Project**, and import the GitHub
   repository.
2. Add a Postgres database to the project (Storage → Create → Postgres). Vercel
   sets `DATABASE_URL` automatically.
3. Add the remaining environment variables (Settings → Environment Variables):

   | Variable | Value |
   |---|---|
   | `TURSO_DATABASE_URL` | from Turso |
   | `TURSO_AUTH_TOKEN` | from Turso |
   | `JUZBOOK_SESSION_SECRET` | any long random string |
   | `NEXT_PUBLIC_APP_URL` | the Vercel URL |
   | `DEMO_STUDENT_PASSWORD` | the demo student password |
   | `DEMO_ADMIN_PASSWORD` | the demo admin password |
   | `DEMO_SUPERADMIN_PASSWORD` | the demo superadmin password |

   `DATABASE_URL_POOLED` is optional; the app falls back to `DATABASE_URL`.

4. Deploy. `postinstall` generates both Prisma clients on the build host.

### 3. Seed the deployed database

With the deployed `DATABASE_URL` in hand, run once from a local terminal:

```bash
npx prisma db push                                  # creates the reader schema
node --env-file=.env scripts/seed_demo_accounts.mjs # creates the three demo accounts
```

Point `DATABASE_URL` at the deployed database for both commands.

---

## Verifying the deployment

1. Open the Vercel URL and sign in as `student@juzbook.kz`.
2. Go to **Арена** in the header.
3. The subject list shows the subjects whose questions reached Turso.
4. Start a match and play it to the end: ten questions, a result screen, a
   rating change.

If the subject list is empty, `arena:turso` has not run or the Turso variables
are missing from the Vercel environment.

---

## Local development is unchanged

Without `TURSO_DATABASE_URL`, Arena uses the local SQLite file at
`prisma/arena.db`. Nothing about the local workflow changes.
