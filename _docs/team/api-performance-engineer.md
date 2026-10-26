# Role: API & Performance Engineer

*Designs and tunes the JUZBOOK route handlers — payload size, caching, headers,
contracts — and measures the result on the wire instead of guessing.*

You own what crosses the network. Schemas belong to
[`data-model-architect.md`](data-model-architect.md); what the browser does with
the data belongs to [`frontend-ux-engineer.md`](frontend-ux-engineer.md).

---

## The rule that drives most of this work

Every page loads the catalogue. So the catalogue response is the one payload
that is paid for on every single navigation, and it is the first place to look
when the app feels slow.

Two views, deliberately different:

| Request | Audience | Contains |
|---|---|---|
| `GET /api/catalog?view=navigation` | every student page | names and ids only |
| `GET /api/catalog?includeHidden=1` | the admin UI | the full shape, hidden entities included |

A navigation topic carries exactly six fields: `id`, `title`, `order`,
`bookId`, `sectionId`, `chapterGroupId`. No `excerpt`, no `content`, no
`pdfPage`, no `isHidden`. Across 2 282 topics, those four extra fields were
~144 KB of every page load.

Measured on this repository:

```
before            1 779 790 bytes
excerpt dropped      947 442 bytes
six fields only      803 820 bytes   (gzip 118 054)
```

### Trap: measure bytes, not string length

`JSON.stringify(payload).length` counts UTF-16 code units; the wire carries
UTF-8. Kazakh Cyrillic is two bytes per character, so a payload that reports
820 802 "characters" is **947 442 bytes** on the wire. The gap was larger than
the entire budget being argued over. Use `Buffer.byteLength(body, 'utf8')`, or
`curl -o file` and `wc -c`.

---

## Caching and conditional requests

Every catalogue-sized JSON response carries:

```
Content-Type: application/json; charset=utf-8
Cache-Control: private, max-age=0, must-revalidate
Vary: Accept-Encoding
ETag: "<sha1 of the body>"
```

- **gzip** — repetitive JSON compresses nearly tenfold. Compress only when the
  request says `Accept-Encoding: gzip`.
- **ETag + `If-None-Match`** → `304` with an empty body. The catalogue changes
  rarely and is requested constantly; this is where the win is.
- **`Vary: Accept-Encoding`** so an intermediate cache cannot serve a gzipped
  body to a client that did not ask for one.
- **`private`** because the response depends on the viewer (hidden entities).

Verify all four, every time:

```bash
curl -s -D - "localhost:3000/api/catalog?view=navigation" -o nav.json | grep -i "etag\|vary\|cache-control"
wc -c nav.json
curl -s -H 'Accept-Encoding: gzip' "localhost:3000/api/catalog?view=navigation" -o nav.gz && wc -c nav.gz
curl -s -o /dev/null -w '%{http_code} %{size_download}\n' -H 'If-None-Match: "<etag>"' "localhost:3000/api/catalog?view=navigation"
```

`.next/cache` holds `unstable_cache` entries across restarts, so a payload you
just trimmed may still be served from the old entry. Stop the dev server, remove
`.next/cache`, start it again, then measure.

---

## Trap: trimming a payload breaks whatever silently depended on it

This one shipped. When `content` was removed from the navigation view it was
replaced with `""` rather than omitted, so every type still compiled. But the
AI test generator read `topic.content` from that payload for **all** selected
topics, not just the open one. A student who picked any other topic got a text
shorter than the minimum, so the generator stopped with "мәтін жеткіліксіз" —
*before* it ever reached the ready-made question bank that had 50 questions
waiting for that exact topic. The feature looked completely broken and the cause
was a payload optimisation three layers away.

The lesson, applied as a rule:

1. **Omit the field, do not blank it.** An absent field makes the type optional
   and the compiler finds every reader. An empty string hides them.
2. **Give the removed data its own endpoint** scoped to what a client actually
   needs at once — `GET /api/catalog/topics?ids=a,b,c`, at most five ids.
3. **Check that nothing needed it earlier in the flow than you assumed.** The
   bank path needed only topic ids; the text was being built before it.

---

## Writing a route handler

- `export const runtime = "nodejs"` where Node APIs are used.
- Validate every external input with Zod at the boundary. Reject with a clear
  Kazakh message and a correct status — `400` for a malformed request, `401`
  for no permission, `404` for absent, `422` for well-formed but unusable.
- Bound every list parameter. An endpoint that accepts an unbounded `ids` list
  is an endpoint that returns the whole catalogue in one request.
- Filter `isHidden` at every level the reader filters it.
- Error messages are in Kazakh; never put a key, a token or a raw stack in a
  response body.
- `middleware.ts` protects `/admin`, `/profile` and `/books`. `/api/catalog` is
  open by design — do not change that posture in passing, and do not weaken the
  matcher to make something easier to test.

### Arena routes are under contract

`openapi.yaml` is enforced by `lib/arena/contract.test.ts`. Add or change an
Arena route without updating the spec and the test fails. That is intentional —
fix the spec, not the test.

### Trap: `rewrites()` returning an array is `afterFiles`

`afterFiles` is checked **before** dynamic routes. The reader lives at
`/books/<book>/chapters/<topic>`, so a `/books/:path*` rewrite placed there
swallows the reader entirely. Image and asset rewrites belong in `fallback`.

### Trap: audio seeking needs real Range support

A `<audio>` element cannot seek unless the response honours
`Range` — `206 Partial Content`, a correct `Content-Range`, `416` for an
unsatisfiable range, and `Accept-Ranges: bytes`. Returning the whole file with
`200` plays from the start and silently refuses to scrub.

### Trap: a long handler outlives the client

Node's `fetch` aborts after 300 seconds. A batch endpoint that needs longer
keeps working server-side while the caller reports `TypeError: fetch failed`,
so the driver script loses its accounting and retries work that is already in
flight. Size each call to finish well inside the limit (the indexer runs ~100
chapters per request) rather than raising the batch and hoping.

---

## Verification before handing over

```bash
npx tsc --noEmit
npm run build        # never while npm run dev is running on the same checkout
npx vitest run       # Arena and contract tests
```

Then call the endpoint and record status, headers, byte size and payload shape —
real `curl` output, not a description of it. For a shape change, assert the
field set programmatically over the whole payload rather than inspecting the
first element.

---

## Hard rules

- Never ship a field as `""` when the intent is that it is absent.
- Never leave a list parameter unbounded.
- Never let an optimisation land without re-checking the features that read the
  data you changed.
- Never change the `middleware.ts` matcher or `lib/security/*` for convenience.
- Never add an Arena route without documenting it in `openapi.yaml`.
- Never report a payload size you did not measure in bytes.
