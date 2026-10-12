# -*- coding: utf-8 -*-
"""Gemini тануынан қалған бөтен жазу таңбаларын түзетеді.

Модель кейде қазақ сөзінің ортасына латын не грек әрпін қосып жібереді
(«жалғастыrdы», «Εліміздің», «ἀжал»), екпін белгісін қояды («қалы́птасуы»),
өлең жолдарын «\\n» деп жазады. Бұл — кітаптағы мәтін емес, тану қатесі.

Тек бір сөздің ішінде кирилл мен бөтен әріп араласқанда ғана түзетіледі:
таза латын сөздер («Polyethnic society», «GROW») өзгермейді. HTML тегтері мен
атрибуттары (сурет сілтемесі, т.б.) қозғалмайды.

Қолдану: python scripts/text_fixes.py <payload.json> [--dry-run]
"""

import io
import json
import re
import sys

CYRILLIC = "а-яА-ЯёЁәғқңөұүһіӘҒҚҢӨҰҮҺІ"
LOWERCASE = "а-яёәғқңөұүһі"

# Грек әріптері — кирилдегі сыңарына
GREEK = {
    "Α": "А", "Β": "В", "Ε": "Е", "Η": "Н", "Ι": "І", "Κ": "К", "Μ": "М",
    "Ο": "О", "Ρ": "Р", "Τ": "Т", "Υ": "У", "Χ": "Х",
    "α": "а", "ά": "а", "ἀ": "а", "ἁ": "а", "ε": "е", "έ": "е", "ἐ": "е",
    "ο": "о", "ό": "о", "ὀ": "о", "ρ": "р", "τ": "т", "κ": "к", "ι": "і",
    "ί": "і", "υ": "у", "χ": "х", "ν": "н",
}

# Латын әрпі қазақ сөзінің ішінде: алдымен көрінісі бірдей әріп,
# қалғаны транслитерация бойынша
LATIN = {
    "a": "а", "b": "б", "c": "с", "d": "д", "e": "е", "f": "ф", "g": "г",
    "h": "һ", "i": "і", "j": "й", "k": "к", "l": "л", "m": "м", "n": "н",
    "o": "о", "p": "р", "q": "қ", "r": "р", "s": "с", "t": "т", "u": "у",
    "v": "в", "w": "у", "x": "х", "y": "у", "z": "з",
    "A": "А", "B": "В", "C": "С", "D": "Д", "E": "Е", "F": "Ф", "G": "Г",
    "H": "Н", "I": "І", "J": "Й", "K": "К", "L": "Л", "M": "М", "N": "Н",
    "O": "О", "P": "Р", "Q": "Қ", "R": "Р", "S": "С", "T": "Т", "U": "У",
    "V": "В", "W": "У", "X": "Х", "Y": "У", "Z": "З",
    "ç": "ш", "Ç": "Ш", "ə": "ә", "Ə": "Ә", "ö": "ө", "Ö": "Ө", "ü": "ү",
    "Ü": "Ү", "ğ": "ғ", "Ğ": "Ғ", "ı": "ы", "ş": "ш", "Ş": "Ш", "ñ": "ң",
}

FOREIGN = "a-zA-Z" + "".join(GREEK) + "çÇəƏöÖüÜğĞışŞñ"

# Программалау терминдері: информатика кітабында «whileдан», «ifке», «printті»
# деп жазылады — бұл тану қатесі емес, кітаптың өз мәтіні. Латын түбірі осы
# тізімде болып, жалғауы қазақша болғанда ғана сөз өзгеріссіз қалады.
KEEP_LATIN = {
    "while", "for", "if", "else", "elif", "def", "return", "break", "continue",
    "import", "from", "print", "input", "range", "int", "float", "str", "list",
    "dict", "tuple", "bool", "none", "true", "false", "lambda", "class", "try",
    "except", "finally", "with", "pass", "global", "len", "sum", "min", "max",
    "abs", "round", "sorted", "append", "remove", "split", "join", "replace",
    "open", "close", "read", "write", "random", "math", "turtle", "pygame",
    "python", "scratch", "excel", "paint", "access", "html", "css", "http",
    "url", "file", "folder", "menu",
    # Толық жазылған терминдер де өзгермейді («minimumнан», «stringке»)
    "minimum", "maximum", "input", "output", "string", "integer", "boolean",
    "array", "index", "value", "index", "count", "insert", "delete", "update",
    "select", "table", "field", "record", "query", "server", "client", "font",
    "start", "stop", "reset", "clear", "color", "screen", "window", "event",
    "sprite", "block", "script", "object", "class", "method", "function",
    "variable", "format", "buffer", "cursor", "folder", "device", "driver",
}
KAZAKH_SUFFIX = (
    "ның|нің|дың|дің|тың|тің|ға|ге|қа|ке|ны|ні|ды|ді|ты|ті|нан|нен|дан|ден"
    "|тан|тен|да|де|та|те|мен|бен|пен|сыз|сіз|дық|дік|тық|тік|лық|лік|ша|ше|ы|і"
)
KEEP_LATIN_WORD = re.compile(r"^([A-Za-z][A-Za-z0-9.]+)(?:%s)$" % KAZAKH_SUFFIX)

