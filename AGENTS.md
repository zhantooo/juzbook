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

### Known traps — read before touching the catalogue

- **`Chapter.order` restarts at 1 inside every `SectionChapter`.** Never build a
  flat topic list by sorting on `order`; walk `section → chapterGroup → topics`.
- **`isHidden` exists on `Subject`, `Book`, `Section`, `SectionChapter` and
  `Chapter`.** Reader queries filter it; admin queries pass `includeHidden`.
- **Catalogue reads are cached** (`unstable_cache`, tags `catalog`,
  `catalog-navigation`). Call `revalidateCatalogViews(...)` after writes.
- **Real-ESRGAN `realesrgan-x4plus` only works with `-s 4`.** Any other scale
  silently produces corrupted tiles and still exits 0.
