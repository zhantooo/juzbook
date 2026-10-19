# Arena backlog

Raw tasks derived from [`spec.md`](spec.md), in the form described in
[`../task-template.md`](../task-template.md). The PM grooms each one into the
four-section template before implementation.

Tasks are grouped by the iteration order in `spec.md` §7. Everything here is
MVP and carries the `mvp` label once it becomes a GitHub issue.

**This file is removed once every task below exists as a GitHub issue.**

---

## Iteration 0 — foundation

## 1. Add Vitest and a first unit test

Goal: the project can run automated tests.

Description: JUZBOOK has no test runner, so nothing can be verified
automatically. Add Vitest with a `npm test` script and one real test over a pure
function, so the harness is proven rather than assumed.

## 2. Add the Arena Prisma schema on SQLite

Goal: Arena has its own database, separate from the reader's PostgreSQL.

Description: Create `prisma/arena.prisma` with a SQLite datasource reading
`ARENA_DATABASE_URL`, its own generated client output, and the models from the
spec. No scalar list columns — Prisma does not support them on SQLite.

## 3. Generate and wire the Arena Prisma client

Goal: server code can query the Arena database.

Description: Add the generate step, a singleton client module under
`lib/arena/`, and confirm both clients (reader and arena) coexist without
clashing.

## 4. Seed Arena questions from the JUZBOOK bank

Goal: Arena has questions to play with, without querying PostgreSQL at runtime.

Description: A script copies questions from `TopicQuestion` into Arena's SQLite,
keeping subject, difficulty, options, answer and explanation. Options are stored
as a JSON string. The script is resumable and reports counts per subject.

## 5. Decide which subjects can be played

Goal: a subject is offered only when it has enough questions for a match.

Description: A subject needs at least 60 questions in the right difficulty mix
to fill a ten-question match without repeats. Expose this as a query used by the
subject picker.

## 6. Scaffold Arena routes and navigation

Goal: Arena is reachable from the app.

Description: Add `app/arena` with the page shells (subject picker, queue, match,
result, ladder) and a navigation entry. Pages render placeholders at this stage.

## 7. Define the Arena service interface

Goal: every backend call the UI makes goes through one module.

Description: `lib/arena/service.ts` declares the interface the UI depends on —
queue, match, answer, stream, rating, history. No implementation yet.

## 8. Arena layout shell and design tokens

Goal: Arena screens share one visual language with JUZBOOK without copying the reader.

Description: A match-focused shell: large touch targets, a prominent timer slot,
no reading chrome. Uses the existing tokens in `app/globals.css`.

---

## Iteration 1 — frontend against a mock

## 9. Implement the mock service

Goal: the full Arena flow is playable with no backend.

Description: `lib/arena/service.mock.ts` implements the interface in memory with
seeded fixtures, including a simulated opponent that answers on a timer.

## 10. Subject picker screen

Goal: a player chooses the subject they want to play.

Description: Lists playable subjects with the player's rating and rank in each.
Subjects without enough questions are shown as unavailable with a reason.

## 11. Queue screen

Goal: a player waiting for an opponent sees that something is happening.

Description: Shows elapsed wait, the subject, an estimated queue position and a
cancel button.

## 12. Create a private match

Goal: a player can challenge a specific person.

Description: Creates a match with a short shareable code and waits for the
second player on the same screen.

## 13. Join a private match by code

Goal: the invited player can enter the match.

Description: A code entry field with validation and clear errors for an unknown,
full or finished match.

## 14. Match screen layout

Goal: the match screen holds the question, options, timer, both scores and
progress.

Description: One screen, no scrolling during play at 375 px.

## 15. Question card component

Goal: the question is readable and does not shift as it loads.

Description: Renders the prompt with the same text rules as the reader, with a
fixed height reserved so options do not jump.

## 16. Answer options with keyboard support

Goal: a player can answer with the mouse, touch or keyboard.

Description: Four options; keys 1–4 select, Enter confirms. The selected state
is visible before the result is known.

## 17. Countdown timer

Goal: the player can see how long is left.

Description: A 15-second visual countdown plus a text value for screen readers.
Display only — the server decides what is in time.

## 18. Opponent progress indicator

Goal: the player knows whether the opponent has answered.

Description: Shows "answered" or "still thinking" without revealing what the
opponent chose.

## 19. Per-question result reveal

Goal: after a question closes, both players see what was right.

Description: Marks the correct option, the player's own choice, the points
gained and the explanation.

## 20. Running score display

Goal: both totals are visible at all times during a match.

Description: Updates after each question with the points added.

## 21. Match end screen