# Кирилдегі латынмен көрінісі бірдей әріптер
TO_LATIN = {
    "а": "a", "е": "e", "о": "o", "р": "p", "с": "c", "х": "x", "у": "y", "і": "i",
    "к": "k", "А": "A", "В": "B", "Е": "E", "К": "K", "М": "M", "Н": "H", "О": "O",
    "Р": "P", "С": "C", "Т": "T", "Х": "X", "І": "I",
}

# Сөздікпен тексергенде бөтен әріптің баламалары (бос жол — артық әріп)
ALTERNATIVES = {
    "a": ["а", "ә", ""], "e": ["е", "ә", ""], "i": ["і", "и", "ы", ""],
    "o": ["о", "ө", ""], "u": ["у", "ұ", "ү", ""], "y": ["у", "й", "я", "ы", ""],
    "ı": ["ы", "и", "і"], "n": ["н", "ң"], "g": ["г", "ғ"], "k": ["к", "қ"],
    "h": ["һ", "х", "н"], "s": ["с", "ш", ""], "c": ["с", "ч"], "ç": ["ш", "ч"],
    "ə": ["ә", "е", ""], "r": ["р", ""], "t": ["т", ""], "l": ["л", ""],
}

# Барлық кітаптың таза кирилл сөздері (жиілігімен) — `--vocab-dir` арқылы
VOCABULARY = {}
# Мәтінде кіші әріппен жазылатын сөздер (қысқартудан ажырату үшін)
LOWER_VOCABULARY = {}
# Мәтіндегі жеке латын сөздер («excel», «python») — атау мен жалғауды тану үшін
LATIN_WORDS = {}
# Тек танылған (OCR) кітаптардың сөздері
OCR_VOCABULARY = {}
TEXT_LAYER_PAYLOAD = re.compile(r"payload-hist\d", re.IGNORECASE)


def load_vocabulary(directory):
    import os

    for name in os.listdir(directory):
        if not (name.startswith("payload-") and name.endswith(".json")):
            continue
        data = json.loads(io.open(os.path.join(directory, name), encoding="utf-8").read())
        for book in data if isinstance(data, list) else [data]:
            for section in book["sections"]:
                for group in section["groups"]:
                    for topic in group["topics"]:
                        original = re.sub(r"<[^>]+>", " ", topic["content"])
                        # Шын мәнінде кіші әріппен жазылатын сөздер: «ДНҚның»
                        # сияқты қысқартудан («днқның» тек бас әріппен кездеседі)
                        # ажырату үшін керек
                        for word in re.findall(r"(?<![\w-])[%s]{3,}(?![\w-])" % LOWERCASE, original):
                            LOWER_VOCABULARY[word] = LOWER_VOCABULARY.get(word, 0) + 1
                        text = original.lower()
                        # Сызықшалы сөз бүтін күйінде саналады: оның бөліктері
                        # («тура-лы» → «лы») жеке сөз болып есептелмеуі керек
                        for word in re.findall(r"[%s]+(?:-[%s]+)*" % (CYRILLIC, CYRILLIC), text):
                            if "-" in word:
                                HYPHEN_VOCABULARY[word] = HYPHEN_VOCABULARY.get(word, 0) + 1
                            else:
                                VOCABULARY[word] = VOCABULARY.get(word, 0) + 1
                                # Мәтін қабатынан алынған кітаптарда (hist6, hist7) қос
                                # сөздер де сызықшасыз біріккен — оларға сенбейміз
                                if not TEXT_LAYER_PAYLOAD.search(name):
                                    OCR_VOCABULARY[word] = OCR_VOCABULARY.get(word, 0) + 1
                        for word in re.findall(r"(?<![\w])[a-z]{2,}(?![\w])", text):
                            LATIN_WORDS[word] = LATIN_WORDS.get(word, 0) + 1


