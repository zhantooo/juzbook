# AGENT.md — Working Agreement for AI Agents on JUZBOOK

This file is the entry point for any AI agent (Claude Code, Copilot, Cursor, or a
custom pipeline) that reads, writes, or reviews code in this repository. Read it
fully before the first edit.

---

## 1. Product context

**JUZBOOK** is a Kazakh-language study platform for the ҰБТ (Unified National
Testing) exam. Students read digitised school textbooks inside the app, highlight
passages, take AI-assisted tests, build flashcards, and track progress.

| Property | Value |
|---|---|
| Primary audience | Kazakh high-school students preparing for ҰБТ |
| Interface language | Kazakh (`kk`), with partial English support in the test generator |
| Content | 62 digitised textbooks across 6 subjects, ~2 300 topics, ~7 500 figures |
| Deployment | Self-hosted Node process (`next start`), optionally exposed via a Cloudflare tunnel |

**The textbooks are copyrighted.** They are used for educational purposes only.
This has hard consequences listed in §8.

---

## 2. Tech stack

| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js (App Router, RSC) | `^15.3.3` (running 15.5.18) |
| Runtime | React | `^19.1.0` |
| Language | TypeScript (strict) | `^5.8.3` |
| Styling | Tailwind CSS 3 + CSS custom properties | `^3.4.17` |
| ORM | Prisma Client (custom output path) | `^6.8.2` |
| Database | PostgreSQL via `@prisma/adapter-pg` + `pg` | — |
| Validation | Zod | `^4.4.3` |
| Forms | react-hook-form + `@hookform/resolvers` | — |
| Auth | Custom session cookie + bcryptjs | — |
| AI | Google Gemini via `@google/genai` | `^1.52.0` |
| Rich text | CKEditor 5 (classic build) | `^44.3.0` |
| Icons / motion / toasts | lucide-react, framer-motion, sonner | — |
| Mail | nodemailer | `^8.0.10` |

**Not present, do not assume:** no test runner, no ESLint config file (only
`next lint`), no Storybook, no CI pipeline, no Docker setup.

---

## 3. Repository map

```
app/                 Next.js App Router. Pages + route handlers under app/api/.
  api/               admin, audio, auth, catalog, generate-flashcard,
                     generate-test, reading, specifications, topic-audio,
                     topic-questions, user, users
components/
  admin/             Catalog editor, chapter editor, rich-text editor
  reader/            Reading workspace, content renderer, test generator
  state/             React context providers (catalog, auth, pomodoro)
  ui/                Design-system primitives: Button, Input, Card, SelectMenu
  …                  auth, avatar, books, flashcards, garden, landing, notes,
                     planner, pomodoro, profile, site, specifications, subjects
lib/
  prisma.ts          Singleton Prisma client
  catalog-db.ts      All catalog queries + `unstable_cache` wrappers
  catalog-utils.ts   Pure helpers over catalog records
  question-generator.ts  Gemini test-question generation
  gemini-keys.ts     Multi-key rotation pool with cooldowns
  sanitize.ts        HTML sanitisation for stored rich text
  security/          auth, session, validation, rate-limit, mailer, juz40 (SSO)
prisma/schema.prisma 17 models
scripts/             Content pipeline (PDF → OCR → payload → DB). Node + Python.
public/              Static assets. `public/books/<slug>/` holds figure images.
storage/             Non-public data: book-pdf/, topic-audio/, books-original/
docs/                Project documentation (design system, book requirements, …)
types/               Shared ambient types
generated/prisma-client/  Generated Prisma Client — never edit by hand
```

---

## 4. Data model essentials

Hierarchy: `Subject → Book → Section → SectionChapter → Chapter`.
`Chapter` is the actual topic a student reads.

```
Subject   id, name, description, isHidden
Book      id, title, subjectId, order, isHidden, coverImage, theme,
          sourceInfo, sourceLink, pdfFileName, hasPdf
Section   id, bookId, title, order, isHidden
SectionChapter  id, sectionId, title, order, isHidden      (= "chapter group")
Chapter   id, bookId, sectionId, sectionChapterId, title, excerpt,
          content (HTML + shortcodes), pdfPage, order, isHidden
TopicQuestion   chapterId, prompt, options[4], answerIndex, explanation,
                difficulty (easy|medium|hard), source (ai|admin|student)
QuestionAttempt userId + questionId (unique), isCorrect
```

Other models: `User`, `UserProgress`, `UserState`, `Highlight`, `Note`,
`BookReadingStat`, `PasswordResetToken`, `Specification`, `SpecificationTopic`,
`TopicAudio`.

### Traps you must respect

1. **`Chapter.order` restarts at 1 inside every `SectionChapter`.**
   Never build a flat topic list by sorting on `order`. Always walk
   `section → chapterGroup → topics` in traversal order. Breaking this makes
   "next topic" navigation jump to the wrong section.
2. **`isHidden` exists on `Subject`, `Book`, `Section`, `SectionChapter` and
   `Chapter`.** Reader queries filter hidden rows; admin queries pass
   `includeHidden` and must keep them visible.