Goal: the player sees the outcome immediately.

Description: Winner, final scores, rating change, and buttons for a rematch and
for returning to the subject list.

## 22. Result review list

Goal: the match is useful for studying, not only for winning.

Description: All ten questions with both players' answers, the correct option
and the explanation from the bank.

## 23. Rating change display

Goal: the player understands why their rating moved.

Description: Shows the before and after values for that subject and the delta.

## 24. Leaderboard screen

Goal: a player can see where they stand in a subject.

Description: Top players for the chosen subject plus the current player's own
row, even when outside the visible range.

## 25. Match history screen

Goal: a player can revisit past matches.

Description: Lists finished matches filtered by subject, each opening the result
review.

## 26. Mobile layout pass

Goal: Arena is comfortable on a phone.

Description: Verify every Arena screen at 375 px: no horizontal scroll, options
reachable with one thumb, the timer always visible.

---

## Iteration 2 — the contract

## 27. Create openapi.yaml with auth and shared schemas

Goal: the API has a written contract.

Description: `openapi.yaml` at the repository root: info, security scheme for
the existing session cookie, and the shared component schemas.

## 28. Specify matchmaking endpoints

Goal: queue and private match endpoints are defined before they are built.

Description: Join and leave the queue, create a private match, join by code,
with request and response bodies and error cases.

## 29. Specify match play endpoints

Goal: match state and answering are defined.

Description: Fetch match state, submit an answer, and the shapes returned for
each question's result.

## 30. Specify the match event stream

Goal: the realtime channel is part of the contract.

Description: Document the SSE endpoint and each event type — `question`,
`answer-result`, `score`, `match-end` — with payloads.

## 31. Specify rating, leaderboard and history endpoints

Goal: the read-side API is defined.

Description: Per-subject rating, leaderboard with paging, and match history.

---

## Iteration 3 — backend with an in-memory store

## 32. In-memory store module

Goal: the backend works end to end before any database exists.

Description: A module holding matches, queue entries, answers and ratings in
process memory, behind the same interface the Prisma store will implement.

## 33. Join the matchmaking queue

Goal: a player can enter the queue for a subject.

Description: `POST /arena/queue` registers the player, rejecting a second entry
while one is active.

## 34. Leave the matchmaking queue

Goal: a player can cancel waiting.

Description: `DELETE /arena/queue` removes the entry and is safe to call twice.

## 35. Pair two waiting players

Goal: two players in the same subject queue become a match.

Description: Pairing picks the two longest-waiting players for a subject,
creates the match, draws its ten questions and removes both queue entries.

## 36. Create a private match

Goal: a player can open a match others can join by code.

Description: Generates a short unambiguous code, stores the match as waiting and
returns the code.

## 37. Join a private match by code

Goal: the second player enters and the match starts.

Description: Validates the code, rejects full, finished or unknown matches, then
starts the match.

## 38. Fetch match state

Goal: a client can render the match from a single call.

Description: Returns status, current question index, both scores and the current
question without its answer.

## 39. Match event stream

Goal: both clients stay in sync without polling hard.

Description: An SSE endpoint per match that replays the current state on connect
and then pushes events as they happen.

## 40. Submit an answer

Goal: an answer is recorded and scored.

Description: `POST /arena/matches/{id}/answer` accepts a choice for the current
question, rejects duplicates and answers for a closed question.

## 41. Server-side clock and timeouts

Goal: timing cannot be manipulated by the client.

Description: The server stamps arrival, closes a question after 15 seconds and
records a timeout as a zero-point answer.

## 42. Advance through the questions

Goal: a match moves forward predictably.

Description: A question closes when both players have answered or the time
expires; the next opens after a short reveal pause.

## 43. Detect abandonment

Goal: a player left alone is not stuck.

Description: Two consecutive non-answers forfeit the match; the remaining player
wins and the rating is applied.

## 44. Scoring module

Goal: scoring is pure, testable and identical on both sides.

Description: `lib/arena/scoring.ts` — 100 points for correct plus a linear speed
bonus up to 50, no points otherwise.

## 45. Elo rating module

Goal: rating changes are correct and per subject.

Description: `lib/arena/rating.ts` — Elo with K = 32, start 1000, draws at 0.5.

---

## Iteration 4 — SQLite persistence

## 46. Prisma store implementing the store interface

Goal: the same backend works against SQLite.

Description: A second implementation of the store interface using the Arena
Prisma client, selected by configuration.

## 47. Persist matches and their questions

Goal: a match survives a restart.

Description: Match rows and their ten question rows are written at creation.

## 48. Persist answers

Goal: every answer is stored with its timing and points.

