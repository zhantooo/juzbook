/**
 * Рим цифрларын қазақша сөзге айналдыру.
 *
 * Оқулық мәтінінде рим цифрлары жиі кездеседі: «XVIII ғасыр», «II Николай»,
 * «III тарау». Дыбыс қызметі оларды сан деп танымай, әріптеп оқиды —
 * «икс вэ и и и» болып шығады. Сондықтан мәтінді дыбысқа беретін сәтте
 * оларды сөзбен жазып береміз.
 *
 * Бір тұзақ бар: оқулықтарда рим цифрлары жиі **кирилл** әріптерімен
 * теріледі — `ХVIII` дегендегі Х — кириллицалық Ха (U+0425), латын X емес.
 * Көзге бірдей, бірақ кодта бөлек таңба. Сондықтан алдымен ұқсастарын
 * латынға келтіреміз.
 *
 * Модуль таза: мәтін кіреді, мәтін шығады.
 */

/** Кирилл ұқсастары → латын */
const LOOKALIKE: Record<string, string> = {
  "Х": "X", // Х
  "І": "I", // І
  "С": "C", // С
  "М": "M", // М
  "В": "V", // В — сирек, бірақ кездеседі
  "А": "A"
};

const ROMAN_VALUES: Array<[string, number]> = [
  ["M", 1000],
  ["CM", 900],
  ["D", 500],
  ["CD", 400],
  ["C", 100],
  ["XC", 90],
  ["L", 50],
  ["XL", 40],
  ["X", 10],
  ["IX", 9],
  ["V", 5],
  ["IV", 4],
  ["I", 1]
];

const CARDINAL_ONES = ["", "бір", "екі", "үш", "төрт", "бес", "алты", "жеті", "сегіз", "тоғыз"];
const CARDINAL_TENS = [
  "",
  "он",
  "жиырма",
  "отыз",
  "қырық",
  "елу",
  "алпыс",
  "жетпіс",
  "сексен",
  "тоқсан"
];

const ORDINAL_ONES = [
  "",
  "бірінші",
  "екінші",
  "үшінші",
  "төртінші",
  "бесінші",
  "алтыншы",
  "жетінші",
  "сегізінші",
  "тоғызыншы"
];
const ORDINAL_TENS = [
  "",
  "оныншы",
  "жиырмасыншы",
  "отызыншы",
  "қырқыншы",
  "елуінші",
  "алпысыншы",
  "жетпісінші",
  "сексенінші",
  "тоқсаныншы"
];

/** Рим жазуы дұрыс па (қатаң түрі: IIII емес, IV) */
const STRICT_ROMAN = /^M{0,3}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/;

/** Латынға келтірілген рим жазуын санға айналдырады. Жарамсыз болса — null. */
export function romanToNumber(raw: string): number | null {
  const text = normalizeRomanLetters(raw).toUpperCase();
  if (!text || !STRICT_ROMAN.test(text)) {
    return null;
  }

  let index = 0;
  let total = 0;

  while (index < text.length) {
    const two = text.slice(index, index + 2);
    const pairMatch = ROMAN_VALUES.find(([symbol]) => symbol.length === 2 && symbol === two);
    if (pairMatch) {
      total += pairMatch[1];
      index += 2;
      continue;
    }

    const one = text[index];
    const singleMatch = ROMAN_VALUES.find(([symbol]) => symbol.length === 1 && symbol === one);
    if (!singleMatch) {
      return null;
    }
    total += singleMatch[1];
    index += 1;
  }

  return total > 0 ? total : null;
}

/** Кирилл ұқсастарын латынға ауыстырады */
export function normalizeRomanLetters(text: string): string {
  return text.replace(/[ХІСМВА]/g, (char) => LOOKALIKE[char] ?? char);
}

/** Санның қазақша атауы: 18 → «он сегіз» */
export function kazakhCardinal(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return String(value);
  }

  const parts: string[] = [];
  let rest = Math.trunc(value);

  const thousands = Math.floor(rest / 1000);
  if (thousands > 0) {
    parts.push(thousands === 1 ? "мың" : `${kazakhCardinal(thousands)} мың`);
    rest %= 1000;
  }

  const hundreds = Math.floor(rest / 100);
  if (hundreds > 0) {
    parts.push(hundreds === 1 ? "жүз" : `${CARDINAL_ONES[hundreds]} жүз`);
    rest %= 100;
  }

  const tens = Math.floor(rest / 10);
  if (tens > 0) {
    parts.push(CARDINAL_TENS[tens]);
    rest %= 10;
  }

  if (rest > 0) {
    parts.push(CARDINAL_ONES[rest]);
  }

  return parts.join(" ");
}

