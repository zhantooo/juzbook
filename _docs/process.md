# Process

How work is organised in JUZBOOK. The same rules apply to humans and to AI
agents.

---

## Core rules

1. **One issue at a time.** An agent picks a single open issue, works only on it,
   and stops when its acceptance criteria are met.
2. **Read the acceptance criteria twice** — once before starting, once before
   closing. If they cannot be checked, the issue is not ready; send it back to
   the PM.
3. **Commit regularly.** Small commits with imperative summary lines. The work in
   progress must never live only in the working tree.
4. **Issues are the only backlog.** Once `_docs/tasks.md` has been converted into
   GitHub issues, that file is removed. Ideas that live only in chat are lost.
5. **Stay in scope.** An unrelated defect found while working becomes a new
   issue, never an extra commit on the current branch.
6. **Verification is part of the work.** An issue is not done because the code
   compiles; it is done when the criteria have been checked and the evidence
   recorded.

---

## Roles

| Role | File | Does | Does not |
|---|---|---|---|
| Product manager | [`team/pm.md`](team/pm.md) | Grooms raw tasks into the four-section template, files follow-up issues for out-of-scope work, prioritises | Write production code |
| Software engineer | [`team/software-engineer.md`](team/software-engineer.md) | Implements one groomed issue, commits, comments on the issue and leaves it **open** | Close the issue; approve their own work |
| QA engineer | [`team/qa-engineer.md`](team/qa-engineer.md) | Checks each acceptance criterion, runs the verification commands, posts `## QA: PASS` or `## QA: FAIL` | Change code |

The product owner decides scope and priority and answers blocking questions.

---

## Orchestrator lifecycle

```
          ┌──────────────┐
  idea →  │  raw task    │  _docs/tasks.md or a rough issue
          └──────┬───────┘
                 │  PM grooms
          ┌──────▼───────┐
          │ groomed issue│  Goal / Acceptance criteria / Out of scope / Constraints
          └──────┬───────┘
                 │  engineer implements, commits, comments — issue stays open
          ┌──────▼───────┐
          │   QA review  │  posts ## QA: PASS or ## QA: FAIL
          └──────┬───────┘
         FAIL ◄──┴──► PASS
          │               │
   back to engineer    owner closes the issue
```

1. **Groom.** PM rewrites the task using `_docs/task-template.md`. Out-of-scope
   items become linked follow-up issues.
2. **Implement.** The engineer works on one issue, commits as they go, and posts
   a comment describing what changed and how it was verified. The engineer does
   **not** close the issue.
3. **Verify.** QA walks the acceptance criteria one by one, runs the commands in
   Constraints, and posts a verdict comment that starts with `## QA: PASS` or
   `## QA: FAIL`, followed by a checklist and the real command output.
4. **Close.** Only after a PASS. The closing comment states what shipped and what
   was deliberately left out.

---

## Clarification policy

Ask the owner only when two readings of the request would produce materially
different work — numbers that do not add up, ambiguous terms, destructive
intent, or a cost (API quota, GPU hours, disk) that should be approved first.
Do not ask about anything the repository already answers.

---

## Database and long-running work

**Schema changes**

1. Edit `prisma/schema.prisma`.
2. `npx prisma db push` (`migrate dev` fails here — note that in the PR).
3. `npx prisma generate` with the server stopped.
4. Backfill with a script under `scripts/` that reports by default and writes
   only with `--apply`.

**Batch jobs over ~5 minutes** must be resumable (per-item markers), idempotent,
non-destructive (originals copied aside first), detached from the agent session,
and self-verifying — each produced item is checked before it replaces the old
one.

---

## Verification matrix

| Change type | Required checks |
|---|---|
| Any code | `npx tsc --noEmit` |
| Routes, config, CSS | `npm run build` |
| UI | Browser at 1440×900 and 375×812, light + dark |
| API | Call the endpoint; assert status, headers and payload shape |
| Schema | Query the column; verify reader vs admin visibility |
| Content scripts | Dry run → inspect report → `--apply` → re-audit |
| Images | Before/after comparison at 1:1 pixels |

---

## Rollback

- **Code:** revert the merge commit.
- **Schema:** keep changes additive (nullable column or a default) so a revert
  loses no data.
- **Content:** restore from the backup named in the issue
  (`storage/books-original/` for figures).
- **A batch job producing bad output is stopped first and diagnosed second.**