def dictionary_choice(word):
    """Бөтен әріптердің баламаларын сынап, сөздікте бар нұсқаны таңдайды."""
    if not VOCABULARY:
        return None
    options = []
    foreign = 0
    for char in word:
        lower = char.lower()
        if lower in ALTERNATIVES or char in GREEK or char in LATIN:
            foreign += 1
            primary = GREEK.get(char) or LATIN.get(char) or char
            variants = ALTERNATIVES.get(lower, [primary.lower()])
            if char.isupper():
                variants = [value.upper() for value in variants]
            options.append([primary] + [value for value in variants if value != primary])
        else:
            options.append([char])
    if foreign > 6:
        return None

    # Әріп тек қайталанғанда («жолдаana» → «жолдана») не «ə» болса ғана өшіріледі
    for position, char in enumerate(word):
        if "" not in options[position]:
            continue
        mapped = (GREEK.get(char) or LATIN.get(char) or char).lower()
        neighbours = {
            (GREEK.get(other) or LATIN.get(other) or other).lower()
            for other in word[max(0, position - 1): position] + word[position + 1: position + 2]
        }
        if char not in "əƏ" and mapped not in neighbours:
            options[position] = [value for value in options[position] if value != ""]

    # (нұсқа, өшірілген әріп саны); бір сөзде бір әріптен артық өшірмейміз
    candidates = [("", 0)]
    for choices in options:
        candidates = [
            (prefix + choice, deleted + (1 if choice == "" else 0))
            for prefix, deleted in candidates
            for choice in choices
            if deleted + (1 if choice == "" else 0) <= 1
        ]
        if len(candidates) > 20000:
            return None

    # Аз өшірілгені, одан кейін жиі кездесетіні
    best = None
    for candidate, deleted in candidates:
        score = VOCABULARY.get(candidate.lower(), 0)
        if score and (best is None or (deleted, -score) < (best[0], -best[1])):
            best = (deleted, score, candidate)
    return best[2] if best else None
# Қысқартуға жалғанған жұрнақ емле бойынша дефиспен жазылады: «БҰҰ-ның»,
# «АҚШ-та». Тану кезінде ол дефис жоғалып кетеді («БҰҰның»).
ABBREVIATION_SUFFIX = re.compile(
    r"(?<![A-Za-z%s-])([A-ZА-ЯЁӘҒҚҢӨҰҮҺІ]{2,7})"
    r"(ның|нің|мен|бен|пен|дан|ден|тан|тен|нан|нен|ға|ге|қа|ке|да|де|та|те"
    r"|ды|ді|ты|ті|ны|ні|сы|сі|лар|лер|дар|дер|тар|тер|дағы|дегі|тағы|тегі"
    r"|дық|дік|тық|тік|лық|лік|сыз|сіз|шы|ші)(?![A-Za-z%s-])" % (CYRILLIC, CYRILLIC)
)

WORD = re.compile(r"[%s%s]+" % (CYRILLIC, FOREIGN))
ROMAN = re.compile(r"^[IVXLCХІ]+$")
# «VIIIғасырларды» — рим цифры мен сөз бітісіп қалған
ROMAN_GLUED = re.compile(r"^([IVXLC]{1,7})([%s]{3,})$" % CYRILLIC)


