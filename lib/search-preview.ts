function decodeEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

export function stripSearchHtml(value: string) {
  return decodeEntities(value)
    .replace(/<[^>]+>/g, " ")
    .replace(/\[[^\]]+\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Іздеу сөзінің мәтінде неше рет кездесетінін санаудың шегі */
const MAX_TRACKED_MATCHES = 200;
/** Алдын ала көрсетілетін үзінділер саны */
const MAX_WINDOWS = 4;
const MARK_CLASS = "rounded bg-amber-200 px-1 font-semibold text-slate-950";

/** Мәтіндегі барлық кездесудің орнын табады (қабаттаспайтын) */
export function findMatchOffsets(text: string, term: string) {
  const lowerText = text.toLowerCase();
  const lowerTerm = term.toLowerCase();
  const offsets: number[] = [];

  if (!lowerTerm) {
    return offsets;
  }

  let cursor = 0;
  while (offsets.length < MAX_TRACKED_MATCHES) {
    const found = lowerText.indexOf(lowerTerm, cursor);
    if (found === -1) {
      break;
    }
    offsets.push(found);
    cursor = found + lowerTerm.length;
  }

  return offsets;
}

/**
 * Іздеу нәтижесінің үзіндісін жасайды.
 * Әр табылған сөз `<mark data-hit="N">` болып белгіленеді — N сол сөздің
 * тақырып мәтініндегі реттік нөмірі. Оқу беті сол нөмір арқылы дәл сол
 * сөзге апарады, сондықтан үзіндідегі әр сөз өз сілтемесі іспетті.
 */
export function buildHighlightedSearchSnippet(value: string, term: string) {
  const clean = stripSearchHtml(value);
  const normalizedTerm = term.trim();

  if (!clean) {
    return "";
  }

  if (!normalizedTerm) {
    return escapeHtml(clean.slice(0, 260));
  }

  const matches = findMatchOffsets(clean, normalizedTerm);
  if (!matches.length) {
    return escapeHtml(clean.slice(0, 260));
  }

  const termLength = normalizedTerm.length;

  // Әр табылған сөздің айналасынан үзінді аламыз; қабысатын үзінділер бірігеді
  const windows: { start: number; end: number }[] = [];
  for (const index of matches.slice(0, MAX_WINDOWS)) {
    const start = Math.max(0, index - 70);
    const end = Math.min(clean.length, index + termLength + 120);
    const last = windows[windows.length - 1];

    if (last && start <= last.end) {
      last.end = Math.max(last.end, end);
      continue;
    }

    windows.push({ start, end });
  }

  const pieces = windows.map(({ start, end }) => {
    let html = start > 0 ? "... " : "";
    let position = start;

    for (let rank = 0; rank < matches.length; rank += 1) {
      const at = matches[rank];
      if (at < start || at + termLength > end) {
        continue;
      }

      html += escapeHtml(clean.slice(position, at));
      html += `<mark data-hit="${rank}" class="${MARK_CLASS}">${escapeHtml(clean.slice(at, at + termLength))}</mark>`;
      position = at + termLength;
    }

    html += escapeHtml(clean.slice(position, end));
    if (end < clean.length) {
      html += " ...";
    }

    return html;
  });

  return pieces.join(" ");
}
