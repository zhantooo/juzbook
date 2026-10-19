# Brainstorming session — JUZBOOK Arena

Condensed transcript of the scoping conversation that produced
[`spec.md`](spec.md). The assistant was asked to set the scope, offer options,
ask one question at a time and keep answers short. Every decision recorded here
was actually taken; nothing below is aspirational.

---

**Owner:** JUZBOOK is a reading platform — students read textbooks, highlight,
take tests alone. I want a second product: something competitive. Help me scope
it. One question at a time.

**Assistant:** First: what makes a student open a competitive app *again*
tomorrow — beating a friend, climbing a ladder, or a daily streak?

**Owner:** Beating someone. Real opponents, not a score screen.

**Assistant:** Then the core is a live match between two people, and everything
else (ladder, history, streaks) hangs off it. Next: do the two players answer
the *same* questions, or their own set?

**Owner:** The same. Otherwise it is not a fair duel.

**Assistant:** Agreed — one question set, delivered to both, so the comparison
is honest. Next: what decides the winner — correctness alone, or speed too?

**Owner:** Both. If two people answer correctly, the faster one should gain
more.

**Assistant:** Three formats fit that:

1. **Ten questions, speed-scored** — same ten for both, 15 seconds each, points
   for a correct answer plus a speed bonus. Match length is predictable.
2. **Hearts** — three lives, a wrong answer costs one, the match runs until
   someone is out. Unpredictable length.
3. **Three rounds by difficulty** — five easy, five medium, five hard.

**Owner:** The first. Ten questions, whoever is faster.

**Assistant:** Good — a predictable two-to-three minute match is also what makes
a rematch likely. Next, and this is the one that shapes the data model: is a
match about a *subject*, or about everything at once?

**Owner:** Per subject. A student can be strong in history and new to chemistry
— mixing them would be meaningless.

**Assistant:** That changes three things, and I want to confirm all three:

- matchmaking is scoped to a subject — Biology only meets Biology;
- rating is stored per `(player, subject)`, so there is no single global number;
- the leaderboard is per subject as well.

**Owner:** Yes, all three.

**Assistant:** Next: where do the questions come from? JUZBOOK already has a
bank of pre-generated questions per topic, with difficulty levels.

**Owner:** From there. No new generation during a match — it has to be instant.

**Assistant:** Then a match draws from the existing bank at match creation and
stores the exact ten questions with the match, so a reconnecting player sees the
same set and the result stays auditable. No AI call is on the critical path.

Next: how do two players find each other?

**Owner:** Queue for a subject and get matched. And I want to be able to
challenge a specific person too.

**Assistant:** Two entry points then: a subject queue, and a private match
joined by code. The second one is also how this gets demonstrated — two browser
windows, one code.

Next: the live part. Keeping two clients in sync needs a transport. Options:

- **Server-Sent Events plus a light poll** — no new dependency, works inside
  Next.js route handlers, survives a reconnect by replaying match state.
- **WebSockets via socket.io** — stronger, but it is a new dependency and needs
  its own server process.

**Owner:** The first. No extra dependencies.

**Assistant:** Then the server owns the clock. The client never decides whether
an answer arrived in time — it sends the answer, the server stamps it. That
also closes the obvious cheat.

Next: what stops someone opening a second tab to look up the answer?

**Owner:** Fifteen seconds is short enough. But do not send the correct answer
to the client before time is up.

**Assistant:** Recorded: the question payload carries the options only; the
correct index is revealed after the question closes. Without that rule the
answer sits in the browser's network tab.

Last one: what does a player see when the match ends?

**Owner:** Who won, the score, and which questions each got wrong — so it is
useful, not only a game.

**Assistant:** Then the result screen doubles as a review: both answers side by
side, the correct one, and the explanation from the bank. The rating change is
shown there too.

Summary of what we fixed:

1. Live 1v1 duel; same ten questions for both players.
2. Fifteen seconds per question; points for correctness plus a speed bonus.
3. Everything scoped to a subject: matchmaking, rating, leaderboard.
4. Questions drawn from the existing bank at match creation; no AI during play.
5. Two entry points: subject queue, and a private match by code.
6. Server-Sent Events plus polling; the server owns the clock.
7. The correct answer is never sent before a question closes.
8. The result screen is also a review, with explanations.

**Owner:** Write it up.

**Assistant:** Saved as `_docs/arena/spec.md`. Next I will split it into a
backlog of independent tasks in `_docs/arena/tasks.md`, then move each into a
GitHub issue tagged `mvp`.

---

## Decisions taken outside this conversation

- **Where it lives.** Arena is built inside the JUZBOOK repository rather than a
  separate one, so it can read the existing question bank directly.
- **Storage.** Arena uses its own SQLite database through a second Prisma schema,
  separate from JUZBOOK's PostgreSQL. No Postgres-only types (arrays) are used,
  so the schema stays portable.
- **Tests.** Vitest is added for Arena's own code. The project had no test
  runner before this.