Description: Answers are written as they arrive, including timeouts.

## 49. Persist ratings

Goal: rating is durable and per subject.

Description: `ArenaRating` is created on first play and updated after each
finished match, inside one transaction with the match result.

## 50. Persist the queue

Goal: the queue is not lost on restart.

Description: Queue entries are stored and stale entries are cleaned on startup.

## 51. Match history query

Goal: history is served from the database.

Description: Finished matches for a player, filtered by subject, newest first,
paged.

## 52. Leaderboard query

Goal: the ladder is served from the database.

Description: Top ratings per subject with the requesting player's own position.

## 53. Restart persistence check

Goal: persistence is proven, not assumed.

Description: Play a match, restart the server, confirm the result, ratings and
history are intact.

## 54. Database setup commands and documentation

Goal: a new machine can run Arena.

Description: `npm run arena:push`, `arena:generate` and `arena:seed`, documented
in `AGENTS.md`.

## 55. Switch the backend to the Prisma store

Goal: SQLite is the real storage.

Description: Configuration selects the Prisma store; the in-memory store remains
for tests.

---

## Iteration 5 — connect and harden

## 56. HTTP implementation of the service

Goal: the frontend can talk to the real backend.

Description: `lib/arena/service.http.ts` implements the interface against the
contract, including the SSE subscription.

## 57. Switch the frontend off the mock

Goal: the app plays against the real backend.

Description: Configuration selects the implementation; the mock stays for tests
and local UI work.

## 58. Reconnect and resume

Goal: a dropped connection does not lose the match.

Description: On reconnect the client fetches state, resubscribes and continues
from the current question.

## 59. Error states

Goal: failures are explained in Kazakh, not swallowed.

Description: Network loss, match not found, match finished, already queued — each
with a clear message and a way forward.

## 60. Loading and empty states

Goal: no blank screens.

Description: Skeletons while loading; empty states for no history, an empty
ladder and no available subjects.

## 61. Rate limit the answer endpoint

Goal: the match API cannot be hammered.

Description: Apply the project's existing rate limiter to answer submission and
queue joining.

## 62. Require authentication for Arena

Goal: only signed-in students can play.

Description: Arena pages and API routes sit behind the existing session check;
the middleware matcher is extended.

## 63. Validate every Arena input with Zod

Goal: malformed requests are rejected at the boundary.

Description: Schemas for every request body and path parameter, mirroring
`openapi.yaml`.

## 64. Log the match lifecycle

Goal: a failed match can be diagnosed.

Description: Structured logs for create, pair, start, each question close,
finish and abandon.

## 65. Two-window manual play test

Goal: the headline scenario is proven.

Description: Two browser windows, two accounts, one private match played to the
end; questions, order and scores agree on both sides.

## 66. Accessibility pass

Goal: Arena is usable without a mouse and readable for everyone.

Description: Keyboard play, focus order, contrast, and remaining time announced
as text rather than colour alone.

## 67. Arena section in AGENTS.md

Goal: an agent picking up Arena knows its rules.

Description: Commands, the SQLite constraint, the no-scalar-lists rule, and
where the contract lives.

---

## Tests

## 68. Scoring unit tests

Goal: scoring is proven at the boundaries.

Description: Correct and wrong answers, instant and last-millisecond answers,
timeouts.

## 69. Rating unit tests

Goal: Elo is proven.

Description: Equal ratings, large gaps, draws, and that the rating of one
subject never affects another.

## 70. Match engine unit tests

Goal: the state machine cannot get stuck.

Description: Both answer, one answers, neither answers, answering twice,
answering a closed question.

## 71. Mock service tests

Goal: the mock behaves like the contract.

Description: The mock satisfies the same interface assertions as the HTTP
implementation.

## 72. Queue pairing tests

Goal: pairing is fair and cannot double-book a player.

Description: Longest-waiting pair wins; a player cannot be paired into two
matches.

## 73. Timeout tests

Goal: timing rules hold under the server clock.

Description: An answer at 14.9 s counts; at 15.1 s it does not.

## 74. Abandonment tests

Goal: an abandoned match resolves.

Description: Two consecutive silences forfeit; the opponent's rating is applied.

## 75. API contract tests

Goal: the implementation matches `openapi.yaml`.

Description: Each endpoint's status codes and response shapes are asserted
against the contract.

## 76. Persistence tests

Goal: the Prisma store behaves like the in-memory store.

Description: The same store test suite runs against both implementations.

## 77. End-to-end two-player test

Goal: a full match is tested automatically.

Description: Drive two sessions through a complete private match and assert the
final scores and ratings on both sides.
