# JUZBOOK — Product Specification

Saved from the brainstorming session recorded in
[`../chat-brainstorm.md`](../chat-brainstorm.md). This is the specification the
backlog is derived from.

---

## 1. Problem

Kazakh students preparing for the ҰБТ (Unified National Testing) study from
school textbooks that exist only as scanned PDFs. Those PDFs are:

- unsearchable — a student cannot find "Қарлұқ қағанаты" across 62 books;
- unreadable on a phone — a 595×842 pt page does not reflow;
- inert — no highlighting, no notes, no progress, no practice questions.

Students therefore work from photographs of pages in group chats, or from
question banks whose answers are not traceable to any textbook.

## 2. Product

A reading platform that turns the official textbooks into structured,
searchable, interactive content, and generates practice questions **grounded in
the textbook text** rather than in a model's general knowledge.

### Primary user

A 10th–11th grade student in Kazakhstan preparing for the ҰБТ, studying mostly
on a phone, in Kazakh.

### Secondary user

The platform administrator (the owner), who imports textbooks, corrects
recognition errors, and controls what is published.

---

## 3. Scope

### In scope

| # | Capability |
|---|---|
| 1 | **Catalogue** — subjects → books → sections → chapters → topics, with per-level visibility control |
| 2 | **Reader** — the textbook rendered as structured HTML: paragraphs, coloured note boxes, terms, tables, figures with captions |
| 3 | **Highlights and notes** — per user, per paragraph, surviving re-renders |
| 4 | **Progress** — topics completed, reading time, per-book percentage |
| 5 | **Question bank** — 50 pre-generated questions per topic (30 medium, 10 easy, 10 hard), balanced answer positions, no duplicates |
| 6 | **Tests** — the student draws from the bank first; AI generation unlocks only once their bank for that topic is exhausted |
| 7 | **Flashcards** — generated from a selected passage |
| 8 | **Audio** — a topic read aloud with word-level highlighting |
| 9 | **Specifications** — the official ҰБТ topic list mapped onto book topics |
| 10 | **Admin** — import textbooks from PDF, edit any topic's rich text inline, reorder and hide entities |

### Out of scope (v1)

- Social features: comments, chat, leaderboards.
- Paid plans and billing.
- Teacher or classroom accounts.
- Offline mode.
- Subjects whose textbooks are not yet imported — these stay hidden rather than
  being shown empty.

---

## 4. Content pipeline

Textbooks are not hand-typed. The pipeline is:

```
PDF → page render → Gemini OCR (text + figure boxes)
    → figure crops at the page's native pixel density
    → structured payload (sections, chapters, topics, shortcodes)
    → quality gate (scripts/check_book.py)
    → database import
```

Constraints learned from running it:

- Scanned pages are 72–100 DPI; figures must be cropped at the *source image's*
  own density, not at a fixed zoom, or detail is destroyed before it reaches the
  reader.
- Books are imported **two at a time** and reviewed by the owner before the next
  pair, because a bad batch is expensive to undo.
- Textbook PDFs and page crops are copyrighted. They are used under educational
  fair use, stay out of version control, and are never uploaded to third-party
  services.

---

## 5. Question bank rules

| Rule | Value |
|---|---|
| Questions per topic | 50 |
| Difficulty split | 30 medium (B), 10 easy (A), 10 hard (C) |
| Options per question | exactly 4, all distinct |
| Correct-answer position | balanced — each of A/B/C/D holds 20–30 % across the bank |
| Duplicates | none within a topic, by normalised text and by word overlap |
| Grounding | every question answerable from the topic text; the explanation quotes it |
| AI on demand | a student may generate new questions only after answering every pre-generated question for that topic |

The last rule exists to keep the API load bounded and predictable.

---

## 6. Technical decisions

| Decision | Choice | Reason |
|---|---|---|
| Framework | Next.js 15, App Router | Server components keep the heavy catalogue off the client; one deployable unit |
| Language | TypeScript, strict | The catalogue has five nested levels; the type system is the main safety net in a project with no test suite |
| Database | PostgreSQL + Prisma | Relational hierarchy, and Prisma's generated client documents the schema |
| AI | Google Gemini | Strong Kazakh handling and a usable free tier; accessed through a rotating multi-key pool |
| Styling | Tailwind + CSS custom properties | Tokens in `:root` drive both themes; utilities keep component files self-contained |
| Auth | Custom session cookie + bcrypt | No third-party dependency on student data |
| Rich text | CKEditor 5 | The admin edits textbook content in place, inside the reader layout |

---

## 7. Non-functional requirements

- **Kazakh first.** All UI text and code comments in Kazakh.
- **Mobile first.** Every screen works at 375 px with no horizontal scroll.
- **Accessibility.** WCAG AA contrast for text and controls; one global
  `:focus-visible` style; dark mode as a first-class theme.
- **Privacy.** Student data stays in the project's own database; no analytics
  vendor.
- **Honesty about content.** Every book shows its source attribution.

---

## 8. Success criteria for v1

- 60+ textbooks imported, each passing the quality gate.
- Every visible topic carries a full 50-question bank.
- A student can open any topic on a phone, read it, highlight a sentence, take a
  10-question test, and see their progress — without a single AI call.
