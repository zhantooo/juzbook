# JUZBOOK Arena — Specification

Saved from the brainstorming session in
[`chat-brainstorm.md`](chat-brainstorm.md). This is the document the backlog is
derived from.

---

## 1. Problem

JUZBOOK is a solitary product. A student reads, highlights and tests alone, and
nothing brings them back tomorrow. Preparation for the ҰБТ is competitive by
nature — students already compare scores in group chats — but the platform gives
them no way to compete.

## 2. Product

**Arena** is a live 1v1 quiz duel played inside JUZBOOK. Two students answer the
same ten questions from one subject; the faster correct answer scores more. Each
subject has its own rating and its own ladder.

It is a separate product from the reader: no reading, no notes, no highlights —
a short, repeatable match.

### Primary user

A student preparing for the ҰБТ who already uses JUZBOOK and wants to measure
themselves against someone else.

---

## 3. Match rules

| Rule | Value |
|---|---|
| Players | 2 |
| Questions | 10, identical for both players |
| Source | the existing `TopicQuestion` bank for the chosen subject |
| Difficulty mix | 6 medium, 2 easy, 2 hard — the bank's own proportion |
| Time per question | 15 seconds, measured by the server |
| Correct answer | 100 points |
| Speed bonus | up to 50 points, decreasing linearly with the time taken |
| Wrong answer / timeout | 0 points |
| Winner | the higher total; equal totals are a draw |
| Abandoned match | a player who sends nothing for two consecutive questions forfeits |

### Fairness rules

- **The server owns the clock.** The client sends an answer; the server stamps
  the arrival time and decides whether it was in time. A client-side timer is
  display only.
- **The correct answer is never sent before a question closes.** The question
  payload carries the prompt and the four options; the correct index and the
  explanation arrive with the question's result.
- **The question set is fixed at match creation** and stored with the match, so
  a reconnecting player sees the same ten and the result stays auditable.

---

## 4. Scope

### In scope (MVP)

| # | Capability |
|---|---|
| 1 | Subject selection — only subjects with enough questions are offered |
| 2 | Matchmaking queue, scoped to one subject |
| 3 | Private match by code, for challenging a specific person |
| 4 | Live match: synchronised questions, per-question results, running score |
| 5 | Result screen doubling as a review: both answers, the correct one, the explanation |
| 6 | Rating per `(player, subject)`, updated after each match |
| 7 | Leaderboard per subject |
| 8 | Match history with a replayable result screen |
| 9 | Reconnect — rejoining a match in progress restores the current state |
| 10 | Abandonment handling — the remaining player wins |

### Out of scope (post-MVP)

- Matches with more than two players; tournaments.
- Cross-subject or "all subjects" matches.
- Chat, emotes or any direct messaging between players.
- Rewards, coins, cosmetics.
- Generating new questions during a match.
- Mobile app; the web app is responsive and that is enough.

---

## 5. Architecture

Arena lives inside the JUZBOOK repository but is self-contained: its own routes,
its own components, its own database.

```
app/arena/                     pages: subject picker, queue, match, result, ladder
app/api/arena/                 route handlers implementing openapi.yaml
components/arena/              UI
lib/arena/
  service.ts                   the single client-side API layer (interface)
  service.mock.ts              in-memory implementation used by the frontend first
  service.http.ts              the real implementation, generated against the contract
  scoring.ts                   pure scoring and rating functions
  match-engine.ts              match state machine, no I/O
prisma/arena.prisma            Arena's own schema → SQLite
openapi.yaml                   the API contract, at the repository root
```

### Storage — SQLite

Arena uses **SQLite through Prisma**, in a second schema with its own generated
client, separate from JUZBOOK's PostgreSQL. Reasons:

- the assignment requires SQLite with a DBMS-agnostic ORM;
- Arena's data is small, hot and self-contained — a file database is a good fit;
- keeping it apart means Arena cannot break the reader.

**Portability rules.** No Postgres-only types. In particular no scalar list
columns (`String[]`), which Prisma does not support on SQLite — answer options
are stored as a JSON string column and parsed at the boundary. The database URL
comes from `ARENA_DATABASE_URL` so the engine can be swapped later.

Questions are **copied** into Arena's database by a seed script that reads the
JUZBOOK bank. Arena never queries PostgreSQL at match time.

### Realtime — Server-Sent Events

The match stream is an SSE endpoint. Each client subscribes and receives
`question`, `answer-result`, `score` and `match-end` events. A light poll is the
fallback when the stream drops. No WebSocket dependency, no second server
process.

---

## 6. Data model (Arena, SQLite)

```
ArenaPlayer      id, userId, displayName, createdAt
ArenaRating      id, playerId, subjectId, rating, played, won, lost, drawn
                 @@unique([playerId, subjectId])
ArenaMatch       id, subjectId, status (waiting|active|finished|abandoned),
                 code (nullable, for private matches), startedAt, finishedAt,
                 currentIndex, winnerId (nullable)
ArenaMatchPlayer id, matchId, playerId, score, ratingBefore, ratingAfter
ArenaQuestion    id, matchId, position, prompt, optionsJson, answerIndex,
                 explanation, difficulty
ArenaAnswer      id, matchId, playerId, position, chosenIndex (nullable for a
                 timeout), isCorrect, elapsedMs, points, answeredAt
ArenaQueueEntry  id, playerId, subjectId, joinedAt
```

`ArenaRating` is keyed by player **and** subject — there is no global rating.

### Rating

Elo, K = 32, starting rating 1000, computed per subject. A draw scores 0.5. The
rating change is shown on the result screen.

---

## 7. Iteration plan

The build follows the order the assignment prescribes:

1. **Frontend against a mock.** Every backend call goes through
   `lib/arena/service.ts`; `service.mock.ts` implements it in memory with seeded
   fixtures. The full flow is playable with no backend.
2. **Contract.** `openapi.yaml` written from that service interface: endpoints,
   request and response bodies, auth, the SSE stream.
3. **Backend, in-memory.** Route handlers implement the contract against an
   in-memory store — no database yet.
4. **Backend, SQLite.** The store is replaced by Prisma against
   `prisma/arena.prisma`. Restarting the server must not lose a finished match.
5. **Connect.** The frontend switches from `service.mock.ts` to
   `service.http.ts`. Verified by playing a real match in two browser windows.

Each step is a group of GitHub issues tagged `mvp`.

---

## 8. Non-functional requirements

- **Kazakh first.** All interface text in Kazakh; code comments in Kazakh.
- **Mobile first.** Playable at 375 px with no horizontal scroll; the answer
  buttons are reachable with one thumb.
- **Latency.** A question must appear within 500 ms of the previous one closing.
- **Accessibility.** Keyboard-playable (1–4 select an option, Enter confirms);
  WCAG AA contrast; the timer is not the only signal — remaining time is also
  announced as text.
- **No new runtime dependency** beyond what the project already has.

---

## 9. Success criteria

- Two students in two browser windows can complete a full match, see the same
  questions in the same order, and get consistent scores.
- A finished match survives a server restart.
- Ratings and the ladder are per subject and update after every match.
- A disconnected player can rejoin a match in progress.
- The result screen explains every question that was answered wrongly.
