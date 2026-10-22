# AGENTS.md

Entry point for every AI agent session in this repository. Read this file first,
then the document the task points to.

**Project:** JUZBOOK — a Kazakh-language study platform for the ҰБТ exam.
Students read digitised school textbooks in-app, highlight passages, take
AI-generated tests, build flashcards and track progress.

**Stack:** Next.js 15 (App Router) · React 19 · TypeScript 5 (strict) ·
Tailwind CSS 3 · Prisma 6 + PostgreSQL · Zod · Google Gemini
(`@google/genai`) · CKEditor 5.

---

## Commands

```bash
npm install                 # install dependencies
npm run dev                 # dev server on :3000
npm run build               # production build
npm start                   # next start -p 3000
npm run lint                # next lint
npx tsc --noEmit            # type check — the project's main automated gate
npm run prisma:generate     # regenerate the Prisma client
npx prisma db push          # apply a schema change (see Rules)
npm run prisma:seed         # seed the database
```

There is **no test runner** in this project. `npx tsc --noEmit` plus
`npm run build` plus explicit browser verification are the gates. Do not invent
a `npm test` command.

Operational notes:

- Never run `next build` while `next dev` is running on the same checkout.
- Stop the running server before `prisma generate` (Windows locks the engine DLL).
- `prisma migrate dev` fails against the shadow database because of a broken
  historical migration — use `npx prisma db push` and say so in the PR.
- `.next/cache` holds `unstable_cache` entries across builds; clear it if data
  changes do not appear after a deploy.

---

## Rules

1. **One issue at a time.** Read the acceptance criteria before starting and
   again before closing.
2. **Dependencies are added to `package.json` only with the owner's approval.**
   State why an existing dependency cannot do the job.
3. **Comments and user-facing strings are written in Kazakh.** Identifiers are in
   English. Never translate existing Kazakh text to English.
4. **Never commit secrets.** `.env` is ignored; `.env.example` holds placeholder
   values only. Never print a full API key.
5. **Never commit copyrighted content.** `storage/` and `public/books/` hold
   textbook PDFs and page crops used under educational fair use. They are
   gitignored and must stay that way.
6. **Do not weaken authentication.** `middleware.ts` and `lib/security/*` are not
   to be relaxed for convenience. Agents never log in as a user, never enter a
   password and never inject a session cookie — verify behind-auth behaviour via
   the database, a temporary dev-only route, or rendered screenshots.
7. **Destructive work is backed up first.** `storage/books-original/` holds the
   pristine figure crops. Long batch jobs must be resumable, idempotent,
   non-destructive and self-verifying.
8. **Gemini calls go through `lib/gemini-keys.ts`** (multi-key pool with
   per-minute and per-day cooldowns). The model id lives in `QUESTION_MODEL`.
9. **Stay in scope.** Unrelated defects found along the way become new issues,
   not extra commits.
10. **Report honestly.** Paste real command output. Never describe unverified
    work as done.

---

## Documents

| Document | Read it when |
|---|---|
| [`AGENT.md`](AGENT.md) | Before the first edit — full context: repo map, data model, the traps, code style, boundaries |
| [`_docs/plan.md`](_docs/plan.md) | You need the product specification and scope |
| [`_docs/process.md`](_docs/process.md) | You are starting, grooming, implementing or closing an issue |
| [`_docs/task-template.md`](_docs/task-template.md) | You are writing or grooming an issue |
| [`_docs/team/pm.md`](_docs/team/pm.md) | You are acting as product manager |
| [`_docs/team/software-engineer.md`](_docs/team/software-engineer.md) | You are implementing an issue |
| [`_docs/team/qa-engineer.md`](_docs/team/qa-engineer.md) | You are verifying an issue |
| [`docs/dizayn-juyesi.md`](docs/dizayn-juyesi.md) | You are changing anything visual |
| [`docs/kitap-talaptary.md`](docs/kitap-talaptary.md) | You are touching the textbook import pipeline |
| [`openapi.yaml`](openapi.yaml) | You are changing any Arena API route — the contract test fails if the spec drifts |
| [`_docs/arena/spec.md`](_docs/arena/spec.md) | You are working on Arena |

### Known traps — read before touching the catalogue

- **`Chapter.order` restarts at 1 inside every `SectionChapter`.** Never build a
  flat topic list by sorting on `order`; walk `section → chapterGroup → topics`.
- **`isHidden` exists on `Subject`, `Book`, `Section`, `SectionChapter` and
  `Chapter`.** Reader queries filter it; admin queries pass `includeHidden`.
- **Catalogue reads are cached** (`unstable_cache`, tags `catalog`,
  `catalog-navigation`). Call `revalidateCatalogViews(...)` after writes.
- **Real-ESRGAN `realesrgan-x4plus` only works with `-s 4`.** Any other scale
  silently produces corrupted tiles and still exits 0.
- **`$queryRaw` as a tagged template turns every `${…}` into a parameter.** A
  nested `Prisma.sql` fragment is then sent as a value and serialised to JSON,
  and Postgres fails with `operator does not exist: jsonb ~~ text`. To compose
  SQL, build the whole query with `Prisma.sql` and pass it as an argument:
  `prisma.$queryRaw(Prisma.sql\`…\`)`.
