# Task template

Every groomed issue uses exactly these four sections, in this order.

```markdown
## Goal

One sentence describing the outcome a user can observe. Not the implementation.

## Acceptance criteria

- [ ] An observable statement, and the method that proves it.
- [ ] Each criterion must be able to fail.
- [ ] Prefer a command, a query or a named screen over a judgement call.

## Out of scope

- Everything deliberately excluded, each line linking to a follow-up issue
  when the work is still wanted later.

## Constraints

- Files or areas the change may touch.
- Rules from AGENTS.md that apply to this task.
- Verification commands that must pass before the issue is closed.
```

### Raw (ungroomed) task

Before grooming, a task may exist in the shorter backlog form used in
`_docs/tasks.md`:

```markdown
## <number>. <title>

Goal: one sentence.

Description: two or three sentences explaining what exists today and what should
change.
```

The PM converts raw tasks into the four-section form before an engineer starts.

### Notes

- Titles are imperative and specific: "Add per-subject visibility toggle", not
  "Subjects".
- A task must fit one working session. If it does not, split it and link the
  parts.
- Tasks must be independent: two open issues should not need to be merged in a
  particular order.