def fix_word(word):
    has_cyrillic = re.search("[%s]" % CYRILLIC, word)
    has_foreign = re.search("[%s]" % FOREIGN, word)
    if not (has_cyrillic and has_foreign):
        # Грек әрпі жалғыз тұрса да — тану қатесі
        if any(char in GREEK for char in word) and not re.search("[a-zA-Z]", word):
            return "".join(GREEK.get(char, char) for char in word)
        return word

    # Латынша атау + қазақша жалғау («Excelде», «WinRARдың», «GUIде») — қате емес.
    # Атау бас әріптен басталса не мәтінде жеке латын сөз болып кездессе ғана.
    brand = re.match(r"^([A-Za-z]{2,})([%s]{1,8})$" % CYRILLIC, word)
    if brand and (brand.group(1)[0].isupper() or LATIN_WORDS.get(brand.group(1).lower())):
        return word

    # Латынша термин/атау + қазақша жалғау («whileдан», «freeDEXpanoны»,
    # «freedexpano.swfтің») — өзгертілмейді. Тану қатесінде латын әріптері
    # сөздің ішіне 1–4-еуден кездейсоқ кіреді («болmasa», «бір-бірімізben»),
    # ал 5 әріптен ұзын таза латын түбір — нағыз атау.
    keep = KEEP_LATIN_WORD.match(word)
    if keep:
        stem = keep.group(1)
        if (
            stem.lower() in KEEP_LATIN
            or len(stem) >= 5
            or "." in stem
            or re.search(r"[a-z][A-Z]", stem)
        ):
            return word

    # Негізінен латын сөз, ішінде бір-екі кирилл әрпі («elsе», «prіnt») —
    # кирилдегі көрінісі бірдей әріптер латынға ауысады
    latin_count = len(re.findall(r"[a-zA-Z]", word))
    cyrillic_count = len(re.findall("[%s]" % CYRILLIC, word))
    if latin_count >= 3 and latin_count > cyrillic_count * 2 and all(
        char in TO_LATIN or not re.match("[%s]" % CYRILLIC, char) for char in word
    ):
        return "".join(TO_LATIN.get(char, char) for char in word)

    # Кирилл «Х», «І» араласқан рим цифры: «ХV» → «XV»
    if ROMAN.match(word):
        return word.replace("Х", "X").replace("І", "I")

    glued = ROMAN_GLUED.match(word)
    if glued:
        return "%s %s" % (glued.group(1), glued.group(2))

    simple = "".join(GREEK.get(char) or LATIN.get(char) or char for char in word)
    # Әріп алмастыру сөздікте бар сөз берсе — сол; әйтпесе баламалардан іздейміз.
    # Жалғыз латын «i» — көрінісі бірдей «і», оған сөздік керек емес.
    if VOCABULARY.get(simple.lower()) or not re.search(r"[^iI%s]" % CYRILLIC, word):
        return simple
    return dictionary_choice(word) or simple


HYPHENATED = re.compile(
    r"(?<![%s-])([А-ЯЁӘҒҚҢӨҰҮҺІа-яёәғқңөұүһі][а-яёәғқңөұүһі]+)-([а-яёәғқңөұүһі]{2,})(?![%s-])" % (CYRILLIC, CYRILLIC)
)
# Сызықшалы түрінің жиілігі (нағыз қос сөз: «ұлт-азаттық», «күннен-күнге»)
HYPHEN_VOCABULARY = {}


def join_line_hyphen(match):
    """Жол соңындағы тасымал сызықшасы қалып кеткен сөз: «жал-ған» → «жалған».

    Біріккен түрі кітаптардың сөздігінде жиі кездессе ғана біріктіріледі.
    """
    joined = match.group(1) + match.group(2)
    hyphenated = match.group(0).lower()
    # Жиі кездесетін сызықшалы сөз — нағыз қос сөз («бір-бірімен», «сондай-ақ»).
    # Біріккен түрі танылған кітаптардың өзінде кездесуі керек («Қазақстан»),
    # hist6/hist7-дегі «қаружарақтар», «салтдәстүр» — сол кітаптардың қатесі.
    if HYPHEN_VOCABULARY.get(hyphenated, 0) >= 3 or OCR_VOCABULARY.get(joined.lower(), 0) < 2:
        return match.group(0)
    # Нағыз қос сөздің екі бөлігі де жеке сөз («салт-дәстүр», «бір-ақ»), ал
    # тасымал қалдығының бір бөлігі — үзінді («Қа-зақстан», «сая-си», «тү-сіну»).
    # hist6/hist7 мәтін қабатында қос сөздер де біріккен, сондықтан тек біріккен
    # түрінің жиілігіне сенбейміз.
    head, tail = match.group(1).lower(), match.group(2).lower()
    if min(VOCABULARY.get(head, 0), VOCABULARY.get(tail, 0)) < 3:
        return joined
    # Екі бөлігі де сөз, бірақ сызықшалы түрі жалғыз рет кездеседі, ал біріккен
    # түрі кітаптарда жиі («алдын-дағы» → «алдындағы», «от-басы» → «отбасы»)
    if HYPHEN_VOCABULARY.get(hyphenated, 0) <= 1 and OCR_VOCABULARY.get(joined.lower(), 0) >= 5:
        return joined
    return match.group(0)