- **Tailwind arbitrary values need `_` for spaces.** `max-h-[calc(100vh-7rem)]`
  is invalid CSS — `calc` requires spaces around `-` — and the browser drops the
  whole declaration without a word. Write `max-h-[calc(100vh_-_7rem)]`. This one
  silently broke both reader side panels.
- **Kazakh search must fold letters.** Students type `Тауке` for `Тәуке`. Both
  sides go through `lib/search-folding.ts` (and Postgres `translate()`), so the
  nine Kazakh letters match their Russian look-alikes.

---

## Search

Catalogue search is two systems answering the same query, merged.

| Piece | Where |
|---|---|
| Letter folding (ә→а, қ→к, …) | [`lib/search-folding.ts`](lib/search-folding.ts) |
| Chunking and content hashing | [`lib/search/chunking.ts`](lib/search/chunking.ts) |
| Gemini embeddings | [`lib/search/embeddings.ts`](lib/search/embeddings.ts) |
| Index building and updating | [`lib/search/indexer.ts`](lib/search/indexer.ts) |
| Vector query | [`lib/search/semantic.ts`](lib/search/semantic.ts) |
| The endpoint that merges both | [`app/api/catalog/search/route.ts`](app/api/catalog/search/route.ts) |

Keyword search is exact and free; it wins on names, dates and terms. Semantic
search wins when a student asks in their own words — measured on 85 questions
from the bank, keyword got 55% of the hard cases and embeddings 95%. Neither
replaces the other, so both run and the results are merged.

### Rules for search

1. **Vectors live in Turso**, in `SearchChunk` / `SearchChapterState`. Those
   tables are created only by `ensureSearchSchema()` with `IF NOT EXISTS` — it
   never drops anything, and Prisma never touches Turso.
2. **The index keeps itself current.** Each chapter's content hash is stored;
   a chapter is re-embedded only when its hash changes. A new book is picked up
   automatically by the nightly cron (`/api/cron/search-index`, `vercel.json`),
   and an admin edit re-indexes that one chapter immediately.
3. **Semantic search must never break the page.** If Turso or the Gemini quota
   is unavailable, `semanticSearch` returns an empty list and keyword results
   stand on their own.
4. **`scripts/search_text_index.mjs` must be run on a new database.** It creates
   the `pg_trgm` extension and the trigram indexes that keyword search needs.
   Run it with `--prod` against the deployed database too.

### Known traps — search

- **The trigram index only works if the expression matches exactly.** The index
  is on `translate(lower(col), 'әөүұқғіңһ', 'аоуукгинх')`; change the fold table
  in one place and the planner silently falls back to a full scan.
- **Document and query embeddings are different.** `RETRIEVAL_DOCUMENT` and
  `RETRIEVAL_QUERY` produce different vectors for the same text. Mixing them up
  costs accuracy without any error.

---

## Arena

Arena is the 1v1 duel: two students get the same ten questions from one
subject, and whoever is accurate and fast wins. It is **self-contained** —
its own database, its own schema, its own client. A failure in Arena must
never reach the reader.

| Piece | Where |
|---|---|
| Server logic (the only place decisions are made) | [`lib/arena/engine.ts`](lib/arena/engine.ts) |
| Pure scoring and Elo | [`lib/arena/scoring.ts`](lib/arena/scoring.ts), [`lib/arena/rating.ts`](lib/arena/rating.ts) |
| Service contract, and its two implementations | [`lib/arena/service.ts`](lib/arena/service.ts), `service.mock.ts`, `service.http.ts` |
| Request schemas | [`lib/arena/schemas.ts`](lib/arena/schemas.ts) |
| HTTP routes | `app/api/arena/**` |
| Database | [`prisma/arena.prisma`](prisma/arena.prisma) — SQLite locally, Turso when deployed |

### Rules for Arena

1. **The client decides nothing.** It never measures time, never scores, never
   sees the correct answer before a question closes. Everything is computed in
   `engine.ts` from the database.
2. **A match is not a live process.** Time moves forward on every read: `tick()`
   closes an expired question and opens the next one. There is no background
   timer, so it works the same on a serverless host.
3. **No column type that only one engine supports.** Answer options are stored
   as a JSON string because SQLite has no array column. Keep it portable.
4. **`openapi.yaml` is enforced by a test.** Add a route without documenting it
   and `lib/arena/contract.test.ts` fails. That is intentional.
5. **Tests never touch the deployed database.** `vitest.setup.ts` deletes
   `TURSO_DATABASE_URL` and points Prisma at `prisma/arena-test.db`. Do not
   weaken that.

### Known traps — Arena

- **`rewrites()` returning an array is `afterFiles`,** which is checked *before*
  dynamic routes. The reader lives at `/books/<book>/chapters/<topic>`, so a
  `/books/:path*` rule put there swallows the reader. Image rewrites belong in
  `fallback`.
- **A full match is slow against a local SQLite file** (~40 s), because every
  write is an fsync. That is a test-environment artefact, not the engine.
  Expensive assertions are grouped into one test on purpose.
- **The mock match clock only starts on `subscribe()`.** Calling `getMatch`
  alone will never advance it, which looks like a frozen match in tests.
- **Bot answers are derived from `matchId` and the question number,** so they
  are stable across re-reads. Do not make them random at read time, or the
  state will change while a player looks at it.