/**
 * Реттік сан: 18 → «он сегізінші».
 * Қазақшада жұрнақ тек соңғы сөзге жалғанады.
 */
export function kazakhOrdinal(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return String(value);
  }

  const number = Math.trunc(value);
  const ones = number % 10;
  const tens = Math.floor((number % 100) / 10);
  const hundreds = Math.floor((number % 1000) / 100);
  const thousands = Math.floor(number / 1000);

  const head: string[] = [];

  if (thousands > 0) {
    if (number % 1000 === 0) {
      return thousands === 1 ? "мыңыншы" : `${kazakhCardinal(thousands)} мыңыншы`;
    }
    head.push(thousands === 1 ? "мың" : `${kazakhCardinal(thousands)} мың`);
  }

  if (hundreds > 0) {
    if (number % 100 === 0) {
      head.push(hundreds === 1 ? "жүзінші" : `${CARDINAL_ONES[hundreds]} жүзінші`);
      return head.join(" ");
    }
    head.push(hundreds === 1 ? "жүз" : `${CARDINAL_ONES[hundreds]} жүз`);
  }

  if (tens > 0) {
    if (ones === 0) {
      head.push(ORDINAL_TENS[tens]);
      return head.join(" ");
    }
    head.push(CARDINAL_TENS[tens]);
  }

  head.push(ORDINAL_ONES[ones]);
  return head.join(" ");
}

/**
 * Рим цифрынан кейін келгенде оны реттік сан деп оқу керек сөздер.
 * «XVIII ғасыр» — он сегізінші ғасыр, «III тарау» — үшінші тарау.
 */
const ORDINAL_CONTEXT =
  /^\s*(?:–|—|-|,)?\s*(?:ғасыр|ғасырда|ғасырдың|ғасырлар|ғасырларда|ғасырлардың|мыңжылдық|тарау|тарауда|бөлім|бөлімде|сынып|сыныпта|кезең|кезеңде|съезд|съезі|том|томда)/i;

/**
 * Мәтіндегі рим цифрларын қазақша сөзбен ауыстырады.
 *
 * Жалған дабылдан сақтану үшін төрт шектеу бар:
 * - сөздің ішінде тұрған әріптер тиілмейді (шекара тексеріледі);
 * - жарамсыз жазу (мысалы «IIII») сол күйінде қалады;
 * - жеке тұрған бір таңба (I, V, X) оқылмайды — ол әріп болуы әбден мүмкін;
 * - артынан «ғасыр», «тарау» сияқты сөз келмесе, тек кіші сан қабылданады.
 *   Себебі: «MIX» де, «CD» де жарамды рим саны (1009 және 400), ал мәтінде
 *   олар әдетте сан емес, қысқарған сөз. Ғасыр, тарау, сынып, патша нөмірі —
 *   бәрі отыздан аспайды, сондықтан шек сол жерде.
 */
/**
 * Контекссіз (ғасыр, тарау, …) оқылатын ең үлкен сан.
 * Ғасыр да, тарау да, патша нөмірі де бұдан аспайды.
 */
const MAX_WITHOUT_CONTEXT = 30;

export function expandRomanNumerals(text: string): string {
  if (!text) {
    return text;
  }

  // Латын да, кирилл ұқсастары да кіреді
  const token = /[IVXLCDMХІСМВ]{1,8}/g;

  return text.replace(token, (match, offset: number, whole: string) => {
    const before = whole[offset - 1] ?? "";
    const after = whole[offset + match.length] ?? "";

    // Сөздің ішінде тұрса — тиіспейміз
    if (/[\p{L}\p{N}]/u.test(before) || /[\p{L}\p{N}]/u.test(after)) {
      return match;
    }

    const value = romanToNumber(match);
    if (value === null || value > 3000) {
      return match;
    }

    const tail = whole.slice(offset + match.length);
    const hasOrdinalContext = ORDINAL_CONTEXT.test(tail);

    if (!hasOrdinalContext && (match.length === 1 || value > MAX_WITHOUT_CONTEXT)) {
      return match;
    }

    return kazakhOrdinal(value);
  });
}
