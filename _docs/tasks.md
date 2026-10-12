# Backlog

Raw tasks in the form described in [`task-template.md`](task-template.md).
The PM grooms each one into the four-section template before implementation.

**This file is removed once every task below exists as a GitHub issue.** From
that point the issues are the only backlog.

---

## 1. Fix "next topic" navigation jumping to the next section

Goal: "Келесі тақырыпқа өту" moves to the next topic inside the same section.

Description: The flat topic list is built by sorting on `Chapter.order`, but that
number restarts at 1 inside every `SectionChapter`. After about six topics the
reader jumps into an unrelated section. The list must be built by walking
section → chapter group → topic instead.

## 2. Add per-subject visibility control

Goal: The administrator can hide a subject from students without deleting it.

Description: Subjects whose textbooks are not imported yet appear empty to
students. Today the only way to remove one is to delete it, which loses its
books and specifications. Add an `isHidden` flag on `Subject`, filter it for
readers, keep it visible in admin, and add a toggle to the admin subject header.

## 3. Hide the study panel in the admin reading view

Goal: The "Конспект және навигация" side panel does not render when an
administrator opens a book.

Description: The panel offers student tools (tests, flashcards, markers) that are
irrelevant while editing, and it narrows the editing column. Hide it for admin
users and let the content column take the freed width.

## 4. Fix figure captions overlapping body text

Goal: A figure caption sits under its image, within the image's width.

Description: Floated figures carry `float: left` on the `<img>` itself, so the
`<figcaption>` lays out beside the image instead of under it and collides with
the paragraph text. The float belongs on the `<figure>`, and the figure's width
must come from the image, not from the caption's text length.

## 5. Make coloured note boxes legible in dark mode

Goal: Text inside a `[colorbox]` is readable in both themes.

Description: The box paints a gradient that fades to transparent, which works on
a white page. In dark mode the lower half of the box reveals the near-black
page background behind dark text, making the last lines unreadable.

## 6. Stop the rich-text editor writing leftover markup into content

Goal: Saving a topic in the admin editor does not add empty `absolute`
positioned blocks to its content.

Description: The editor's "Жылжыту / Өңдеу / Өшіру" overlay is serialised with
the document. The buttons are stripped on save but their wrapper is not, so each
save appends another empty absolutely-positioned div. Strip the wrapper too, and
clean the ones already stored.

## 7. Merge paragraphs split by a page break

Goal: A paragraph broken across two textbook pages renders as one block.

Description: During recognition a paragraph that continues on the next page
becomes two blocks — the first ending in a hyphen, the second starting
lower-case. In the reader they appear as two separate coloured boxes. Detect and
merge them, removing the hyphenation.

## 8. Remove `[СУРЕТ: …]` markers rendered as visible text

Goal: No figure placeholder markers appear in the reading view.

Description: Figure captions were stored both as a `data-caption` attribute and
as literal `[СУРЕТ: …]` text inside `<figcaption>`. The literal form is shown to
students as if it were part of the lesson.

## 9. Generate a cover image for every book

Goal: Each book in the catalogue shows a distinct cover.

Description: Most textbook title pages are blank white, so a scan cannot serve as
a cover. Generate covers from the book's own data — subject, grade, part,
publisher, year — in one visual language, and size the catalogue card slot so the
cover is not cropped.

## 10. Match table styling between the reader and the admin editor

Goal: A table looks the same while editing as it does when published.

Description: Cell borders and padding are defined only in the reader's utility
classes, so in the editor a table renders as unseparated rows of text and the
administrator cannot see the column structure they are editing.

## 11. Pre-generate a question bank for every topic

Goal: Every topic has 50 ready questions before any student opens it.

Description: Each test currently calls the AI live, which is slow and burns quota
on repeat work. Pre-generate 50 questions per topic — 30 medium, 10 easy, 10 hard
— with no duplicates and with the correct answer spread evenly across the four
positions. The job must be resumable because the daily API quota will interrupt
it.

## 12. Gate on-demand AI question generation behind the bank

Goal: A student can only generate new questions once they have answered every
pre-generated question for that topic.

Description: With a 50-question bank in place, live generation should be the
exception. Both test endpoints must refuse generation while unanswered bank
questions remain, and the UI must say how many are left.

## 13. Re-crop textbook figures at their native resolution

Goal: Figures are as sharp as the source PDF allows.

Description: Figures were cropped by rendering the page at a fixed 3 px/pt, but
37 % of embedded source images are stored at a higher density — commonly
4.17 px/pt — so detail was discarded at crop time and no amount of upscaling
restores it. Locate each existing crop inside its PDF page, re-render that region
at the source image's own density, then upscale.

## 14. Reduce the catalogue API payload

Goal: The app-wide catalogue request is under 130 KB on the wire.

Description: `GET /api/catalog?view=navigation` returns 1.74 MB uncompressed on
every page load, including the landing and login pages. Roughly half of it is the
`excerpt` of all 2 282 topics, which no reader screen uses. The response is sent
without compression and without cache headers.