3. **`Chapter.content` is HTML plus custom shortcodes** —
   `[colorbox color="#…"]…[/colorbox]`, `[danger]`, `[term]`, `[termgroup]`,
   `[tree]`. It is parsed by `components/reader/content-renderer.tsx` and
   produced by `components/admin/rich-text-editor-client.tsx`. Both sides must
   stay in sync.
4. **Figure markup** is `<figure data-juz-image="true" data-align data-width
   data-caption><img src="/books/<slug>/<name>.jpg?v=<hash>"><figcaption>…`.
   The `?v=` stamp is a cache buster derived from the file hash.
5. **Catalog reads are cached** with `unstable_cache` (tags `catalog`,
   `catalog-navigation`, revalidate 3600). After writing catalog data, call
   `revalidateCatalogViews(...)`, otherwise the UI serves stale rows.

---

## 5. Code style

- **Language of the code:** identifiers in English, **comments and all
  user-facing strings in Kazakh.** Do not translate existing Kazakh comments or
  UI copy to English. New comments are written in Kazakh too.
- **Comments explain _why_, not _what_.** The codebase favours short
  explanations of non-obvious decisions and traps over narration.
- TypeScript strict mode. No `any` unless there is no alternative; prefer
  narrowing helpers and Zod schemas at boundaries.
- Server work lives in route handlers and server components; client components
  are marked `"use client"` and kept thin.
- Validate every external input with Zod (`lib/security/validation.ts` holds the
  shared schemas).
- **Styling:** Tailwind utilities, with design tokens from `app/globals.css`
  (`--accent`, `--focus-ring`, `--radius-*`, the `--z-*` scale). Follow
  `docs/dizayn-juyesi.md`: four radius steps, a seven-step z-index scale, one
  global `:focus-visible` rule, WCAG AA contrast for buttons and form text.
- **Use `components/ui` primitives.** Every dropdown goes through `SelectMenu`;
  buttons should migrate to `ui/Button` rather than re-rolling pill styles.
- Dark mode is class-based (`.dark`). Any new colour needs both variants.

---

## 6. Commands

```bash
npm run dev            # dev server on :3000
npm run build          # production build
npm start              # next start -p 3000
npm run lint           # next lint
npm run prisma:generate
npm run prisma:seed
npx tsc --noEmit       # type check — the main automated gate
```

Operational notes:

- **Never run `next build` while the dev server is running** on the same
  checkout; they fight over `.next`.
- Stop the running server before `prisma generate` — Windows locks the query
  engine DLL.
- `prisma migrate dev` currently fails against the shadow database because of a
  broken historical migration. Use `prisma db push` for schema changes and say
  so in the PR.
- `.next/cache` holds `unstable_cache` entries across builds. If data changes
  are not visible after a deploy, clear it and restart.

---

## 7. Verification expectations

There is no test suite. An agent's change is **not** finished until it has been
verified by the strongest applicable means:

1. `npx tsc --noEmit` — mandatory for every code change.
2. `npm run build` — mandatory for anything touching routes, config, or CSS.
3. **Browser verification** for UI changes: check desktop (1440×900) and mobile
   (375×812), light and dark. Report what you observed, not what you expect.
4. **Database scripts must be dry-run first.** Every script that mutates
   content takes a report mode by default and writes only with `--apply`.
5. Content/image changes: verify against the source PDF or a rendered sample,
   and include before/after evidence.

Report failures honestly, with the actual output. Never describe unverified work
as done.

---

## 8. Boundaries — hard rules

**Secrets and privacy**

- Never commit `.env` or any key. Never print a full API key in output.
- The repository stays **private**. Do not add remotes, publish, or mirror it.
- Do not upload textbook content, PDFs, or figures to third-party services.
- Do not send the owner's email address anywhere outside the repository.

**Authentication**

- Never weaken `middleware.ts` or the auth helpers to make testing easier.
- Agents do not log in as a user, do not enter passwords, and do not inject
  session cookies. Verify behind-auth behaviour through the database, a dev-only
  route, or rendered images instead.

**Destructive operations**

- Back up before overwriting generated assets. `storage/books-original/` holds
  the pristine figure crops; keep it intact.
- Image tooling: Real-ESRGAN `realesrgan-x4plus` only works with `-s 4`. Any
  other scale silently produces corrupted tiles with exit code 0. Always verify
  output by downscaling it back and comparing against the source.
- Long-running jobs (OCR, image processing, question generation) must be
  **resumable** (per-item markers) and launched detached from the agent session.

**AI usage**

- Gemini calls go through `lib/gemini-keys.ts` (multi-key pool with per-minute
  and per-day cooldowns). Do not bypass it.
- The model id lives in one place (`QUESTION_MODEL`, default
  `gemini-3.5-flash`). `gemini-2.5-flash` is no longer available on this account.
- Do not work around Gemini's recitation filter; fall back to local processing.

**Scope**

- Do not refactor beyond the request. Do not rename files, reorganise folders, or
  change formatting across untouched code.
- When a requirement is ambiguous in a way that changes the result, ask before
  building.
