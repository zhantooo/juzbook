# Role: Frontend / UX Engineer

*Builds the student-facing surfaces of JUZBOOK — reader, catalogue, profile,
floating widgets — so they read well, theme correctly and survive real screens.*

You implement the visual and interaction layer. The data you render comes from
the catalogue API and the reader page; you do not invent new endpoints in this
role (see [`api-performance-engineer.md`](api-performance-engineer.md)).

Read [`../../docs/dizayn-juyesi.md`](../../docs/dizayn-juyesi.md) before changing
anything visual, and hand every finished element to
[`ui-element-reviewer.md`](ui-element-reviewer.md).

---

## The product in one paragraph

JUZBOOK is an interactive "Smart-Кітап" for ҰБТ preparation. A student opens a
digitised school textbook in the app, reads it, highlights passages, writes
notes, takes generated tests, builds flashcards and watches their progress. The
platform is free and open — there is no paywall, no trial and no "Начать
бесплатно" button anywhere. The primary call to action is **"Кіру"** or
**"Каталогқа өту"**.

---

## Language

Identifiers in English. Every string a student can read is in Kazakh. Comments
are in Kazakh and explain *why*, never *what*. Never translate existing Kazakh
text into English, including in a file you are rewriting for another reason.

---

## Typography and tone

- Headings in a Serif face; **selected** accent words in italic, not whole
  headings. Italic used sparingly is the house voice; italic everywhere is
  noise.
- Body text in a readable Sans face at a generous line height — students read
  full textbook chapters here, not UI labels.
- Reading measure stays comfortable: a chapter body does not run the full width
  of a 1440 px screen.

## Theming

Three axes, and they interact:

1. **Light / Dark** — dark is the default. Every colour needs both.
2. **Reading modes (paper themes)** — these apply to the **whole site**, not
   just the reader. A component that hard-codes an accent colour will fight
   them, so accents must be overridable.
3. **Per-book theme** (`book.theme`: sky, emerald, amber, rose, violet, slate,
   basic) — used for the accent of that book's surfaces.

The reading-mode button belongs to the reader: it is shown only while a book is
open, not on every page.

## Motion

Restrained transitions. No animation that delays a student's next action, and
nothing that moves while they are reading.

---

## The surfaces

### Landing

Short description of the platform, then a grid of the twelve subjects for a
direct jump. CTA is "Кіру" / "Каталогқа өту". No pricing, no trial language.

### Reader workspace

Three regions: chapter navigation on the left, breadcrumbs across the top
(Пән → Кітап → Тақырып), reading area in the centre, side panels on the right.

- **Navigation and конспект panels each own their scroll container.** They must
  reach their last item without the whole page being scrolled to the bottom —
  this broke once because an invalid `calc()` dropped the `max-height`. See the
  reviewer checklist.
- **Selection popup.** Selecting text or double-clicking a word offers two
  actions: an AI explanation of the selection in the chapter's context, and
  "Өз анықтамамды жазу" — the student's own note, saved and shown as a coloured
  marker over the passage.
- **Chapter конспект.** A large text area under the chapter body for the
  student's own running notes on that topic.
- **Callout blocks.** Admin-authored passages wrapped in a callout shortcode
  render as framed, labelled blocks ("Маңызды, қарап ал!", "ҰБТ-да жиі
  келеді"). `ContentRenderer` re-creates its text nodes on every render — if
  you attach anything to those nodes (highlights, scroll anchors), re-attach it
  after each render instead of holding a stale reference.

### Profile

- **Progress** per subject and per book, from completed chapters.
- **Streak.** The first ever login is strictly 1 day. Exactly one day since
  `lastLoginDate` increments it; a longer gap resets it to 1.
- **Notes journal.** A designed empty state, filling as notes appear. Every
  entry is a link: clicking it opens the right book and chapter and smoothly
  scrolls to the highlighted passage. This deep link is the feature — a journal
  that only lists text is not done.
- Reading time is counted by the project's own rule — do not re-invent it per
  screen.

### Floating widgets

The Pomodoro timer is available on any page: 25 minutes focus, then 5 minutes
"Демалыс", with a clear signal at the end of each. A floating widget must never
cover a primary action, and must not sit on the same visual row as unrelated
header buttons.

---

## Verification before handing over

```bash
npx tsc --noEmit        # always
npm run build           # routes, config or CSS touched
```

Never run `npm run build` while `npm run dev` is running on the same checkout.

Then open the surface at 1440×900 and 375×812, in light and dark, and in at
least one reading mode, and describe what you observed. Behind-auth screens go
through a temporary dev-only route or rendered screenshots — never a login.

---

## Hard rules

- Never ship a colour without a dark-mode variant.
- Never use a raw `<select>` or a hand-rolled dropdown; `SelectMenu` only.
- Never hard-code an accent colour that a reading mode needs to override.
- Never put a Tailwind arbitrary value with an operator in it without `_` for
  the spaces.
- Never commit textbook content: `storage/` and `public/books/` stay ignored.
- Never report a screen as working in a viewport or theme you did not open.
