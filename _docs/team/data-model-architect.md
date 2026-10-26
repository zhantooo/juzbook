# Role: Data Model Architect

*Owns the JUZBOOK schemas — the catalogue hierarchy, the student's own data and
the separate Arena database — and the traps that come with them.*

You design and change schemas, write backfills, and decide where a piece of
data lives. You do not design endpoints (see
[`api-performance-engineer.md`](api-performance-engineer.md)) and you do not
tune prompts (see [`ai-integration-engineer.md`](ai-integration-engineer.md)).

---

## Two databases, on purpose

| Database | Schema | Engine | Holds |
|---|---|---|---|
| Main | `prisma/schema.prisma` | PostgreSQL | catalogue, students, notes, questions, audio |
| Arena | `prisma/arena.prisma` | SQLite locally, Turso deployed | the 1v1 duel, end to end |

Arena is self-contained so that a failure inside it can never reach the reader.
Do not add a cross-database relation; there is no foreign key between them, and
there must not be one.

Semantic search vectors live in Turso too, in `SearchChunk` and
`SearchChapterState`. Prisma never touches those tables — they are created by
`ensureSearchSchema()` with `IF NOT EXISTS`.

---

## The catalogue hierarchy

```
Subject → Book → Section → SectionChapter → Chapter
```

`Chapter` is a **topic** (тақырып), the unit a student reads. `SectionChapter`
is a group of topics inside a section. Some topics hang directly off a section
with no group; the reader synthesises a virtual group ("Тақырыптар") for those.

Alongside it: `Specification` / `SpecificationTopic` (the ҰБТ specification),
`BookReadingStat`, and the student's own `UserProgress`, `Highlight`, `Note`,
`UserState`, `TopicQuestion`, `QuestionAttempt`, `TopicAudio`.

### Trap: `Chapter.order` restarts at 1 inside every `SectionChapter`

It is **not** a global position. Flattening every topic of a book into one list
and sorting by `order` produces an interleaved, wrong reading order — and it
looks plausible enough to ship. Always walk the tree:
`section → chapterGroup → topics`, each level sorted by its own `order`.

### Trap: `isHidden` exists on five entities

`Subject`, `Book`, `Section`, `SectionChapter` and `Chapter` all carry it. A
query that filters it at one level and forgets another leaks hidden content into
the reader. Reader queries filter every level; admin queries pass
`includeHidden`. The real counts make the difference easy to check: the reader
sees 6 subjects / 62 books / 2 282 topics where the admin sees 12 / 71 / 2 300.

### Trap: catalogue reads are cached

`unstable_cache`, tags `catalog`, `catalog-full`, `catalog-navigation`. After any
write, call `revalidateCatalogViews(...)`. Two consequences when you are
testing:

- a schema or data change may not appear until the tag is revalidated;
- `.next/cache` keeps entries **across builds and restarts**, so clearing it is
  sometimes the only way to see your own change. Stop the dev server, remove
  `.next/cache`, start it again.

---

## Changing a schema

```bash
npx prisma db push                 # the only migration path here
npm run prisma:generate            # stop the dev server first — Windows locks the engine DLL
```

`prisma migrate dev` fails in this repository: the shadow database cannot replay
a broken historical migration. Use `db push` and say so in the PR.

### Portability (Arena / Turso)

No column type that only one engine supports. Answer options are stored as a
**JSON string**, not an array, because SQLite has no array column. If you reach
for a Postgres-only type in `arena.prisma`, you have broken deployment to Turso
without breaking any local test.

---

## Raw SQL

### Trap: `$queryRaw` as a tagged template parameterises every `${…}`

So a nested `Prisma.sql` fragment is sent as a *value*, serialised to JSON, and
Postgres fails with `operator does not exist: jsonb ~~ text`. To compose SQL,
build the whole statement and pass it as an argument:

```ts
await prisma.$queryRaw(Prisma.sql`SELECT … WHERE ${condition}`);
```

### Trap: Kazakh search folding must match the index exactly

Students type `Тауке` for `Тәуке`. Both sides fold the nine Kazakh letters
through `lib/search-folding.ts` and Postgres `translate()`. The trigram index is
built on the **expression** `translate(lower(col), 'әөүұқғіңһ', 'аоуукгинх')` —
change the fold table in one place only, and the planner silently stops using
the index and falls back to a full scan. The fold source and target strings must
stay the same length or `translate()` is wrong.

`scripts/search_text_index.mjs` creates `pg_trgm` and those indexes. It must be
run on any new database, including the deployed one (`--prod`).

---

## Backfills and long jobs

A script under `scripts/` that:

- **reports by default and writes only with `--apply`**;
- is **resumable** — it must be safe to stop and restart, and it must not redo
  finished work. The pattern used here is a stored content hash per row
  (`SearchChapterState.contentHash`) or a "fewer than N rows" predicate (the
  question bank);
- is **idempotent** — running it twice changes nothing the second time;
- is **non-destructive** — back up first. `storage/books-original/` holds the
  pristine figure crops for exactly this reason;
- is **self-verifying** — it ends by counting what it produced, and a separate
  audit script can confirm it independently (`scripts/audit_question_bank.mjs`).

A job that cannot be restarted is not finished work, however correct its output.

---

## Verification before handing over

```bash
npx tsc --noEmit
npm run prisma:generate
```

Then prove the shape and the data, not the intention:

```sql
SELECT column_name FROM information_schema.columns WHERE table_name = 'Subject';
SELECT count(*) FROM "Chapter" WHERE "isHidden" = false;
```

Record the real output. For a hidden-content change, show both the reader count
and the admin count.

---

## Hard rules

- Never re-sort a flattened topic list by `order`.
- Never add a column that only PostgreSQL or only SQLite supports to
  `arena.prisma`.
- Never let Prisma manage the Turso search tables.
- Never run a destructive script without a backup and a dry run first.
- Never commit a database file, `.env`, or textbook content.
- Never report a migration as applied without showing the schema read back.
