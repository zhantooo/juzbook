# Brainstorming session — JUZBOOK

Condensed transcript of the scoping conversation that produced
[`_docs/plan.md`](_docs/plan.md). The assistant was asked to set the scope, offer
options, ask one question at a time and keep answers short. Decisions reached
here are the ones implemented in the repository; nothing below is aspirational.

---

**Owner:** I want to build something for ҰБТ preparation. Kazakh students study
from school textbooks that only exist as scanned PDFs. Help me scope this. Ask
one question at a time and keep it short.

**Assistant:** Understood. First question: who is the primary user — the student
preparing alone, a teacher assigning work, or a tutoring centre managing a group?

**Owner:** The student, alone. Mostly on a phone.

**Assistant:** Then the reading experience is the product, not a dashboard. Next:
what is wrong with the PDF today — is it that students cannot find things, that
it does not fit a phone screen, or that it is passive?

**Owner:** All three. You cannot search across 62 books, a page does not reflow
on a phone, and you cannot highlight or take notes.

**Assistant:** So the core is converting scanned pages into structured content
rather than displaying the PDF. That is a content pipeline, not a viewer. Do you
already have the textbooks, and are you allowed to use them?

**Owner:** I have the PDFs. They are official school textbooks — copyrighted. I
use them for educational purposes only.

**Assistant:** Then two constraints are fixed from the start: the files never go
into version control or to a third-party service, and every book shows its source
attribution. I will put both in the agent rules. Next: how should a topic look
once converted — plain text, or the textbook's own structure?

**Owner:** The textbook's structure. The coloured note boxes, the terms, the
tables, the figures with their captions. It should feel like the book.

**Assistant:** That means a custom markup layer, not Markdown. I suggest
shortcodes stored in the database — `[colorbox]`, `[danger]`, `[term]`,
`[termgroup]`, `[tree]` — rendered by one component, and produced by the admin
editor. One parser, one renderer, kept in sync. Agreed?

**Owner:** Agreed.

**Assistant:** Next: what does the student do beyond reading?

**Owner:** Highlight, take notes, see progress, and practise with questions.

**Assistant:** Questions are where this gets expensive. Two options:
(a) generate with AI on demand each time, or
(b) pre-generate a bank per topic and only call AI when the bank is exhausted.
(a) is simpler; (b) is predictable, cheaper and works offline-ish. Which?

**Owner:** (b). I do not want the API hammered every time someone opens a test.

**Assistant:** Then I need numbers. How many questions per topic, and at which
difficulty levels?

**Owner:** 50 per topic. Roughly 30 medium, 10 easy, 10 hard.

**Assistant:** Two failure modes to guard against: the model repeating itself, and
the correct answer landing on the same letter most of the time. Should I enforce
both?

**Owner:** Both. It must never end up 80 % B.

**Assistant:** Recorded as hard acceptance criteria: zero duplicate prompts within
a topic, and each of A/B/C/D holding 20–30 % of correct answers across the bank.
Both are machine-checkable by one audit script.

Next: where do the questions come from — the model's general knowledge, or the
textbook text?

**Owner:** The textbook only. The explanation should quote the book.

**Assistant:** Good — that also makes them verifiable. Next: subjects whose books
you have not imported yet. Show them empty, or hide them?

**Owner:** Hide them. But hide, not delete — I will import those books later.

**Assistant:** So visibility is a flag at every level: subject, book, section,
chapter group and topic. Admin sees everything; students see only what is
published.

Next: what does the administrator need?

**Owner:** Import a book from PDF, and fix recognition errors directly in the
reading view — without a separate admin screen.

**Assistant:** Inline editing inside the reader, then. That argues for a rich-text
editor embedded in the reading column rather than a form.

Next: stack. Given a Kazakh-language, mobile-first reader with a relational
content hierarchy and no team, I would suggest:

- Next.js App Router — server components keep a large catalogue off the client,
  and it is one deployable unit;
- PostgreSQL with Prisma — the hierarchy is genuinely relational;
- TypeScript strict — with no test suite, the type system is the safety net;
- Tailwind with CSS custom properties for the two themes;
- Gemini for recognition and question generation — good Kazakh, usable free tier.

Any objection?

**Owner:** No. Use that.

**Assistant:** One more scoping question. What are you explicitly *not* building
in v1?

**Owner:** No comments, no chat, no leaderboards, no payments, no teacher
accounts, no offline mode.

**Assistant:** Then the specification is ready. Summary of what we fixed:

1. Primary user: a student, on a phone, in Kazakh.
2. Product: structured reading, not a PDF viewer.
3. Content: shortcode markup preserving the textbook's own structure.
4. Interaction: highlights, notes, progress, flashcards, audio.
5. Questions: 50 per topic (30/10/10), grounded in the text, no duplicates,
   balanced answer positions; AI on demand only after the bank is exhausted.
6. Visibility: a hide flag at every catalogue level — never delete to hide.
7. Admin: PDF import plus inline editing inside the reader.
8. Stack: Next.js 15, TypeScript, PostgreSQL + Prisma, Tailwind, Gemini.
9. Out of scope: social, payments, teachers, offline.
10. Hard constraints: copyrighted content never leaves the machine; no secrets in
    version control.

**Owner:** Write it up as the specification.

**Assistant:** Saved as `_docs/plan.md`. I will split it into a backlog next —
one task per session, independent of each other — in `_docs/tasks.md`, and then
move each task into a GitHub issue.

---

## What happened after the brainstorm

The specification was split into the 14 tasks in
[`_docs/tasks.md`](_docs/tasks.md). Each became a GitHub issue, groomed into the
four sections of [`_docs/task-template.md`](_docs/task-template.md).

Several decisions above were later tested against reality and are worth
recording, because they changed how the work was done:

- **"Pre-generate the bank" met the daily API quota.** The generation job is
  resumable and retries when the quota resets, rather than skipping topics.
- **"It should feel like the book" exposed a resolution bug.** Figures had been
  cropped at a fixed page zoom; 37 % of the source images are stored at a higher
  density, so detail was discarded before any upscaling. Re-cropping at the
  source density fixed it.
- **"Hide, not delete" was initially implemented as an automatic rule** (hide any
  subject with no visible books). The owner corrected it: hiding must be an
  explicit, reversible action the administrator controls.

These corrections are why `AGENTS.md` carries a "known traps" section — each one
cost a rework cycle.
