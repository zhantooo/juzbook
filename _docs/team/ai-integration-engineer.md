# Role: AI Integration Engineer

*Owns every call JUZBOOK makes to a model — test generation, explanations,
embeddings, speech — including the quotas, the retries and the proof that the
output is actually good.*

You work on `lib/gemini-keys.ts`, `lib/search/*`, the generation routes and the
batch scripts under `scripts/`. Schema questions go to
[`data-model-architect.md`](data-model-architect.md); endpoint shape goes to
[`api-performance-engineer.md`](api-performance-engineer.md).

---

## Access and quotas

**Every Gemini call goes through `lib/gemini-keys.ts`.** It holds a pool of keys
with per-minute and per-day cooldowns, and it is the only place that knows which
key is usable right now. A direct `new GoogleGenAI(...)` in a route bypasses the
cooldowns and burns the pool for everyone.

- The model id comes from `QUESTION_MODEL`, never a literal. Models are
  withdrawn without notice — `gemini-2.5-flash` stopped being available on this
  account mid-project. The variable holds a comma-separated fallback chain.
- A lighter model was measured ~10× faster for question generation at acceptable
  quality. Pick the smallest model that passes the audit, not the largest one
  available.
- Production and local are not the same pool. A feature that worked locally and
  returned `503` in production turned out to have one key deployed against eight
  locally — check the deployed environment, not just `.env`.
- **Never print a full API key**, not in a log line, not in an error message,
  not in a report.

### Budget is a design constraint, not an afterthought

Search embeddings and student test generation compete for the same quota.
Semantic indexing was moved to Cloudflare Workers AI (`@cf/baai/bge-m3`)
specifically so that re-indexing the catalogue could not starve the feature a
student is waiting on. When you add a model call, say which budget it spends.

---

## Generation: grounding and shape

- **Strict JSON.** Request a response schema and parse it; never regex a model's
  prose.
- **Grounded only in the provided text.** The system prompt forbids outside
  knowledge and other topics. A question a student cannot answer from the
  chapter in front of them is a defect.
- **The explanation quotes the source.** That is what makes a wrong answer
  teachable.
- **Pre-generate, then fall back.** A student's test is served from
  `TopicQuestion` first; the model is called only when the bank cannot cover the
  request. The bank path needs nothing but topic ids — do not make it depend on
  chapter text being present (that exact coupling broke test generation once;
  see the API role doc).

### The question bank specification

50 questions per topic: **30 medium, 10 easy, 10 hard**. Four distinct options,
a non-empty explanation, no duplicates within a topic.

- **Place the correct answer deliberately.** Left alone, the model puts it first
  far too often. Shuffle and balance so each position A–D holds 20–30 % of
  correct answers across the bank. Current measured distribution:
  A 26.0 %, B 25.6 %, C 24.2 %, D 24.1 % over 108 593 questions.
- **Duplicate rule.** Two prompts collide if their normalised text matches, or
  if their long words (> 3 characters) overlap by ≥ 0.8 of the smaller set.
  The generator and the audit must use the **same** rule — if they drift, the
  audit cannot catch what the generator lets through.
- **Short topics produce nothing.** Below the minimum text length (400
  characters) there is no basis for 50 grounded questions. Section summaries
  fall here. Report them as out of reach instead of letting the job look
  incomplete.

---

## Batch jobs

Generation and indexing are long jobs, so they obey the project's batch rules:
resumable, idempotent, non-destructive, self-verifying.

- **Resume by state, not by position.** The question bank reprocesses only
  topics holding fewer than 50 rows; the indexer re-embeds only chapters whose
  stored content hash changed. Neither needs to remember where it stopped.
- **A daily quota running out is a normal ending.** Stop cleanly, leave the work
  marked as pending, continue on the next run. Never skip a topic to keep going.
- **Audit independently.** `scripts/audit_question_bank.mjs` re-checks counts,
  level split, option validity, answer positions and duplicates from the
  database. A generator cannot vouch for itself.
- **Concurrency is bounded by the provider, not by your patience.** Measured
  against Workers AI: one text 632 ms, six texts 444 ms, 25 texts 848 ms, and
  four requests in parallel 1 905 ms in total — parallelism bought roughly 2×,
  not 4×. Four in flight is the useful ceiling here; more earns `429`s and the
  retry backoff eats the gain.
- Write progress with `appendFileSync` to a file. Redirected `stdout` sits in a
  buffer and a long job looks dead from the outside.

---

## Embeddings and semantic search

Keyword search and semantic search answer the same query and the results are
merged. Neither replaces the other: on 85 questions from the bank, keyword got
55 % of the hard cases and embeddings 95 %.

- **Document and query embeddings are different.** `RETRIEVAL_DOCUMENT` and
  `RETRIEVAL_QUERY` produce different vectors for the same text. Mixing them
  costs accuracy and raises no error at all.
- **Never mix vector spaces.** Each provider has its own dimensions — BGE-M3 is
  1024, `gemini-embedding-001` here is 768 — and distances between spaces are
  meaningless. The provider and dimension in use are stored in `SearchMeta`,
  **and** read back from the table's own DDL (`F32_BLOB(n)`), because the meta
  row can be missing on a table that was created before it existed. On a
  mismatch the index is dropped and rebuilt rather than silently poisoned.
- **Semantic search must never break the page.** If Turso or the provider is
  unavailable, `semanticSearch` returns an empty list and keyword results stand
  alone.
- **The index keeps itself current.** A chapter is re-embedded only when its
  content hash changes; a new book is picked up by the nightly cron
  (`/api/cron/search-index`), and an admin edit re-indexes that one chapter at
  once. Nobody runs anything by hand.

### Measure retrieval, don't admire it

The question bank is the ground truth: a question's text should retrieve its own
topic. Report Recall@1 and Recall@5 over a fixed sample, through the **real**
endpoint, so folding, merging and ranking are all included. Measured Recall@1:
`gemini-embedding-001` 87.1 %, BGE-M3 85.9 %. Quote the number or do not claim
an improvement.

---

## Other generated media

Text-to-speech runs through `edge-tts`. It returned `403` for every request once
and the cause was the pinned version, not the text or the network — upgrading
fixed it. When an external service starts refusing everything, check the client
version before rewriting the call.

---

## Verification before handing over

```bash
npx tsc --noEmit
npx vitest run
node --env-file=.env scripts/audit_question_bank.mjs      # after any generation change
```

For a retrieval change, run the measurement script against the live endpoint and
paste the real numbers. For a generation change, paste the audit output. A claim
about model quality without a measurement is not a result.

---

## Hard rules

- Never call Gemini outside `lib/gemini-keys.ts`.
- Never hard-code a model id.
- Never print or commit a key; `.env.example` holds placeholders only.
- Never mix embedding providers or task types in one index.
- Never let indexing consume the quota a student's test depends on.
- Never ship a generator without an independent audit.
- Never describe generated content as verified without the audit output.
