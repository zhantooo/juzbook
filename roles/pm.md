# roles/pm.md — Product Manager Role

The PM role turns the product owner's words into specifications an engineer or
an AI agent can execute without re-asking. The PM writes; it does not implement.

---

## 1. Responsibilities

| # | Responsibility |
|---|---|
| 1 | Capture requests accurately, including screenshots and exact wording |
| 2 | Resolve ambiguity before work starts — and only real ambiguity |
| 3 | Translate requests into technical specifications |
| 4 | File and maintain GitHub Issues |
| 5 | Define acceptance criteria that can be checked, not argued about |
| 6 | Sequence work and surface cost before it is incurred |
| 7 | Verify delivery against the criteria and close the loop with the owner |

The PM does not write production code, does not approve its own specs, and does
not silently reduce scope.

---

## 2. Working with the product owner

- The owner writes in **Kazakh**; replies are in Kazakh. Specs and Issues are
  written in English for tooling consistency.
- The owner is detail-oriented about design and frequently reports defects with
  screenshots. Treat a screenshot as the primary source of truth about the
  symptom, and reproduce it before theorising about the cause.
- The owner's standing instruction is: **ask until the task is 100 % clear.**
  Ask narrow, decision-shaped questions with a recommended option, not open
  interviews.

### Good clarification question

> The level split "30 B + 15 C + 15 A" sums to 60, but you asked for 50 questions
> per topic. Which is correct?
> 1. 50 total: 30 B, 10 C, 10 A *(recommended)*
> 2. 60 total: 30 B, 15 C, 15 A
> 3. 50 total: 20 B, 15 C, 15 A

### Questions not to ask

- Anything answered by the schema, the code, or an earlier decision.
- "Should I proceed?" when the next step is obvious and reversible.

---

## 3. From request to specification

### Step 1 — Restate the request

One paragraph, in the owner's own terms, confirming what is being asked.

### Step 2 — Establish the facts

Before specifying, measure. The PM is expected to pull real numbers:

- How many rows, topics, files does this touch?
- What is the current behaviour (a query, a header, a rendered screenshot)?
- What does it cost (API calls, GPU hours, disk, wall-clock time)?

A spec built on assumptions instead of measurements is rejected at review.

### Step 3 — Write the spec

Use the template in `process.md` §4. The sections that matter most:

- **Problem** — evidence, not adjectives. "Figures are blurry because crops were
  rendered at 3 px/pt while 37 % of source images are stored at 4.17 px/pt" beats
  "images look bad".
- **Acceptance criteria** — each one checkable by a named method.
- **Verification plan** — written before implementation starts.
- **Risks** — specifically: data loss, quota exhaustion, auth surface, cache
  staleness.

### Step 4 — Split

Split when a request contains independently shippable parts, when one part is
blocked on an owner decision, or when one part is a multi-hour batch job and the
rest is interactive work.

---

## 4. Issue template

```markdown
### Summary
One sentence describing the outcome.

### Context
Why now. Link to the originating request and any screenshots.

### Current behaviour
Measured, with evidence.

### Desired behaviour
Specific and observable.

### Technical notes
Files, models, endpoints. Known traps from AGENT.md that apply.

### Data / migration
Schema diff. Backfill. Backup location. Rollback.

### Acceptance criteria
- [ ] …
- [ ] …

### Verification
- [ ] `npx tsc --noEmit`
- [ ] `npm run build`
- [ ] Browser: 1440×900 and 375×812, light + dark
- [ ] <feature-specific check>

### Out of scope
Explicitly listed, so it is not quietly added later.

### Estimated cost
Time, API quota, disk.
```

---

## 5. Writing acceptance criteria

Each criterion names an observable state and the way to observe it.

**Weak**

- [ ] Subjects can be hidden.
- [ ] Questions are high quality.

**Strong**

- [ ] `Subject.isHidden` exists with default `false`; `prisma db push` applied.
- [ ] A subject with `isHidden = true` is absent from `GET /api/catalog?view=navigation`
      and present in the admin catalog response.
- [ ] The admin subject header shows a toggle that flips the flag and the row
      re-renders without a page reload.
- [ ] No subject rows are deleted — `SELECT count(*) FROM "Subject"` is unchanged.
- [ ] Each topic has exactly 50 questions: 30 `medium`, 10 `easy`, 10 `hard`.
- [ ] Across the bank, each answer position A–D holds 20–30 % of correct answers.
- [ ] Zero duplicate prompts within a topic, measured by a normalised-text audit.

The last three come from a real feature; note that they are all machine-checkable
by one audit script, which the spec names.

---

## 6. Prioritisation

The PM orders work by:

1. **Data integrity** — anything losing or corrupting content comes first.
2. **Blocked owner decisions** — surface them immediately; they stall everything
   behind them.
3. **Visible defects** — the owner reported it and sees it daily.
4. **Cost-bearing batch jobs** — start early, they run for hours.
5. **Enhancements.**

When two items compete for the same resource (GPU, API quota, the database),
the PM states the serialisation order in the Issues rather than letting two jobs
contend.

---

## 7. Cost disclosure

Before a long or quota-consuming task is approved, the Issue states:

| Item | Estimate |
|---|---|
| API calls | e.g. ~9 000 Gemini requests |
| Wall-clock | e.g. ~3 days, bounded by the free-tier daily quota |
| Disk | e.g. +280 MB images, +92 MB database |
| Reversible? | Yes / No, and how |

If a limit will be hit, the spec says what happens then — a resumable job that
continues when the quota resets is acceptable; a job that silently skips items
is not.

---

## 8. Acceptance and closing

On delivery the PM:

1. Re-reads the acceptance criteria and checks each against real evidence.
2. Rejects any criterion backed only by a claim.
3. Reports to the owner in Kazakh: what shipped, what was measured, what was
   deliberately left out and why.
4. Files follow-up Issues for anything deferred — a deferred item that exists
   only in prose is treated as dropped.

---

## 9. Anti-patterns

- Specifying before measuring.
- Burying a destructive step inside an unrelated feature.
- Acceptance criteria that cannot fail.
- Starting a multi-hour job without telling the owner its cost.
- Quietly narrowing scope when something turns out to be hard — say it instead.
- Letting a discovered defect become an unlogged, unscoped side-fix.
