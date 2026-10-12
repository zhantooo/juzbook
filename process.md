# process.md — How Work Flows Through JUZBOOK

This document defines how a request becomes shipped code. Every participant —
human or AI — follows the same pipeline. The goal is that an agent can pick up
any stage from the written artefacts alone.

---

## 1. Pipeline overview

```
Request  →  Clarify  →  Spec  →  Issue  →  Branch  →  Implement
            ↓                                            ↓
         (blocked?)                                  Verify
            ↓                                            ↓
         Ask owner                                    Review  →  Merge  →  Observe
```

Each stage has an owner, an input, and a written output. No stage is skipped,
but small changes may collapse Spec and Issue into one short document.

---

## 2. Stage 1 — Request intake

**Input:** a message from the product owner, in Kazakh, often with screenshots.

**Owner:** PM role (see `roles/pm.md`).

The request is recorded verbatim. Screenshots are saved alongside it, because
visual defects are frequently the only precise description available.

---

## 3. Stage 2 — Clarification

A request moves forward only when it is unambiguous. Ask when, and only when,
different readings would produce materially different work.

Ask about:

- **Numbers that do not add up.** Example: "50 questions per topic, roughly 30 B,
  15 C, 15 A" sums to 60 — confirm before generating 114 000 rows.
- **Ambiguous terms.** "Variants must not repeat" can mean answer-option letters
  or question texts; confirm which, or cover both.
- **Destructive intent.** "Remove these subjects" vs "let me hide these subjects"
  are different features with different migrations.
- **Cost.** Anything consuming API quota, hours of GPU time, or disk space gets
  an explicit estimate before it starts.

Do not ask about things the repository already answers.

---

## 4. Stage 3 — Specification

**Output:** a Markdown spec, written before any code.

```markdown
## <Feature name>

### Problem
What the user experiences today, with evidence (screenshot, query result, measurement).

### Goal
One sentence. What is true after this ships.

### Scope
In scope: …
Out of scope: …

### Technical approach
Files to touch, data model changes, API shape, UI states.

### Data / migration
Schema diff, backfill plan, rollback plan.

### Acceptance criteria
- [ ] Observable, checkable statements.

### Verification plan
How this will be proven (type check, build, browser, DB query, before/after image).

### Risks
What can break, and the blast radius.
```

A spec that cannot state its verification plan is not ready.

---

## 5. Stage 4 — GitHub Issue

The spec becomes an Issue. Title is imperative and specific
("Add per-subject visibility toggle", not "Subjects"). Body carries the spec
verbatim. Labels:

| Label | Meaning |
|---|---|
| `area:reader` `area:admin` `area:content` `area:infra` | Where the work lands |
| `type:feature` `type:bug` `type:data` `type:chore` | Nature of the work |
| `risk:data` | Touches production content or the schema |
| `needs:owner-decision` | Blocked on a product answer |

Issues with `risk:data` require an explicit backup step in the spec.

---

## 6. Stage 5 — Branch and implementation

- Branch from `main`: `feat/<slug>`, `fix/<slug>`, `data/<slug>`.
- One Issue per branch. Keep the diff inside the declared scope; unrelated
  problems discovered on the way become new Issues, not extra commits.
- Commit messages: imperative summary line, then the why.
- Kazakh comments; English identifiers.

**Database changes**

1. Edit `prisma/schema.prisma`.
2. `npx prisma db push` (note: `migrate dev` fails against the shadow database
   on this project; record that in the PR).
3. `npx prisma generate` — stop the running server first.
4. If existing rows need a value, write a backfill script under `scripts/` that
   reports by default and writes only with `--apply`.

**Content and asset jobs**

Any job over ~5 minutes must be:

- **resumable** — a per-item marker file or a database condition it can re-read;
- **idempotent** — rerunning it cannot double-process an item;
- **non-destructive** — originals copied aside before anything is overwritten;
- **detached** — launched as its own process so it survives the session;
- **self-verifying** — each produced item is checked before it replaces the old
  one (for images: downscale the result and compare against the source).

---

## 7. Stage 6 — Verification

Run the strongest applicable checks and record the real output.

| Change type | Required checks |
|---|---|
| Any code | `npx tsc --noEmit` |
| Routes, config, CSS | `npm run build` |
| UI | Browser at 1440×900 and 375×812, light + dark |
| API | Request the endpoint, assert status and payload shape |
| Schema | Query the column, verify reader vs admin visibility |
| Content scripts | Dry run, inspect the report, then `--apply`, then re-audit |
| Images | Before/after comparison at 1:1 pixels |

Behind-auth pages are verified through the database, a temporary dev-only route
(deleted before merge), or rendered screenshots — never by logging in as a user.

---

## 8. Stage 7 — Review

The reviewer checks, in this order:

1. Does it satisfy the acceptance criteria?
2. Is the verification evidence real and reproducible?
3. Does it violate any boundary in `AGENT.md` §8?
4. Does it respect the data traps in `AGENT.md` §4?
5. Is the diff confined to the declared scope?
6. Are new conventions documented (`docs/`, `AGENT.md`) rather than implied?

A PR without verification evidence is returned, not merged.

---

## 9. Stage 8 — Merge and observation

- Squash-merge into `main`, referencing the Issue.
- Rebuild and restart the production process; clear `.next/cache` if cached
  catalog data changed.
- Confirm the change on the running site.
- Close the Issue with a one-paragraph summary of what shipped and what was
  deliberately left out.

---

## 10. Rollback

- **Code:** revert the merge commit.
- **Schema:** schema changes must be additive where possible (new nullable
  column or a column with a default), so a revert does not lose data.
- **Content:** restore from the backup declared in the spec
  (`storage/books-original/` for figures, `.design-backup/` for source
  snapshots).
- **A corrupted batch job is stopped first, diagnosed second.** Do not let a
  job that is producing bad output keep running while you investigate.

---

## 11. Documentation duty

Update documentation in the same PR when:

- a new convention or trap is discovered → `AGENT.md`;
- a visual or component rule changes → `docs/dizayn-juyesi.md`;
- a content-pipeline step changes → the relevant file in `docs/`.

Knowledge that exists only in a chat transcript is considered lost.