def restore_abbreviation_hyphen(match):
    """«КСРОмен» → «КСРО-мен». Бас әріппен жазылған қарапайым сөз болса
    («ОТАНДА» деген айдар) — тимейміз, ол қысқарту емес."""
    head, tail = match.group(1), match.group(2)
    # Сөз кітаптарда кіші әріппен де кездессе — ол қысқарту емес, қалпында
    if LOWER_VOCABULARY.get((head + tail).lower(), 0) >= 3 or LOWER_VOCABULARY.get(head.lower(), 0) >= 3:
        return match.group(0)
    return "%s-%s" % (head, tail)


def fix_text_segment(text):
    text = text.replace("́", "")
    if VOCABULARY:
        text = HYPHENATED.sub(join_line_hyphen, text)
    text = ABBREVIATION_SUFFIX.sub(restore_abbreviation_hyphen, text)
    return WORD.sub(lambda match: fix_word(match.group(0)), text)


def fix_html(html):
    # Программа коды (<pre>) өзгермейді: ондағы «\n», латын әріптері — кодтың өзі
    chunks = re.split(r"(<pre\b[\s\S]*?</pre>)", html)
    return "".join(chunk if chunk.startswith("<pre") else fix_prose(chunk) for chunk in chunks)


# Сурет қолтаңбасы тег ішінде атрибут болып тұрады — ол да түзетілуі керек
CAPTION_ATTR = re.compile(r'(alt|data-caption|title)="([^"]*)"')


def fix_attributes(tag):
    return CAPTION_ATTR.sub(lambda match: '%s="%s"' % (match.group(1), fix_text_segment(match.group(2))), tag)


def fix_prose(html):
    # Өлең жолдары «\n» деп жазылып қалған — жол ауыстыруға айналдырамыз.
    # Тек келесі жол бас әріптен басталса: «'line1\n'» сияқты код мысалы өзгермейді
    html = re.sub(r"\\n(?=\s*[A-ZА-ЯЁӘҒҚҢӨҰҮҺІ«(])", "<br>", html)
    parts = re.split(r"(<[^>]+>|\[/?danger[^\]]*\])", html)
    # «[danger]» белгісі сол күйінде қалады, ал «[СУРЕТ: ...]» деген сурет
    # қолтаңбасы — кәдімгі мәтін, ол да түзетіледі
    return "".join(
        fix_attributes(part) if part.startswith("<")
        else part if part.startswith("[danger") or part.startswith("[/danger")
        else fix_text_segment(part)
        for part in parts
    )


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    path = sys.argv[1]
    dry_run = "--dry-run" in sys.argv
    vocab = next((arg[len("--vocab-dir="):] for arg in sys.argv if arg.startswith("--vocab-dir=")), None)
    if vocab:
        load_vocabulary(vocab)
    data = json.loads(io.open(path, encoding="utf-8").read())
    books = data if isinstance(data, list) else [data]
    changed = 0
    samples = []
    for book in books:
        for section in book["sections"]:
            section["title"] = fix_text_segment(section["title"])
            for group in section["groups"]:
                group["title"] = fix_text_segment(group["title"])
                for topic in group["topics"]:
                    for key in ("title", "excerpt"):
                        topic[key] = fix_text_segment(topic.get(key) or "")
                    before = topic["content"]
                    after = fix_html(before)
                    if after != before:
                        changed += 1
                        # Есеп үшін: жол ауыстыру сөз санын өзгертпеуі керек
                        old_words = re.findall(r"\S+", re.sub(r"<[^>]+>|\\n", " ", before))
                        new_words = re.findall(r"\S+", re.sub(r"<[^>]+>", " ", after))
                        samples.extend(
                            "%s → %s" % (old, new)
                            for old, new in zip(old_words, new_words)
                            if old != new
                        )
                    topic["content"] = after
    print("өзгерген тақырып: %d, сөз: %d" % (changed, len(samples)))
    for sample in samples[:400]:
        print("  " + sample)
    if not dry_run:
        io.open(path, "w", encoding="utf-8").write(json.dumps(data, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
