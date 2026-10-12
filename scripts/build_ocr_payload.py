"""Танылған беттерден (OCR) сайттың мазмұн пішімін құрайды.

Кіріс: ocr_pages.mjs дайындаған бет-бет JSON файлдар және кітап құрылымы.
Шығыс: payload.json, суреттер public/books ішіне қиып сақталады.
"""

import io
import json
import os
import re
import shutil
import sys
import unicodedata

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import fitz

import figure_crop
from figure_crop import crop_figure, detect_alignment
from page_paragraphs import indent_flags

NOTE_TITLE = "Біліп жүргенге"

# Оқулықтардың өз белгілері — пайдалы ақпарат блоктары
KEEP_LABELS = (
    "біліп жүр",
    "есіңе сақта",
    "есте сақта",
    "еске сақта",
    "есте сакта",
    "есіңде болсын",
    "қажетті дерек",
    "бұл маңызды",
    "бұл қызық",
    "бұл кім",
    "назар аудар",
    "тарихи дерек",
    "дерек",
    "қосымша мәлімет",
    "анықтама",
    "түсінік",
)

# OCR әртүрлі жазуы мүмкін — атауларды бір қалыпқа келтіреміз
CANONICAL_LABELS = {
    "есте сакта": "Есте сақта",
    "еске сақта": "Есте сақта",
    "есіңе сақта": "Есте сақта",
    "есіңде болсын": "Есте сақта",
    "есте сақта": "Есте сақта",
    "бұл маңызды": "Бұл маңызды",
    "бұл қызық": "Бұл қызық",
    "бұл кім": "Бұл кім",
    "біліп жүр": "Біліп жүр",
    "қажетті дерек": "Қажетті дерек",
    "қосымша мәлімет": "Қосымша мәлімет",
    "деректер": "Деректер",
    "дерек": "Дерек",
}


def canonical_label(label):
    key = (label or "").strip().lower().rstrip("!?:. ")
    return CANONICAL_LABELS.get(key, (label or "").strip().rstrip("!?:. ") or NOTE_TITLE)

# Тапсырма блоктарының белгілері
TASK_LABELS = (
    "ойлан",
    "анықта",
    "ізден",
    "түсіндір",
    "дәйекте",
    "салыстыр",
    "талда",
    "зертте",
    "бағала",
    "ойтолғау",
    "тапсырма",
    "сұрақ",
    "жаттығу",
    "тест",
    "шеберлік",
    "шығармашылық",
    "жоба",
    "пікірталас",
    "ұсыныс",
    "саяхат",
    "кесте жаса",
    "өз ойың",
    "бұл сабақта",
    "тірек сөз",
    "білімінді шында",
    "біліміңді шында",
    "өзіңді тексер",
    "сұрақтар мен тапсырмалар",
    "жауап бер",
    "дәптеріңе",
    "жұптас",
    "топтас",
)

IMPERATIVE_TAIL = {
    "бер", "айт", "ата", "көрсет", "анықта", "талда", "жаса", "құрастыр", "түсіндір",
    "жаз", "тап", "дәлелде", "бағала", "сипатта", "толықтыр", "есепте", "белгіле",
    "таңда", "оқы", "көр", "жина", "ізде", "ойлан", "дәйекте", "салыстыр", "зертте",
    "таныт", "шық", "ұсын", "білдір", "келтір", "әңгімеле", "орында", "аяқта",
    "тұжырымда", "топта", "сал", "шеш", "толтыр", "жалғастыр",
}

# Тапсырма белгісінен кейін нағыз айдарда тыныс белгісі не жалғау келеді:
# «Ойлан!», «Тірек сөздер:», «Сұрақтар мен тапсырмалар». Ал «Зерттеу барысында
# … табылуы», «Шығармашылық тапсырма. Труа келісімі…» — баяндау мәтіні.
LABEL_BOUNDARY = re.compile(
    r"^\s*[-–—:!?.,;)]|^(ыңдар|іңдер|ыңдер|іңдар|ңдар|ңдер|ыңыз|іңіз|ңыз|ңіз"
    r"|дар|дер|лар|лер|тар|тер|ды|ді|ны|ні|сы|сі|ған|ген)\b"
)


def task_label_start(plain, lowered):
    """Абзац тапсырма айдарынан басталады ма."""
    for marker in TASK_LABELS:
        if not lowered.startswith(marker):
            continue
        # Қысқа жол — айдардың өзі; ұзын абзацта айдардан кейін шек болуы тиіс
        return len(plain) < 160 or bool(LABEL_BOUNDARY.match(lowered[len(marker):]))
    return False


# «3-тапсырма.» деген жол — параграф соңындағы тапсырмалар бөлігінің басы.
# Одан кейінгінің бәрі теориялық материал емес.
# Оқу мақсаттары «...бағалау.», «...талдау.» деген етістік атауымен бітеді
OBJECTIVE_TAIL = re.compile(
    r"(анықтау|бағалау|талдау|сипаттау|түсіндіру|салыстыру|зерттеу|жіктеу"
    r"|қорытындылау|дәлелдеу|көрсету|негіздеу|жүйелеу|бағалаңдар)[.\s]*$",
    re.IGNORECASE,
)

# Нөмірленген сұрақтар: «1. Тарихи қайраткерлер деп кімдерді айтамыз?»
# Оқу мақсаттары 1-жақ көпше етістікпен бітеді: «...талдаймыз», «...жасаймыз»
OBJECTIVE_WE = re.compile(
    r"(ймыз|йміз|аймыз|ейміз|ямыз|яміз|еміз|аміз|ейміз|иміз)\s*[.!]?\s*$"
    # Оқу мақсаттарының тізімі: «...қолданамыз;», «...танысамыз,»
    r"|(мыз|міз)\s*[;,]\s*$",
    re.IGNORECASE,
)

# «1-тарау», «2-тарау» — тараудың нөмірі жеке жол болып қалған
CHAPTER_LINE = re.compile(r"^\s*\d{1,2}\s*-\s*тарау\s*[.:]?\s*$", re.IGNORECASE)

# «...талдау арқылы ...» деген оқу мақсатының бастауы
OBJECTIVE_LEAD = re.compile(
    r"(талдау арқылы|бағалау арқылы|салыстыру арқылы|анықтау арқылы)", re.IGNORECASE
)

# Дәйексөз ішіндегі бұйрық рай — тапсырма емес, мәтіннің өзі
# («Ағылшындар, Үндістаннан кетіңдер!» деген ұран, Конфуцийдің сөзі).
QUOTED_SPAN = re.compile("[«“„\"]([^«»“”„\"]{0,800})[»”“\"]")
QUOTE_CLOSE = ("»", "”", "“", '"')

# Жақшадағы нұсқау: «(Кестені дәптеріңе толтыр)» — абзацтың мазмұны емес
BRACKETED = re.compile(r"\([^()]{0,400}\)")

# Баяндау сөйлемінің тиянақты етістігі: «ұсынды:», «қабылдады,». Оқу мақсаты
# тек етістік атауынан құралады, онда мұндай жіктелген етістік болмайды.
FINITE_VERB = re.compile(
    r"[а-яәғқңөұүіһ]{3,}(д[ыі]|т[ыі]|ған|ген|қан|кен|ады|еді|йды|йді)\s*[,:;]",
    re.IGNORECASE,
)

NUMBERED_QUESTION = re.compile(r"^\s*\d+\s*[.)]\s+")

TASK_START = re.compile(r"^\s*\d+\s*[-–—.]?\s*тапсырма", re.IGNORECASE)

# Қазақ тіліндегі бұйрық райдың 2-жақ көпше жалғаулары: тапсырма белгісі
IMPERATIVE_SUFFIX = re.compile(
    r"(ыңдар|іңдер|ыңдер|іңдар|ңдар|ңдер|ыңыз|іңіз|ңыз|ңіз)$", re.IGNORECASE
)

JUNK = re.compile(r"(OKULYK|Все учебники|Книга предоставлена|©)", re.IGNORECASE)

# Оқулықтағы қосалқы блоктар: теориялық материал емес, сондықтан алынып тасталады
# Тірек сөздердің үш тілдегі кестесі — теориялық материал емес
GLOSSARY = re.compile(
    r"қазақша[\s|:]*.{0,40}?(орысша|ағылшынша)",
    re.IGNORECASE | re.DOTALL,
)

GLOSSARY_HEADER = re.compile(r"(қазақша|орысша|ағылшынша)", re.IGNORECASE)

KEY_TERMS_LABEL = re.compile(
    r"(тірек ұғым|тiрек ұғым|негізгі ұғымдар|кілт түсінік|кілт ұғым|жаңа терминдер)",
    re.IGNORECASE,
)

SKIP_BLOCK = re.compile(
    r"(тірек сөздер|тiрек сөздер|оқу мақсаты|оқу мақсаттары|бұл сабақта"
    r"|бүгін сабақта|бүгінгі сабақта|осы сабақта|сабақта біз|бүгін сабағымызда"
    r"|тақырыпқа шығу|тақырыпты оқу барысында|бүгінгі сабағымызда"
    r"|жұмыстың мақсаты|кілт сөздер)",
    re.IGNORECASE,
)
# Суреттің жазу жолы: «61-сурет. …», «12а-сурет», «3, 4-суреттер»
FIGURE_CAPTION_LINE = re.compile(r"^\s*\d+[а-яә]?(?:\s*[,–-]\s*\d+[а-яә]?)*\s*[-–]\s*сурет(?:тер)?(?![а-яә])", re.IGNORECASE)
SENTENCE_END = re.compile(r"[.!?:»…]\s*$")


# Жол соңындағы тасымалдан қалып қойған дефисті түзету үшін қазақ жалғаулары.
# Дефистен кейінгі бөлік осы тізімде болса ғана сөз біріктіріледі — сол себепті
# "ұлт-азаттық", "ашу-ыза", "генерал-губернатор" сияқты нағыз қос сөздер бүлінбейді.
KAZAKH_SUFFIXES = {
    "да", "де", "та", "те", "нан", "нен", "дан", "ден", "тан", "тен",
    "ға", "ге", "қа", "ке", "на", "не", "а", "е",
    "ды", "ді", "ты", "ті", "ны", "ні", "ұ", "у", "ю",
    "ның", "нің", "дың", "дің", "тың", "тің",
    "ын", "ін", "ым", "ім", "ың", "ің", "ы", "і",
    "сы", "сі", "сын", "сін", "сына", "сіне", "сында", "сінде",
    "лар", "лер", "дар", "дер", "тар", "тер",
    "ларын", "лерін", "дарын", "дерін", "тарын", "терін",
    "ларға", "лерге", "дарға", "дерге", "тарға", "терге",
    "лары", "лері", "дары", "дері", "тары", "тері",
    "ларда", "лерде", "дарда", "дерде", "тарда", "терде",
    "ған", "ген", "қан", "кен", "ды", "ді",
    "мен", "бен", "пен", "ша", "ше", "шы", "ші",
    "ру", "ту", "лу", "ну", "уы", "уі", "ып", "іп", "ап", "еп",
    "ыл", "іл", "ыс", "іс", "ыр", "ір", "ыз", "із",
    "атын", "етін", "йтын", "йтін", "ушы", "уші",
    "тік", "тық", "дік", "дық", "лік", "лық",
    "тігі", "тығы", "дігі", "дығы", "лігі", "лығы",
    "ттар", "ттер", "ы­на", "іне", "ына", "іне", "ында", "інде",
}

HYPHEN_SPLIT = re.compile(r"([а-яәғқңөұүіһa-z]{3,})-([а-яәғқңөұүіһ]{1,6})(?![а-яәғқңөұүіһ-])", re.IGNORECASE)

# Бас әріппен жазылған қысқартуға жалғанған жұрнақ емле бойынша дефиспен
# жазылады: «КСРО-мен», «БҰҰ-ның», «АҚШ-та». Ондағы дефис — тасымал емес,
# сондықтан алынмайды. Екі жағы да бас әріп болса («МӘСЕЛЕ-ЛЕРІ») — тасымал.
ABBREVIATION = re.compile(r"^[A-ZА-ЯЁӘҒҚҢӨҰҮҺІ]{2,}$")


def abbreviation_suffix(head, tail):
    """«КСРО» + «мен» — қысқарту мен жұрнақ па (дефис сақталады)."""
    return bool(ABBREVIATION.match(head)) and tail.islower()


# «жол- дары», «Бек- махановты» — жол соңындағы тасымал. Нағыз қос сөзде
# дефистен кейін бос орын болмайды, сондықтан бұл үлгі қауіпсіз.
HYPHEN_SPACE = re.compile(
    r"([а-яәғқңөұүіһa-zA-ZА-ЯЁӘҒҚҢӨҰҮҺІ]{2,})-\s+([а-яәғқңөұүіһ]{2,})"
)


def join_hyphenated(value):
    """Тасымалдан қалған дефисті алып тастайды."""

    def replace(match):
        head, tail = match.group(1), match.group(2)
        if tail.lower() in KAZAKH_SUFFIXES and not abbreviation_suffix(head, tail):
            return head + tail
        return match.group(0)

    def join_space(match):
        head, tail = match.group(1), match.group(2)
        if abbreviation_suffix(head, tail):
            return head + "-" + tail
        return head + tail

    value = HYPHEN_SPLIT.sub(replace, value)
    # Тар бағандағы сөз бірнеше жолға бөлінуі мүмкін («алты- саусақ- тық»):
    # бір өтуде тек көрші жұп бірігеді, сондықтан өзгермейінше қайталаймыз.
    previous = None
    while previous != value:
        previous = value
        value = HYPHEN_SPACE.sub(join_space, value)
    return value


def strip_tags(value):
    return re.sub(r"<[^>]+>", "", value)


def escape_attr(value):
    return value.replace('"', "&quot;")


def last_word(text):
    cleaned = re.sub(r"[^\w\s]+$", "", text.strip())
    parts = cleaned.split()
    return parts[-1].lower() if parts else ""


def trim_label(label):
    """Блок атауы қысқа болуы керек: бірінші сөйлемнен әрі кетпейді."""
    value = re.split(r"[\n.]", (label or "").strip(), maxsplit=1)[0].strip()
    return value if len(value) <= 40 else ""


def classify_box(label, text):
    """Блок пайдалы ақпарат па? Иә болса, оның атауын да қайтарады."""
    body = (text or "").strip()
    if not body or JUNK.search(body):
        return None

    # Оқу мақсаттары блок ішінде де, атауында да кездеседі
    if SKIP_BLOCK.search(label or "") or SKIP_BLOCK.search(body):
        return None
    if OBJECTIVE_WE.search(body) or OBJECTIVE_LEAD.search(body):
        return None

    # Тірек сөздер тізімінің басқа атаулары (11-талап). Тек блок атауы
    # бойынша: мәтін ішінде «негізгі ұғымдар» деп аталса, ол мазмұн.
    if KEY_TERMS_LABEL.search(label or ""):
        return None

    label = trim_label(label)

    lowered_label = (label or "").strip().lower().rstrip("!?. ")
    lowered_body = body.lower()

    for marker in TASK_LABELS:
        if lowered_label.startswith(marker):
            return None

    for marker in KEEP_LABELS:
        if lowered_label.startswith(marker):
            return (canonical_label(label), body)

    # Белгісі жоқ блок: мазмұны бойынша шешеміз
    if len(body) < 25:
        return None

    if "?" in body:
        return None

    for marker in TASK_LABELS:
        if lowered_body.startswith(marker):
            return None

    if last_word(body) in IMPERATIVE_TAIL:
        return None

    return (canonical_label(label) if label else NOTE_TITLE, body)


def valid_figure_box(box):
    if not box or len(box) != 4:
        return False

    ymin, xmin, ymax, xmax = box
    if not all(0 <= value <= 1000 for value in box):
        return False
    if ymax - ymin < 60 or xmax - xmin < 100:
        return False
    if (ymax - ymin) * (xmax - xmin) > 900 * 950:
        return False

    # Тым жалпақ жолақ — оқулықтағы әшекей сызық, сурет емес
    if (xmax - xmin) > (ymax - ymin) * 6:
        return False

    return True


def normalise_table(rows):
    """Кестенің жолдарын реттейді.

    Кітапта атау бір жолда, сипаттамасы келесі жолда тұратын кестелер бар
    («Мемлекет қалпы» | — ; — | «Қазақтар мекендейтін…»). Бірінші бағаны
    бос жол — алдыңғы жолдың жалғасы, сондықтан оған біріктіріледі.
    """
    width = max(len(row) for row in rows)
    rows = [row + [""] * (width - len(row)) for row in rows]

    result = [rows[0]]
    for row in rows[1:]:
        if not any(cell.strip() for cell in row):
            continue

        if not row[0].strip() and len(result) > 1:
            previous = result[-1]
            for column in range(1, width):
                addition = row[column].strip()
                if not addition:
                    continue
                previous_value = previous[column].strip()
                # Ұяшықтағы сөз екі жолға бөлінген («алтысаусақ-» + «тық»):
                # дефис пен бос орын қалмауы керек (3-талап)
                if previous_value.endswith("-") and addition[:1].islower():
                    previous[column] = previous_value[:-1] + addition
                    continue
                # «Шешуі» бағанының қадамдары әр жолдан тұрады; сөйлем ортасы
                # болса — жай жалғасы
                glue = "<br>" if re.search(r"[.!?:;]$", previous_value) else " "
                previous[column] = (previous_value + glue + addition).strip()
            continue

        result.append(row)

    return result


def is_number_row(row):
    """«1 | 2 | 3 | 4 | 5» — баған нөмірлері, мазмұн емес."""
    cells = [cell.strip() for cell in row]
    return bool(cells) and all(re.fullmatch(r"\d{1,2}", cell) for cell in cells if cell) and any(cells)


def markdown_table_to_rows(source):
    # Ұяшық ішінде жол ауысуы мүмкін («| 2,8 млн⏎(29,8%) | …»): жол «|»-мен
    # бітпесе, келесі жол сол жолдың жалғасы.
    lines = []
    for row in source.strip().splitlines():
        row = row.strip()
        if not row:
            continue
        if lines and not lines[-1].endswith("|"):
            lines[-1] = "%s %s" % (lines[-1], row)
        else:
            lines.append(row)
    lines = [row for row in lines if not re.fullmatch(r"[\s|:\-]+", row)]
    if not lines:
        return []

    return [[join_hyphenated(cell.strip()) for cell in line.strip("|").split("|")] for line in lines]


KAZAKH_LETTERS = re.compile(r"[әғқңөұүһіӘҒҚҢӨҰҮҺІ]")
# Қазақ сөзінің жұрнағы: «Галогендер», «Бейметалдар», «тұрақтылық»
KAZAKH_SUFFIX_WORD = re.compile(r"(дар|дер|тар|тер|лар|лер|лық|лік|дық|дік|тық|тік|ғы|гі|сы|сі)\b", re.IGNORECASE)
# Ағылшын термині: кемі бір толық кіші әріпті сөз («Halogens») — «NaCl», «KOH» сияқты формула емес
ENGLISH_TERM = re.compile(r"^[A-Za-z][A-Za-z\s,()'/.\-–]*$")
ENGLISH_WORD = re.compile(r"[a-z]{4,}")


def is_trilingual_term_table(rows):
    """Тарау соңындағы үш тілдегі термин кестесі (11-талап: алынып тасталады).

    «3. | Металдардың химиялық белсенділігі | Химическая активность металлов |
    Chemical activity of metals» — тақырып жолы болмауы да мүмкін. Үш баған
    бірге болғанда ғана танылады: ағылшынша, орысша және қазақша. Элемент
    атауларының кестесі («Na | натрий | Natrium») бір ғана кирилл бағанымен
    тұрады, ал формула бағаны ағылшын термині болып саналмайды.
    """
    rows = [[strip_tags(cell or "").strip() for cell in row] for row in rows if any((cell or "").strip() for cell in row)]
    if len(rows) < 2:
        return False
    width = max(len(row) for row in rows)
    if width < 3:
        return False

    def share(column, test):
        cells = [row[column] for row in rows if column < len(row) and row[column]]
        return sum(1 for cell in cells if test(cell)) / len(cells) if len(cells) >= 2 else 0

    def kazakh_like(value):
        return bool(KAZAKH_LETTERS.search(value) or KAZAKH_SUFFIX_WORD.search(value))

    english = [
        c for c in range(width)
        if share(c, lambda v: bool(ENGLISH_TERM.match(v) and ENGLISH_WORD.search(v))) >= 0.8
    ]
    cyrillic = [c for c in range(width) if c not in english and share(c, lambda v: bool(re.search(r"[а-яА-Я]", v))) >= 0.8]
    russian = [c for c in cyrillic if share(c, kazakh_like) <= 0.2]
    kazakh = [c for c in cyrillic if c not in russian and share(c, kazakh_like) >= 0.5]
    return bool(english and russian and kazakh)


def is_empty_worksheet(rows):
    """Толтыруға арналған бос кесте: тек тақырып жолдары бар, дерек жоқ."""
    data = rows[1:]
    if not data:
        return True
    if any(row and row[0].strip() for row in data):
        return False
    filled = sum(1 for row in data for cell in row if cell.strip())
    return filled <= max(len(row) for row in rows)


def rows_to_html(rows):
    html = ["<table>"]
    for index, cells in enumerate(rows):
        tag = "th" if index == 0 else "td"
        html.append("<tr>" + "".join("<%s>%s</%s>" % (tag, cell, tag) for cell in cells) + "</tr>")
    html.append("</table>")
    return "".join(html)


def markdown_table_to_html(source):
    rows = markdown_table_to_rows(source)
    if not rows:
        return ""
    return rows_to_html(normalise_table(rows))


def load_pages(json_dir, first_page, last_page):
    pages = []
    for name in sorted(os.listdir(json_dir)):
        if not name.endswith(".json"):
            continue
        number = int(re.sub(r"\D", "", name))
        if number < first_page or number > last_page:
            continue
        data = json.loads(io.open(os.path.join(json_dir, name), encoding="utf-8").read())
        if OPTIONS.get("convertLatex"):
            data = convert_latex_tree(data)
        # Бетке тән мәтін түзетулері (баптау: textReplace — [ескі, жаңа] жұптары):
        # модель сызбаны «(image)» деп қалдырған жерлер
        for old, new in (OPTIONS.get("textReplace") or {}).get(str(number), []):
            for key in ("body", "tables"):
                data[key] = [item.replace(old, new) if isinstance(item, str) else item for item in data.get(key) or []]
            for box in data.get("boxes") or []:
                box["text"] = (box.get("text") or "").replace(old, new)
        data["page"] = number
        # Беттің түрі қате анықталса (сөздік бетінің басында § мәтінінің
        # соңы тұрады) — баптаудағы pageKinds бойынша түзетіледі
        data["pageKind"] = (OPTIONS.get("pageKinds") or {}).get(str(number), data.get("pageKind"))
        pages.append(data)
    return pages


def build_topics(pages, pdf_path, slug, image_root, public_prefix, skip_task_residue=False):
    topics = []
    sections = []
    current = None
    figure_counter = 0
    document = fitz.open(pdf_path)
    hide_watermark_image(document, OPTIONS.get("watermarkImageSize"))

    def spec_figure(spec, page):
        """Кестенің орнына қойылатын сурет: қолмен берілген қорап (box) не
        беттің OCR суреті (figure — оның нөмірі)."""
        nonlocal figure_counter
        if "figure" in spec:
            source = (page.get("figures") or [])[spec["figure"]]
            box, caption = source.get("box"), spec.get("caption") or source.get("caption") or ""
        else:
            box, caption = spec["box"], spec.get("caption") or ""
        figure_counter += 1
        name = "%s-%03d.jpg" % (slug, figure_counter)
        clip = crop_figure(pdf_path, page["page"], box, os.path.join(image_root, name), doc=document, exact=True)
        if clip is None:
            figure_counter -= 1
            return None
        return {
            "type": "figure",
            "file": name,
            "align": "center",
            "caption": join_hyphenated(caption),
            "src": "%s/%s/%s" % (public_prefix, slug, name),
            "page": page["page"],
        }
    # Алдыңғы бет тапсырмалармен бітті ме. Тапсырмадан кейінгі дерек блогы
    # келесі бетке, жаңа § атауының үстіне ауысып кетеді.
    carry_tasks = False
    # Атамұра 11: § соңындағы қосымша бөлік келесі § атауына дейін созылады
    until_opening = pages_until_opening(pages) if skip_task_residue else {}
    in_tail = False

    for page in pages:
        kind = (page.get("pageKind") or "content").strip().lower()
        if kind and kind not in ("content", "tasks", "other"):
            # Мазмұны, сөздік, әдебиеттер тізімі, мұқаба — параграфқа кірмейді
            current = None
            carry_tasks = False
            continue

        # Алдыңғы беттен жалғасқан үзінді (§ тақырыбынан бұрын тұрады).
        # Алдыңғы бет тапсырмамен біткен болса, бұл тапсырманың жалғасы.
        lead = (page.get("leadFragment") or "").strip()
        if lead and current is not None and not carry_tasks:
            lead = join_hyphenated(lead)
            current["parts"].append({"type": "body", "html": lead, "text": lead, "indent": False})

        section_title = (page.get("sectionTitle") or "").strip()
        if section_title:
            sections.append({"title": section_title, "firstTopic": len(topics)})

        # «Бірінші бөлімге қорытынды» — мазмұнда бөлек тұратын бет, соңғы
        # параграфқа атаусыз жабыспауы керек
        if SUMMARY_TITLE.search(section_title):
            current = {
                "number": "summary-%d" % page["page"],
                "title": re.sub(r"\s+", " ", section_title),
                "page": page["page"],
                "parts": [],
            }
            topics.append(current)

        number = (page.get("paragraphNumber") or "").strip()
        # Қос параграф (§1-2) ішіндегі «1.», «2.» деген ішкі тармақтар жаңа
        # тақырып емес — олар мәтінде қалың қаріппен тұра береді.
        if number and current is not None and is_inner_point(number, current.get("number")):
            number = current.get("number")
        # Бір параграф бірнеше бетке созылады. Нөмірі қайталанса, бұл сол
        # параграфтың жалғасы — жаңа тақырып ашылмауы керек.
        opened_paragraph = False
        opened_summary = bool(current is not None and current["page"] == page["page"] and current["number"].startswith("summary-"))
        if number and (current is None or number != current.get("number")):
            current = {
                "number": number,
                "title": (page.get("paragraphTitle") or "").strip(),
                "page": page["page"],
                "parts": [],
            }
            topics.append(current)
            opened_paragraph = True

        if current is None:
            carry_tasks = False
            continue

        # § соңына жақын бет (келесі § басына дейін 4 беттен аз)
        near_end = until_opening.get(page["page"], 99) <= TAIL_WINDOW
        if opened_paragraph or opened_summary:
            in_tail = False
        if in_tail:
            # Қосымша бөліктің (терминдер, тапсырмалар, дерек блогы) жалғасы —
            # бет толығымен алынады
            carry_tasks = True
            continue

        # § соңындағы қосымша бөлік (терминдер, тапсырмалар, тест, дерек
        # блогы) — `scripts/mark_apparatus.mjs` белгілеген элементтер
        apparatus = trusted_apparatus(page)
        drop = {
            key: set((apparatus or {}).get(key) or [])
            for key in ("body", "boxes", "tables", "figures")
        }

        # Жаңа § басталған бетте, оның атауының үстінде алдыңғы беттегі
        # тапсырма дерегінің жалғасы тұрады. Белгі жоқ болса, нағыз мәтін
        # («1. …» тармағы) басталғанша беттің басындағы абзацтар алынбайды.
        # Тек § әрқашан «1. …» тармағынан басталатын кітаптарда (Атамұра 11)
        # қосылады — басқа кітаптарда § беттің ортасынан да басталады.
        skip_residue = skip_task_residue and carry_tasks and opened_paragraph and apparatus is None

        # Параграф соңындағы тапсырмалар басталса, беттің қалғаны алынбайды
        tasks_started = False
        # Бөлім қорытындысы — өткенді еске түсіру («…қарастырдыңдар»), тапсырма емес
        summary_page = str(current.get("number", "")).startswith("summary-")
        # Қосымша бөлік беттің қай жерінен басталды (0–1, суреттерді сүзу үшін)
        tail_from = None

        # Азат жол: Tesseract құбыры оны жол координатасынан дәл біледі,
        # әйтпесе беттің кескінінен өлшейміз.
        body_origins = []
        body_paragraphs = group_body_blocks(page.get("body") or [], body_origins)
        # § соңы белгілері бастапқы body нөмірімен берілген — топталған
        # абзацтың нөміріне аударамыз
        drop["body"] = {
            position for position, origin in enumerate(body_origins) if origin in drop["body"]
        }
        # Қолмен алынатын абзацтар (баптау: dropBody, топталған нөмір) — кесте
        # суретпен ауыстырылғанда одан шашырап қалған жазулар
        drop["body"] |= set((OPTIONS.get("dropBody") or {}).get(str(page["page"])) or [])
        flags = page.get("bodyIndent") or []

        # Сызбалы кестелер (баптау: tableFigures) — беттегі кестелердің реті
        # бойынша (алдымен body ішіндегі, сосын tables тізіміндегі)
        table_specs = list((OPTIONS.get("tableFigures") or {}).get(str(page["page"])) or [])
        body_tables = [
            position for position, item in enumerate(body_paragraphs) if is_markdown_table((item or "").strip())
        ]
        spec_by_body = {position: table_specs[order] for order, position in enumerate(body_tables) if order < len(table_specs)}
        spec_by_table = {
            order: table_specs[len(body_tables) + order]
            for order in range(len(page.get("tables") or []))
            if len(body_tables) + order < len(table_specs)
        }
        if len(flags) != len(body_paragraphs):
            flags = indent_flags(document[page["page"] - 1], len(body_paragraphs))
        definitions = definition_flags(body_paragraphs) if skip_task_residue and near_end else []

        # § беттің ортасынан басталса, мәтінде оның атауы («§ 64. ХИМИЯЛЫҚ…»)
        # тұруы мүмкін — одан бұрынғы абзацтар алдыңғы § соңы, соған қалады
        owner = current
        previous_topic = topics[-2] if opened_paragraph and len(topics) >= 2 else None
        echo_at = None
        if previous_topic is not None:
            echo_pattern = re.compile(r"^\s*§\s*%s(?!\d)" % re.escape(number))
            for position, candidate in enumerate(body_paragraphs):
                if position > 0 and echo_pattern.match(strip_tags(candidate or "")):
                    echo_at = position
                    break

        # Қолмен қосылатын суреттер (баптау: extraFigures) — OCR-да жоқ не
        # қорабы дұрыс емес формулалар. «after» — қай абзацтан кейін тұрады
        # (топталған body нөмірі; -1 — беттің басы)
        extra_figures = sorted(
            (OPTIONS.get("extraFigures") or {}).get(str(page["page"])) or [],
            key=lambda spec: spec.get("after", 10 ** 6),
        )

        # Әр абзацтан кейінгі орын (figureAfter үшін): (бөліктер тізімі, соңғы бөлік);
        # -1 — беттің басы
        anchors = {-1: (current["parts"], current["parts"][-1] if current["parts"] else None)}

        def emit_extra_figures(limit):
            while extra_figures and extra_figures[0].get("after", 10 ** 6) < limit:
                spec = extra_figures.pop(0)
                if not tasks_started:
                    part = spec_figure(spec, page)
                    if part:
                        current["parts"].append(part)

        for paragraph_index, paragraph in enumerate(body_paragraphs):
            current = previous_topic if echo_at is not None and paragraph_index < echo_at else owner
            if paragraph_index > 0:
                anchors[paragraph_index - 1] = (current["parts"], current["parts"][-1] if current["parts"] else None)
            emit_extra_figures(paragraph_index)
            if paragraph_index in drop["body"]:
                # Тапсырма блогы сөздің ортасынан басталмайды: алдыңғы беттің
                # соңғы абзацы тасымалмен үзілген болса, беттің басындағы бұл
                # абзац — сол сөйлемнің жалғасы. Белгілеу моделі оны қате
                # белгілеп қоюы мүмкін, сондықтан мұндай жағдайда қалдырамыз.
                previous_body = next(
                    (item for item in reversed(current["parts"]) if item["type"] == "body"),
                    None,
                ) if current else None
                previous_text = ((previous_body or {}).get("text") or "").rstrip()
                head = strip_tags(paragraph or "").strip()[:1]
                if not (paragraph_index == 0 and previous_text.endswith("-") and head.islower()):
                    continue

            raw = (paragraph or "").strip()

            # Программа коды: жолдары мен шегіністері өзгермейді
            fence = CODE_FENCE.match(raw)
            if fence and OPTIONS.get("formulaCode"):
                # Химияда «код» блогы — реакция теңдеулері мен есептеулер:
                # әр жолы индексі бар жеке абзац болады
                if not tasks_started:
                    for line in fence.group(1).split("\n"):
                        line = line.strip()
                        if line:
                            html = formula_html(line)
                            current["parts"].append(
                                {"type": "body", "html": html, "text": strip_tags(html), "indent": False, "page": page["page"]}
                            )
                continue
            if fence:
                if not tasks_started and fence.group(1).strip():
                    current["parts"].append(
                        {"type": "code", "html": code_html(fence.group(1)), "page": page["page"], "inline": True}
                    )
                continue

            # Мәтін арасындағы кесте (информатикада «Берілгені | Шешуі»)
            if is_markdown_table(raw):
                spec = spec_by_body.get(paragraph_index)
                if spec:
                    # Сызбалы кесте (электрондық-графиктік формулалар) мәтінмен
                    # берілмейді — оның орнына беттен қиылған суреті қойылады
                    if not tasks_started:
                        part = spec_figure(spec, page)
                        if part:
                            current["parts"].append(part)
                    continue
                if not tasks_started and not GLOSSARY.search(raw[:160]):
                    rows = markdown_table_to_rows(raw)
                    if rows:
                        rows = [rows[0]] + [row for row in rows[1:] if not is_number_row(row)]
                        rows = normalise_table([list(row) for row in rows])
                        if not is_empty_worksheet(rows) and not is_trilingual_term_table(rows):
                            current["parts"].append(
                                {
                                    "type": "table",
                                    "rows": rows,
                                    "html": rows_to_html(rows),
                                    "page": page["page"],
                                    "inline": True,
                                }
                            )
                continue

            text = join_hyphenated(raw)
            if not text or JUNK.search(text):
                continue

            plain = strip_tags(text)
            lowered = plain.lower()

            # Бөлік белгісі жеке жол болып қалған («Жаңа білім», «Талдау») — мәтін емес
            if SECTION_LABEL.fullmatch(plain.strip()) or CHAPTER_LINE.match(plain.strip()):
                continue

            # Суреттің жазуы мәтінге абзац болып түскен («61-сурет. Күкірт
            # қышқылын өндіру») — ол суреттің өз қолтаңбасында бар
            if len(plain) < 160 and FIGURE_CAPTION_LINE.match(plain):
                continue

            # Тест жауабының нұсқасы: «A) 1939 жылы», «Е) тоқсан бір»
            if kind == "tasks" and len(plain) < 160 and TEST_OPTION.match(plain):
                continue

            # Атамұра 11: § соңында термин анықтамасы («<b>Эрозия</b> – …»),
            # тұлға не «Шығармашылық тапсырмалар» басталса — қосымша бөлік
            if (
                skip_task_residue
                and near_end
                and not tasks_started
                and (definitions[paragraph_index] or TAIL_HEADER.search(plain))
            ):
                tasks_started = True
                tail_from = paragraph_index / max(1, len(body_paragraphs))

            if skip_residue:
                if text.startswith("<b>") and re.match(r"\d+\.\s", plain):
                    skip_residue = False
                else:
                    continue

            # «3-тапсырма.» — тапсырмалар бөлігінің басы. Абзац ортасында
            # тұрса, сол жерден қиямыз да, беттің қалғанын алмаймыз.
            marker = re.search(r"\d\s*[-–—.]?\s*тапсырма", plain, re.IGNORECASE)
            if marker:
                tasks_started = True
                head = plain[: marker.start()].strip()
                if len(head) < 40:
                    continue
                plain = head
                text = strip_tags(text)[: marker.start()].strip()

            if tasks_started:
                continue

            # Тапсырма абзац болып келіп қалуы мүмкін. Кіші әріппен басталған
            # абзац — алдыңғы беттен тасымалданған сөздің жалғасы («ме-» +
            # «талдар болып…»), оны «Талдау» белгісі деп алмаймыз
            if plain[:1].isupper() and task_label_start(plain, lowered):
                continue

            # Беттің соңында бітпей қалған сөйлем («…көлемін анықтау» + келесі
            # бетте «туралы нұсқау берді») — тапсырма емес, мәтіннің жалғасы
            continues_on_next_page = (
                paragraph_index == len(body_paragraphs) - 1 and not SENTENCE_END.search(plain.rstrip())
            )

            # Абзацтың соңғы сөзі автордың нұсқауы ма: дәйексөзбен не жақшадағы
            # ескертпемен бітсе («…қатынас жаса».) — ол баяндау мәтінінің бөлігі
            own_tail = last_word(drop_asides(plain))
            quoted_tail = ends_inside_quote(plain) or continues_on_next_page

            # Бұйрық райдағы қысқа сөйлем — тапсырма («... талдаңдар.»)
            if (
                len(plain) < 300
                and not quoted_tail
                and is_imperative_word(own_tail)
                and not summary_page
            ):
                continue

            if len(plain) < 300 and not quoted_tail and own_tail in IMPERATIVE_TAIL:
                continue

            # Абзац ішінде бұйрық райда бітетін сөйлем болса — тапсырма
            if len(plain) < 500 and has_task_sentence(plain) and not summary_page:
                continue

            # Қысқа сұрақ — тапсырманың бөлігі
            if len(plain) < 300 and plain.rstrip().endswith("?"):
                continue

            # Нөмірленген сұрақ тізімі
            if len(plain) < 400 and NUMBERED_QUESTION.match(plain) and "?" in plain:
                continue

            # Оқу мақсаты: «...қосқан үлесін бағалау.». Бірақ кәдімгі баяндау
            # сөйлемі де осындай етістік атауымен бітуі мүмкін («…қолдау
            # көрсету.»), сондықтан бұрын тиянақты етістік келген болса —
            # бұл мақсат емес, мәтіннің өзі.
            if (
                len(plain) < 320
                and OBJECTIVE_TAIL.search(plain)
                and not continues_on_next_page
                and not FINITE_VERB.search(plain)
            ):
                continue

            # Оқу мақсаты: «...талдаймыз», «...түсіндіреміз және жасаймыз.»
            if len(plain) < 320 and OBJECTIVE_WE.search(plain) and not continues_on_next_page:
                continue

            if len(plain) < 320 and OBJECTIVE_LEAD.search(plain):
                continue

            # «Тірек сөздер», «Оқу мақсаты» сияқты қосалқы блоктар. Олар абзац
            # ортасында да кездеседі, сондықтан абзацты сол жерден қиямыз.
            # Тірек сөздер кестесі мәтін болып та келуі мүмкін
            if GLOSSARY.search(plain[:160]):
                continue

            # Кесте бағанының атауы жеке абзац болып бөлініп кетуі мүмкін
            if GLOSSARY_HEADER.fullmatch(plain.strip(" :|.")):
                continue

            cut = SKIP_BLOCK.search(plain)
            if cut:
                plain = plain[: cut.start()].strip()
                text = strip_tags(text)[: cut.start()].strip()
                if len(plain) < 40:
                    continue

            # «Бұл кім?», «Есте сақта!» сияқты блоктар да абзацқа түсіп кетеді
            # Белгі бөлек сөз болуы керек: «Деректерді кесте түрінде…» — «Дерек» блогы емес
            keep_marker = next(
                (
                    marker
                    for marker in KEEP_LABELS
                    if lowered.startswith(marker)
                    and (len(lowered) == len(marker) or not lowered[len(marker)].isalpha())
                ),
                None,
            )
            if keep_marker:
                rest = plain[len(keep_marker):].lstrip("!?:. ")
                if len(rest) > 30:
                    current["parts"].append(
                        {"type": "note", "title": canonical_label(keep_marker), "text": rest, "page": page["page"]}
                    )
                    continue

            current["parts"].append(
                {
                    "type": "body",
                    "html": text,
                    "text": plain,
                    "indent": flags[paragraph_index] if paragraph_index < len(flags) else True,
                    "page": page["page"],
                }
            )

        current = owner
        if body_paragraphs:
            anchors[len(body_paragraphs) - 1] = (current["parts"], current["parts"][-1] if current["parts"] else None)
        emit_extra_figures(10 ** 7)

        for box_index, box in enumerate(page.get("boxes") or []):
            # Ақпарат блогы («Қосымша ақпарат», «Есте сақта») — тапсырма емес;
            # flash-lite оны кейде тапсырма бөлігі деп белгілейді
            info_box = OPTIONS.get("trustLiteApparatus") and INFO_BOX_LABEL.match(box.get("label") or "")
            if tasks_started or (box_index in drop["boxes"] and not info_box):
                continue

            # § соңындағы сөздік блогы («Сөздік», «Анықтамалар») — терминдер тізімі
            if skip_task_residue and near_end and re.match(
                r"\s*(Сөздік|Анықтамалар)", box.get("label") or "", re.IGNORECASE
            ):
                continue

            # Үштілді сөздік («Терминдер», «Үштілді сөздік», «Кілт сөздер») — тірек сөздер тізімі
            if re.match(r"\s*(термин|үштілді|кілт сөз|сөздік)", box.get("label") or "", re.IGNORECASE):
                continue
            if is_trilingual_glossary(box.get("text") or ""):
                continue

            box_text = box.get("text") or ""
            if OPTIONS.get("dropImagePlaceholders"):
                box_text = drop_image_placeholders(box_text)
            result = classify_box(box.get("label"), join_hyphenated(table_text_as_lines(box_text)))
            if result:
                title, body = result
                # Тапсырма блогы теориялық материал емес
                if is_task_text(strip_tags(body)):
                    continue
                # Блоктың мәтіні өз атауын қайталап басталмауы керек («Есте сақта! …»)
                body = strip_repeated_label(body, title)
                current["parts"].append({"type": "note", "title": title, "text": body, "page": page["page"]})

        for table_index, table in enumerate(page.get("tables") or []):
            # Тапсырмалар басталған соң, кесте де тапсырманың бөлігі
            if tasks_started or table_index in drop["tables"]:
                continue

            # Тілдер кестесі (Қазақша/Орысша/Ағылшынша) — тірек сөздер тізімі
            if GLOSSARY.search(table[:160]):
                continue

            spec = spec_by_table.get(table_index)
            if spec:
                part = spec_figure(spec, page)
                if part:
                    current["parts"].append(part)
                continue

            if OPTIONS.get("dropImagePlaceholders"):
                table = drop_image_placeholders(table)
            html = markdown_table_to_html(table)
            if html:
                rows = markdown_table_to_rows(table)
                if not rows:
                    continue

                # Толтыруға арналған бос кесте — тапсырма
                if is_empty_worksheet(normalise_table([list(row) for row in rows])) or is_trilingual_term_table(rows):
                    continue

                # Алдыңғы беттегі соңғы кесте — «Жалғасы» кестесі соған қосылады.
                # Арасында осы беттің мәтіні тұруы мүмкін, сондықтан бет нөмірімен іздейміз.
                previous_table = None
                for earlier in reversed(current["parts"]):
                    if earlier["type"] == "table" and earlier.get("page") == page["page"] - 1:
                        previous_table = earlier
                        break

                # «Жалғасы» кестесі: тақырып орнында баған нөмірлері тұрады
                if is_number_row(rows[0]) and previous_table is not None and len(rows[0]) == len(previous_table["rows"][0]):
                    merged = previous_table["rows"] + rows[1:]
                    previous_table["rows"] = normalise_table([list(row) for row in merged])
                    previous_table["html"] = rows_to_html(previous_table["rows"])
                    previous_table["page"] = page["page"]
                    continue

                # Тақырып астындағы баған нөмірлерінің жолы алынып тасталады
                rows = [rows[0]] + [row for row in rows[1:] if not is_number_row(row)]
                rows = normalise_table([list(row) for row in rows])
                current["parts"].append(
                    {"type": "table", "rows": rows, "html": rows_to_html(rows), "page": page["page"]}
                )

        page_figures = [dict(figure, _index=index) for index, figure in enumerate(page.get("figures") or [])]
        figure_after = (OPTIONS.get("figureAfter") or {}).get(str(page["page"])) or {}
        figure_drop = set(drop["figures"])
        # Кестенің орнына қойылған не қолмен алынып тасталған суреттер (dropFigures)
        figure_drop |= {spec["figure"] for spec in table_specs if spec and "figure" in spec}
        figure_drop |= set((OPTIONS.get("dropFigures") or {}).get(str(page["page"])) or [])
        if figure_drop and not page.get("figureBoxes") and OPTIONS.get("mergeFigureParts"):
            # Біріктіру нөмірлерді өзгертеді — алынатындарын алдын ала шығарамыз
            page_figures = [figure for index, figure in enumerate(page_figures) if index not in figure_drop]
            figure_drop = set()
        precise = (page.get("figureBoxes") or {}).get("figures") if OPTIONS.get("useFigureBoxes") else None
        if precise is not None:
            # Дәл қораптар (figure_boxes.mjs): жазуы мен тапсырма белгісі сәйкес
            # OCR суретінен алынады
            page_figures, figure_drop = match_precise_figures(page_figures, precise, drop["figures"])
        elif OPTIONS.get("mergeFigureParts") and page["page"] not in OPTIONS["noMergePages"]:
            # Белгіленген бетте біріктіру жүрмейді: сызба мен портрет бір
            # «суретке» қосылып, арасындағы мәтін де кесіліп қалатын еді
            page_figures = merge_touching_figures(page_figures)
        for figure_index, figure in enumerate(page_figures):
            box = figure.get("box")
            valid = precise_box_ok(box) if precise is not None else valid_figure_box(box)
            if not valid or figure_index in figure_drop:
                continue

            # Қосымша бөлік басталған жерден төмен тұрған сурет — тапсырманың суреті
            if tail_from is not None and box[0] / 1000.0 > tail_from - 0.05:
                continue

            caption_text = join_hyphenated((figure.get("caption") or "").strip())
            # Тірек сөздер кестесі сурет болып танылып қалуы мүмкін
            if GLOSSARY.search(caption_text[:160]):
                continue

            # «Тақырыпқа шығу» — сабақ басындағы тапсырманың суреті, қолтаңбасы жоқ
            if re.match(r"\s*Тақырыпқа\s+шығу", caption_text, re.IGNORECASE):
                continue

            # Тапсырма бөлігінің суреті («Компьютерде орындайық – Мәзір көрінісі»)
            if TASK_SECTION_CAPTION.search(caption_text):
                continue

            # Қолтаңба тапсырма болса, сурет қалады да, жазуы алынып тасталады
            if is_task_text(strip_tags(caption_text)):
                caption_text = ""

            figure_counter += 1
            name = "%s-%03d.jpg" % (slug, figure_counter)
            clip = crop_figure(pdf_path, page["page"], box, os.path.join(image_root, name), doc=document)
            if clip is None:
                # Қиындыда тек жазу болды — сурет емес
                figure_counter -= 1
                continue
            # Кітаптағыдай: жанында мәтін болса, сурет сол не оң жақта тұрады
            align = detect_alignment(document[page["page"] - 1], clip)

            part = {
                "type": "figure",
                "file": name,
                "align": align,
                "caption": caption_text,
                "src": "%s/%s/%s" % (public_prefix, slug, name),
                "page": page["page"],
            }
            # Мәтін ішіндегі формула-сурет өз абзацынан кейін тұруы керек
            # (баптау: figureAfter — {сурет нөмірі: абзац нөмірі})
            after = figure_after.get(str(figure.get("_index", figure_index)))
            if after is not None and after in anchors:
                target, anchor = anchors[after]
                position = next((i for i, item in enumerate(target) if item is anchor), -1) + 1 if anchor is not None else 0
                while position < len(target) and target[position].get("placed"):
                    position += 1
                part["placed"] = True
                target.insert(position, part)
            else:
                current["parts"].append(part)

        carry_tasks = tasks_started or kind == "tasks" or bool((apparatus or {}).get("endsInApparatus"))
        in_tail = skip_task_residue and near_end and (tasks_started or kind == "tasks")

    document.close()

    # § басындағы «Тақырыпқа шығу» (эпиграф, өлең, сурет, сұрақ) — сабақтың
    # тапсырмасы. Атамұра 11 кітабында нағыз мәтін әрқашан «1. …» тармағынан
    # басталады, сондықтан § басталған бет пен келесі беттегі одан бұрынғының
    # бәрі алынады.
    if skip_task_residue:
        for topic in topics:
            if str(topic["number"]).startswith("summary-"):
                continue
            start = next(
                (
                    position
                    for position, part in enumerate(topic["parts"])
                    if part["type"] == "body" and FIRST_POINT.match(part.get("html") or "")
                ),
                None,
            )
            if not start:
                continue
            head = topic["parts"][:start]
            if any(part.get("page", topic["page"]) > topic["page"] + 1 for part in head):
                continue
            for part in head:
                if part["type"] == "figure":
                    remove_image(image_root, part["file"])
            topic["parts"] = topic["parts"][start:]

    # Параграф беттің ортасынан басталса, беттің басындағы мәтін алдыңғы
    # параграфқа тиесілі болады — оны сол жаққа қайтарамыз.
    for index in range(1, len(topics)):
        parts = topics[index]["parts"]
        previous = topics[index - 1]["parts"]
        while parts and previous and parts[0]["type"] == "body":
            text = (parts[0].get("text") or "").strip()
            if not text or not text[:1].islower():
                break
            previous.append(parts.pop(0))

    for topic in topics:
        topic["parts"] = merge_continuations(heal_split_paragraphs(strip_heading_echo(topic["parts"])))

    return topics, sections


def hide_watermark_image(document, size):
    """Векторлық PDF-тегі баспа су таңбасы («Алматыкітап баспасы») — барлық бетте
    ортақ бір сурет объектісі. Суреттер қиылмас бұрын ол мөлдір суретпен
    ауыстырылады (тек жадтағы құжатта, файл өзгермейді)."""
    if not size:
        return
    width, height = size
    for page in document:
        for info in page.get_image_info(xrefs=True):
            if info.get("xref") and abs(info["width"] - width) <= 2 and abs(info["height"] - height) <= 2:
                page.delete_image(info["xref"])
                return


def remove_image(image_root, name):
    """Алынып тасталған суреттің файлын өшіреді (файл жоқ болса — ештеңе)."""
    path = os.path.join(image_root, name)
    if os.path.exists(path):
        os.remove(path)


CHAPTER_LABEL = re.compile(r"^[IVXLCІ]+\s*(?:тарау|бөлім)\.?$", re.IGNORECASE)
PARAGRAPH_HEADING = re.compile(r"^§\s*\d+")


def strip_heading_echo(parts):
    """Тақырыптың басында мәтін болып қайталанған атауларды алып тастайды.

    Модель кейде тарау мен § атауын өз өрісіне емес, body-ге жазады
    («II тарау», «ЗАТТАРДЫҢ ХИМИЯЛЫҚ ФОРМУЛАЛАРЫ…», «§5 ХИМИЯЛЫҚ ФОРМУЛАЛАР…»).
    Атау сайтта тақырыптың өзі ретінде тұрады, мәтінде қайталанбауы керек.
    Тек алғашқы бірнеше абзац қаралады; бас әріппен жазылған қысқа абзац
    оқулықтың негізгі мәтінінде кездеспейді.
    """
    result = list(parts)
    checked = 0
    index = 0
    while index < len(result) and checked < 4:
        part = result[index]
        if part["type"] != "body":
            index += 1
            continue
        checked += 1
        text = strip_tags(part.get("text") or part.get("html") or "").strip()
        # Тек кирилл әріптері саналады: «2H₂ + O₂ = 2H₂O» теңдеуі де бас
        # әріптен тұрады, бірақ ол атау емес
        letters = [char for char in text if char.isalpha() and 0x400 <= ord(char) <= 0x4FF]
        upper = letters and sum(1 for char in letters if char.isupper()) / len(letters) > 0.85
        if text and (
            CHAPTER_LABEL.match(text)
            or (PARAGRAPH_HEADING.match(text) and len(text) < 200)
            or (upper and len(text) < 160 and len(letters) >= 4)
        ):
            del result[index]
            continue
        index += 1
    return result


def heal_split_paragraphs(parts):
    """Сурет немесе блок абзацты ортасынан бөліп жібермеуі керек.

    Кітапта сурет пен түсті блок бет ортасында тұрады да, абзац олардың
    алдында басталып, артында жалғасады («жол аш-» … сурет … «ты.»).
    Ондайда сурет пен блокты абзацтың соңына көшіреміз, ал абзацтың екі
    бөлігі кейін біріктіріледі.
    """
    result = list(parts)
    index = 0

    while index < len(result):
        part = result[index]
        if part["type"] != "body":
            index += 1
            continue

        text = (part.get("text") or "").rstrip()
        unfinished = text.endswith("-") or not SENTENCE_END.search(text)
        if not unfinished:
            index += 1
            continue

        # Абзацтан кейінгі сурет/блок/кестелерді өткізіп, келесі мәтінді табамыз.
        # Мәтіннің жанында тұратын (inline) сурет әдетте орнынан жылжытылмайды,
        # бірақ сөз тасымалмен бөлініп қалса («Сөзбе-» … сурет … «сөз мағынасы»),
        # 17б-талап бойынша абзац біртұтас болуы керек — ондайда ол да көшеді.
        hyphenated = text.endswith("-")
        cursor = index + 1
        while cursor < len(result) and result[cursor]["type"] != "body":
            if result[cursor].get("inline") and not hyphenated:
                break
            cursor += 1

        if cursor >= len(result) or cursor == index + 1 or result[cursor]["type"] != "body":
            index += 1
            continue

        following = result[cursor]

        # Суреттің қолтаңбасы абзац жалғасының басына жабысып қалуы мүмкін
        # («Кенесары Қасымұлы бастаған… қозғалыс» + «тын. Қонақжай…») —
        # ондай қолтаңбаны жалғастан алып тастаймыз.
        for middle in result[index + 1:cursor]:
            caption = strip_tags(middle.get("caption") or "").strip()
            body_text = (following.get("text") or "").lstrip()
            if len(caption) >= 12 and body_text.startswith(caption):
                rest = body_text[len(caption):].lstrip()
                if rest[:1].islower():
                    following["text"] = rest
                    html = (following.get("html") or "").lstrip()
                    following["html"] = html[len(caption):].lstrip() if html.startswith(caption) else rest

        head = (following.get("text") or "").lstrip()[:1]
        if not head or not head.islower():
            index += 1
            continue

        # Жалғасы кіші әріптен басталады — бұл жаңа абзац емес
        following["indent"] = False
        between = result[index + 1:cursor]
        result = result[:index + 1] + [following] + between + result[cursor + 1:]
        index += 1

    return result


def merge_continuations(parts):
    result = []
    for part in parts:
        if (
            part["type"] == "body"
            and result
            and result[-1]["type"] == "body"
            and not SENTENCE_END.search(result[-1]["text"])
            and part["text"][:1].islower()
            # Азат жолмен басталған абзац — жаңа абзац, жалғасы емес
            and not part.get("indent")
        ):
            # Бет соңында сөз тасымалмен бөлінген болса, дефис пен бос орын
            # қалмауы керек: «жол-» + «дары» → «жолдары»
            glue = "" if result[-1]["text"].rstrip().endswith("-") else " "
            if not glue:
                result[-1]["text"] = result[-1]["text"].rstrip()[:-1]
                result[-1]["html"] = result[-1]["html"].rstrip()[:-1]

            result[-1]["text"] += glue + part["text"]
            result[-1]["html"] += glue + part["html"]
            continue
        result.append(part)
    return result


def build_content(topic, topic_title):
    chunks = []
    figure_number = 0

    parts = list(topic["parts"])
    # Тақырып атауы мәтіннің басында қайталанып тұрса («3.3 … форматтау» беттің
    # басындағы айдар), ол алынады — атау сайтта бөлек көрсетіледі
    if parts and parts[0]["type"] == "body":
        first = re.sub(r"\s+", " ", strip_tags(parts[0].get("html") or "")).strip(" .:").lower()
        if first and first == re.sub(r"\s+", " ", topic_title or "").strip(" .:").lower():
            parts = parts[1:]

    for part in parts:
        if part["type"] == "body":
            if part.get("indent"):
                chunks.append('<p data-indent="true">%s</p>' % part["html"])
            else:
                chunks.append("<p>%s</p>" % part["html"])
        elif part["type"] == "note":
            chunks.append(
                '[danger title="%s" color="blue"]<p>%s</p>[/danger]'
                % (escape_attr(part["title"]), part["text"])
            )
        elif part["type"] in ("table", "code"):
            chunks.append(part["html"])
        elif part["type"] == "figure":
            figure_number += 1
            # Қолтаңбада да жол соңындағы тасымал қалмауы керек (3-талап):
            # қорапты қайта есептеу жолымен келген жазу біріктірілмеген болуы мүмкін
            label = join_hyphenated(part["caption"] or "") or "%s, %d-сурет" % (topic_title, figure_number)
            align = part.get("align") or "center"
            chunks.append(
                '<figure data-juz-image="true" data-align="%s">'
                '<img src="%s" alt="%s" data-caption="%s" data-align="%s" />'
                "<figcaption>[СУРЕТ: %s]</figcaption></figure>"
                % (
                    align,
                    part["src"],
                    escape_attr(strip_tags(label)),
                    escape_attr("[СУРЕТ: %s]" % strip_tags(label)),
                    align,
                    label,
                )
            )

    return "\n".join(chunks)


# Үзінді бола алмайтын абзац басы: жауап, шешу, кесте/сурет жазуы
EXCERPT_SKIP = re.compile(
    r"^\s*(жауабы|шешуі|шешімі|мысалы|берілгені|\d+[а-яә]?\s*-\s*(кесте|сурет|сызбанұсқа))\b", re.IGNORECASE
)


def build_excerpt(topic):
    """Тақырыптың қысқаша үзіндісі: мағынасы бар бірінші толық абзац."""
    fallback = ""
    for part in topic["parts"]:
        if part["type"] != "body":
            continue
        text = re.sub(r"\s+", " ", (part.get("text") or "")).strip()
        if not text:
            continue
        fallback = fallback or text
        letters = sum(1 for char in text if char.isalpha())
        if len(text) < 60 or EXCERPT_SKIP.match(text) or letters < len(text) * 0.5:
            continue
        fallback = text
        break
    if len(fallback) > 240:
        return fallback[:240].rsplit(" ", 1)[0] + "..."
    return fallback


PARAGRAPH_RANGE = re.compile(r"^\s*§?\s*\d+\s*[-–—]\s*\d+\s*$")

# § соңындағы термин не тұлға анықтамасы: «<b>Эрозия</b> – …»,
# «<b>Әлихан Бөкейхан</b> (1866–1937) – …», «<b>Сунна, сунниттер</b> (араб. – жол) – …»
TERM_DEFINITION = re.compile(
    r"\s*(?:<b>[^<]{2,80}</b>|[A-ZА-ЯӘҒҚҢӨҰҮҺІЁ][^<.!?–—]{1,60}?)\s*(?:\([^)]{0,80}\))?\s*[–—-]\s"
)

# § соңындағы тапсырмалар бөлігінің айдары
TAIL_HEADER = re.compile(
    r"Шығармашылық тапсырма|^\s*\d+\s*[-–—]\s*тапсырма|бөлім бойынша (?:тест|зерттеу)|зерттеу жұмысы",
    re.IGNORECASE,
)

# Келесі § басына осынша беттен жақын болса ғана § соңы деп саналады
TAIL_WINDOW = 4

# Бөлімнің қорытынды беті: «Бірінші бөлімге қорытынды», «I бөлім бойынша қорытынды»,
# «1-БӨЛІМНІҢ ҚОРЫТЫНДЫСЫ» (Арман-ПВ 8-сынып осы түрде жазады)
SUMMARY_TITLE = re.compile(
    r"(бөлімге|бөлім\s+бойынша)\s+қорытынды|бөлімн[іи]ң\s+қорытындысы", re.IGNORECASE
)


def definition_flags(body_paragraphs):
    """Қай абзац § соңындағы терминдер тізімінің басы.

    Негізгі мәтінде де «<b>Ең жиі кездесетіні</b> – …» деген абзац болады,
    сондықтан қатарынан кемінде екі қысқа анықтама тұрса ғана тізім деп
    саналады.
    """
    texts = [join_hyphenated((item or "").strip()) for item in body_paragraphs]
    single = [
        bool(TERM_DEFINITION.match(text)) and len(strip_tags(text)) < 450
        for text in texts
    ]
    # Анықтамадан кейін тағы анықтама не «Шығармашылық тапсырмалар» тұрса
    following = [
        index + 1 < len(texts)
        and (single[index + 1] or bool(TAIL_HEADER.search(strip_tags(texts[index + 1]))))
        for index in range(len(texts))
    ]
    return [single[index] and following[index] for index in range(len(single))]


def pages_until_opening(pages):
    """Әр беттен келесі § басына (не тапсырма бетіне, қорытындыға,
    мазмұннан тыс бетке) дейінгі бет саны."""
    openings = []
    running = None
    for page in pages:
        kind = (page.get("pageKind") or "content").strip().lower()
        if kind == "tasks":
            openings.append(page["page"])
        if kind not in ("content", "tasks", "other"):
            openings.append(page["page"])
            running = None
            continue
        if SUMMARY_TITLE.search(page.get("sectionTitle") or ""):
            openings.append(page["page"])
            running = None
        number = (page.get("paragraphNumber") or "").strip()
        if number and running is not None and is_inner_point(number, running):
            number = running
        if number and number != running:
            openings.append(page["page"])
            running = number
    result = {}
    for page in pages:
        later = [value for value in openings if value > page["page"]]
        result[page["page"]] = later[0] - page["page"] if later else 99
    return result


# Программа коды body ішінде ```…``` түрінде келеді
CODE_FENCE = re.compile(r"^```[\w+-]*[ \t]*\n?(.*?)\n?[ \t]*```$", re.DOTALL)


def code_html(code):
    import html as html_module

    # Модель кілт сөздерді <b>if</b> деп белгілеп жібереді — кодта тег болмайды
    code = html_module.unescape(re.sub(r"</?(b|i|strong|em|sub|sup)>", "", code))
    lines = code.replace("\t", "    ").split("\n")
    # Модель кейде әр жолдың басына бірдей артық бос орын қосады
    indents = [len(line) - len(line.lstrip(" ")) for line in lines if line.strip()]
    common = min(indents) if indents else 0
    lines = [line[common:].rstrip() for line in lines]
    return "<pre><code>%s</code></pre>" % html_module.escape("\n".join(lines).strip("\n"), quote=False)


# LaTeX командалары: модель химиялық есептеулерді кейде LaTeX түрінде жазады
# («\frac{0,414}{24}», «\Delta H», «\text{моль}»). Сайт LaTeX-ті көрсетпейді,
# сондықтан олар кәдімгі таңба мен <sub>/<sup> тегіне айналады.
LATEX_SYMBOLS = {
    "cdot": "·", "times": "×", "div": "÷", "pm": "±", "approx": "≈", "neq": "≠", "ne": "≠",
    "leq": "≤", "le": "≤", "geq": "≥", "ge": "≥", "circ": "°", "degree": "°",
    "rightarrow": "→", "to": "→", "longrightarrow": "→", "Rightarrow": "⇒", "leftarrow": "←",
    "leftrightarrow": "⇄", "rightleftharpoons": "⇄", "rightleftarrows": "⇄", "rlarr": "⇄",
    "uparrow": "↑", "downarrow": "↓", "infty": "∞", "cdots": "…", "ldots": "…", "dots": "…",
    "Delta": "Δ", "delta": "δ", "alpha": "α", "beta": "β", "gamma": "γ", "lambda": "λ",
    "mu": "μ", "nu": "ν", "rho": "ρ", "sigma": "σ", "tau": "τ", "omega": "ω", "Omega": "Ω",
    "pi": "π", "theta": "θ", "varphi": "φ", "phi": "φ", "eta": "η", "epsilon": "ε",
    "varepsilon": "ε", "chi": "χ", "quad": " ", "qquad": " ", "left": "", "right": "",
    "sum": "Σ", "Sigma": "Σ", "upsilon": "υ", "implies": "⇒", "Leftrightarrow": "⇔",
    "parallel": "∥", "setminus": "\\", "backslash": "\\",
    "longleftrightarrow": "⇄", "equiv": "≡", "cdotp": "·", "bullet": "•", "prime": "′",
    "partial": "∂", "nabla": "∇", "psi": "ψ", "xi": "ξ", "zeta": "ζ", "kappa": "κ", "Gamma": "Γ",
    "Lambda": "Λ", "Phi": "Φ", "Psi": "Ψ", "Theta": "Θ", "Pi": "Π", "ell": "l", "hbar": "ħ",
    "uparrows": "↑", "nearrow": "↗", "searrow": "↘", "Longrightarrow": "⇒", "mid": "|",
    "displaystyle": "", "textstyle": "", "limits": "", "nolimits": "", "big": "", "Big": "",
    "bigl": "", "bigr": "", "Bigl": "", "Bigr": "", "hspace": "", "vspace": "", "newline": " ",
}
# Белгісі бос орынсыз жабысқан команда: «\DeltaH», «\timesK», «\circC»
LATEX_SYMBOL_PREFIX = sorted(LATEX_SYMBOLS, key=len, reverse=True)


def latex_command(match):
    name = match.group(1)
    if name in LATEX_SYMBOLS:
        return LATEX_SYMBOLS[name]
    for known in LATEX_SYMBOL_PREFIX:
        if len(known) >= 3 and name.startswith(known) and known not in ("left", "right", "big", "Big"):
            return LATEX_SYMBOLS[known] + name[len(known):]
    return match.group(0)


# Карбонил тобы матрица болып жазылады: «O ∥ —C \ OH» → «—C(=O)OH»
CARBONYL_ROWS = (
    re.compile(r"O<br>∥<br>\s*([-—–]?)\s*C<br>\\?\s*(?:<br>)?\s*(OH|H|O[A-Za-z]{0,3})"),
    re.compile(r"C\s*O<br>∥<br>\s*\\?\s*(OH|H|O[A-Za-z]{0,3})"),
    re.compile(r"C\s*O<br>\s*\\?\s*(OH|H)\b"),
)


def carbonyl_matrix(text):
    text = CARBONYL_ROWS[0].sub(lambda m: "%sC(=O)%s" % (m.group(1), m.group(2)), text)
    text = CARBONYL_ROWS[1].sub(lambda m: "C(=O)%s" % m.group(1), text)
    return CARBONYL_ROWS[2].sub(lambda m: "C(=O)%s" % m.group(1), text)


def latex_environments(text):
    r"""«\begin{aligned} x &= … \\ … \end{aligned}» — жолдарға бөлінеді;
    «\begin{array}{ccc} a & b \\ … \end{array}» — ұяшықтары em-бос орын арқылы."""
    def environment(match):
        body = match.group(2)
        body = re.sub(r"^\s*\{[lcr|\s]*\}", "", body) if match.group(1).startswith("array") else body
        rows = [row.strip() for row in re.split(r"\\\\", body) if row.strip()]
        # Ұяшықтар арасы — em-бос орын («|» markdown кестесін бұзады)
        separator = "   " if match.group(1).startswith(("array", "tabular", "matrix", "pmatrix")) else " "
        cells = [separator.join(cell.strip() for cell in row.split("&") if cell.strip()) for row in rows]
        return "<br>".join(cells)

    return re.sub(
        r"\\begin\s*\{(aligned\*?|align\*?|array|gathered|cases|tabular|matrix|pmatrix|split|equation\*?)\}(.*?)\\end\s*\{\1\}",
        environment,
        text,
        flags=re.DOTALL,
    )
LATEX_MARK = re.compile(r"\\[A-Za-z]+|\$|\^\{|_\{")
LATEX_WRAP = re.compile(r"\\(?:text|mathrm|mathbf|textbf|textit|mathit|operatorname|mbox)\s*\{([^{}]*)\}")
LATEX_FRAC = re.compile(r"\\[dt]?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}")
LATEX_SQRT = re.compile(r"\\sqrt\s*\{([^{}]*)\}")
# Тілдің үсті-асты: «\xrightarrow[t^{\circ}]{Br_{2}\text{ (1 моль)}}» — ішкі жақша болуы мүмкін
LATEX_ARROW = re.compile(
    r"\\x(right|left)arrow\s*(?:\[((?:[^\[\]{}]|\{[^{}]*\})*)\])?\s*\{((?:[^{}]|\{[^{}]*\})*)\}"
)
LATEX_OVERSET = re.compile(r"\\(?:overset|stackrel)\s*\{([^{}]*)\}\s*\{([^{}]*)\}")
LATEX_SUP = re.compile(r"\^\{([^{}]*)\}")
LATEX_SUB = re.compile(r"_\{([^{}]*)\}")
LATEX_SUP_ONE = re.compile(r"\^([+\-−]?[\w°])")
LATEX_SUB_ONE = re.compile(r"_([\w])")
LATEX_COMMAND = re.compile(r"\\([A-Za-z]+)")


def latex_to_html(value):
    r"""«\frac{a}{b}» → «a/b», «x^{2}» → «x<sup>2</sup>», «\Delta» → «Δ»."""
    if not isinstance(value, str) or not LATEX_MARK.search(value):
        return value

    def fraction(match):
        top, bottom = match.group(1).strip(), match.group(2).strip()
        wrap = lambda part: "(%s)" % part if re.search(r"[\s+\-−·×]", part) else part
        return "%s/%s" % (wrap(top), wrap(bottom))

    # JSON-ның «\u2192» белгісі мәтін болып қалған — нағыз таңбаға айналады
    text = re.sub(r"\\u([0-9a-fA-F]{4})", lambda m: chr(int(m.group(1), 16)), value)
    # Ортадағы «\\» — жол бөлгіш, сондықтан орталар бірінші өңделеді
    text = latex_environments(text)
    # «\overline{x}» — орташа мән белгісі «x̄»
    text = re.sub(
        r"\\overline\s*\{([^{}]*)\}",
        lambda m: unicodedata.normalize("NFC", "".join(char + "\u0304" for char in m.group(1))),
        text,
    )
    # «\text{{F}}» — екі еселенген жақша, «{}^{12}C» — бос топ
    # (модель жақшаны f-жолдағыдай түгел екі еселейді)
    if "{{" in text:
        text = text.replace("{{", "{").replace("}}", "}")
    text = text.replace("{}", "")
    # «^\circ», «^{\circ}» — градус белгісі
    text = re.sub(r"\^\s*\{\s*\\circ\s*\}", "°", text)
    text = re.sub(r"\^\s*\\circ(?![A-Za-z])", "°", text)
    # «\bar{e}» — электрон белгісі «ē»
    text = re.sub(r"\\bar\s*\{\s*(\w)\s*\}", lambda m: unicodedata.normalize("NFC", m.group(1) + "\u0304"), text)
    # Модель кейде кері қиғашты екі еселеп жазады: «\\frac», «\\text»
    text = re.sub(r"\\{2,}(?=[A-Za-z()\[\]%,;:! ])", lambda m: "\\", text)
    text = text.replace("$", "")
    text = re.sub(r"\\[()\[\]{}]", "", text)
    for _ in range(6):
        previous = text
        text = LATEX_WRAP.sub(lambda m: m.group(1), text)
        # Реакция шарты тілдің үстінде: «\xrightarrow{t°}» → «<sup>t°</sup>→»
        text = LATEX_ARROW.sub(
            lambda m: "<sup>%s</sup>%s%s"
            % (m.group(3), "→" if m.group(1) == "right" else "←", "<sub>%s</sub>" % m.group(2) if m.group(2) else ""),
            text,
        )
        text = LATEX_OVERSET.sub(lambda m: "<sup>%s</sup>%s" % (m.group(1), m.group(2)), text)
        text = LATEX_FRAC.sub(fraction, text)
        text = LATEX_SQRT.sub(lambda m: "√(%s)" % m.group(1), text)
        text = LATEX_SUP.sub(lambda m: "<sup>%s</sup>" % m.group(1), text)
        text = LATEX_SUB.sub(lambda m: "<sub>%s</sub>" % m.group(1), text)
        if text == previous:
            break
    text = LATEX_SUP_ONE.sub(lambda m: "<sup>%s</sup>" % m.group(1), text)
    text = LATEX_SUB_ONE.sub(lambda m: "<sub>%s</sub>" % m.group(1), text)
    text = LATEX_COMMAND.sub(latex_command, text)
    text = re.sub(r"\\([%,;:! ])", lambda m: {"%": "%"}.get(m.group(1), " "), text)
    text = text.replace("{", "").replace("}", "")
    # LaTeX-те «\Delta H» бос орынсыз «ΔH» болып шығады
    text = re.sub(r"([ΔδαβγλμνρστωΩπθφηεχ]) (?=[A-Za-z])", r"\1", text)
    text = carbonyl_matrix(text)
    return re.sub(r"[ \t]{2,}", " ", text)


ARROWS = "→←⇄⇌↔⟶⟵="


def mathml_to_html(node):
    """MathML түйінін сайттың мәтініне айналдырады: <mfrac> → «a/b»,
    <msup> → «a<sup>b</sup>», <mover>→ + шарт</mover> → «<sup>шарт</sup>→»."""
    tag = node.tag.split("}")[-1].lower()
    children = list(node)
    convert = mathml_to_html
    if tag in ("mi", "mn", "mo", "mtext", "ms"):
        return (node.text or "").strip() + "".join(convert(child) + (child.tail or "") for child in children)
    if tag == "mspace":
        return " "
    if tag == "msup" and len(children) >= 2:
        return "%s<sup>%s</sup>" % (convert(children[0]), convert(children[1]))
    if tag == "msub" and len(children) >= 2:
        return "%s<sub>%s</sub>" % (convert(children[0]), convert(children[1]))
    if tag == "msubsup" and len(children) >= 3:
        return "%s<sub>%s</sub><sup>%s</sup>" % tuple(convert(child) for child in children[:3])
    if tag == "mfrac" and len(children) >= 2:
        wrap = lambda part: "(%s)" % part if re.search(r"[\s+\-−·×]", strip_tags(part)) else part
        return "%s/%s" % (wrap(convert(children[0]).strip()), wrap(convert(children[1]).strip()))
    if tag == "msqrt":
        return "√(%s)" % "".join(convert(child) for child in children)
    if tag in ("mover", "munder", "munderover") and len(children) >= 2:
        base = convert(children[0]).strip()
        extra = [convert(child).strip() for child in children[1:3]]
        over = extra[-1] if tag != "munder" else ""
        under = extra[0] if tag != "mover" else ""
        # Реакция шарты тілдің үстінде жазылады: «<sup>t°</sup>→»
        if strip_tags(base) and all(char in ARROWS for char in strip_tags(base)):
            return "%s%s%s" % ("<sup>%s</sup>" % over if over else "", base, "<sub>%s</sub>" % under if under else "")
        return "%s%s%s" % (base, "<sup>%s</sup>" % over if over else "", "<sub>%s</sub>" % under if under else "")
    if tag == "mtable":
        return "<br>".join(convert(child) for child in children)
    if tag == "mtr":
        return " ".join(convert(child) for child in children)
    return (node.text or "") + "".join(convert(child) + (child.tail or "") for child in children)


def convert_mathml(value):
    """Мәтін ішіндегі <math>…</math> үзінділерін HTML мәтінге айналдырады."""
    import xml.etree.ElementTree as ElementTree

    def replace(match):
        source = match.group(0)
        try:
            node = ElementTree.fromstring(re.sub(r"&(?!amp;|lt;|gt;|quot;|#)", "&amp;", source.replace("<br>", " ")))
            return re.sub(r"\s{2,}", " ", mathml_to_html(node)).strip()
        except ElementTree.ParseError:
            return re.sub(r"<[^>]+>", " ", source)

    return re.sub(r"<math\b[^>]*>.*?</math>", replace, value, flags=re.DOTALL | re.IGNORECASE)


def sanitize_markup(value):
    """Модель қосатын безендіру тегтері («<span style=…>», «<small>»,
    «<xrightarrow>…</xrightarrow>», MathML) — мазмұны қалады, тегі кетеді."""
    if "<" not in value:
        return value
    value = convert_mathml(value)
    value = re.sub(r"</?math\b[^>]*>", "", value)
    value = re.sub(r"<xrightarrow>(.*?)</xrightarrow>", r"<sup>\1</sup>→", value, flags=re.DOTALL)
    # Бөлшек сызығы <hr> болып келеді: «ν<br><hr …>V» → «ν/V»
    value = re.sub(r"\s*<br\s*/?>\s*<hr\b[^>]*>\s*(?:<br\s*/?>)?\s*", "/", value, flags=re.IGNORECASE)
    value = re.sub(r"<hr\b[^>]*>", "/", value, flags=re.IGNORECASE)
    value = re.sub(r"</?(?:span|small|big|font|div)\b[^>]*>", "", value, flags=re.IGNORECASE)
    value = re.sub(r"<(/?)inf>", r"<\1sub>", value)
    # Альдегид/карбоксил тобы сызбадағыдай екі қабат жазылады:
    # «C<sup>O</sup><sub>\H</sub>», «HC<sub>\ O</sub><sup>\ H</sup>» → «C(=O)H»
    def carbonyl(match):
        parts = [re.sub(r"[\\\s=/]", "", part) for part in (match.group(1), match.group(2))]
        other = [part for part in parts if part != "O"]
        return "C(=O)%s" % (other[0] if len(other) == 1 else "")

    value = re.sub(
        r"C<su[pb]>\s*\\?\s*=?\s*([^<]{1,4})</su[pb]>\s*<su[pb]>\s*(\\\s*[^<]{1,3})</su[pb]>",
        lambda m: carbonyl(m) if "O" in (m.group(1) + m.group(2)) else m.group(0),
        value,
    )
    return value


def convert_latex_tree(value):
    """Беттің JSON-ындағы барлық мәтін өрісіне latex_to_html қолданады."""
    if isinstance(value, str):
        # Модель жол ауысуын «\n» деп мәтінмен жазып жіберуі мүмкін
        if not value.lstrip().startswith("```"):
            value = re.sub(r"\\n(?=\S)", "<br>", value)
        return latex_to_html(sanitize_markup(value))
    if isinstance(value, list):
        return [convert_latex_tree(item) for item in value]
    if isinstance(value, dict):
        return {key: convert_latex_tree(item) if key not in ("box", "figureBoxes") else item for key, item in value.items()}
    return value


# Химиялық формуладағы индекс: код блогында модель оларды тегсіз жазады
# («ZnCl2», «Fe3+», «Mg+2»). Коэффицент («2HCl») өзгермейді.
FORMULA_CHARGE = re.compile(r"([A-Z][a-z]?|\))(\d*[+\-−])(?=[\s,;)\]=]|$)")
FORMULA_OXIDATION = re.compile(r"([A-Z][a-z]?)([+\-−]\d)(?!\d)")
FORMULA_INDEX = re.compile(r"([A-Z][a-z]?|\))(\d+)")


def formula_html(line):
    """Код блогындағы формула жолын индексі бар мәтінге айналдырады."""
    if "<sub>" in line or "<sup>" in line:
        return line
    parts = re.split(r"(<[^>]+>)", line)
    result = []
    for part in parts:
        if part.startswith("<"):
            result.append(part)
            continue
        part = FORMULA_CHARGE.sub(lambda m: "%s<sup>%s</sup>" % (m.group(1), m.group(2)), part)
        part = FORMULA_OXIDATION.sub(lambda m: "%s<sup>%s</sup>" % (m.group(1), m.group(2)), part)
        pieces = re.split(r"(<sup>.*?</sup>)", part)
        pieces = [p if p.startswith("<sup>") else FORMULA_INDEX.sub(lambda m: "%s<sub>%s</sub>" % (m.group(1), m.group(2)), p) for p in pieces]
        result.append("".join(pieces))
    return "".join(result)


def is_markdown_table(value):
    lines = join_table_continuations((value or "").splitlines())
    return len(lines) >= 2 and all(is_table_row(line) for line in lines)


# Кітапқа тән баптаулар (main ішінде толтырылады)
OPTIONS = {}

# Пайдалы ақпарат блоктарының белгілері
INFO_BOX_LABEL = re.compile(
    r"\s*(қосымша ақпарат|есте сақта|назар аудар|анықтама|біліп жүр|қызықты дерек)", re.IGNORECASE
)

# Тапсырма бөліктерінің атауы сурет жазуында («Компьютерде орындайық – …»)
TASK_SECTION_CAPTION = re.compile(
    r"(орындайық|жауап берейік|талқылайық|салыстырайық|ой бөлісейік|үй тапсырмасы|практикалық жұмыс)",
    re.IGNORECASE,
)

# Оқулықтағы бөлік белгілері (икон жанындағы жазу) — жеке тұрса мәтін емес
SECTION_LABEL = re.compile(
    r"(жаңа білім|талдау|ойлан|практикалық жұмыс|тапсырма|үй тапсырмасы|жинақтау|бағалау"
    r"|жұптық жұмыс|жеке жұмыс|топтық жұмыс|қосымша ақпарат|ойлануға берілген сұрақтар"
    r"|сабақтың мақсаты|үштілді сөздік)\s*[:.!]?",
    re.IGNORECASE,
)


def strip_repeated_label(body, title):
    """«Есте сақта! 1891 жылы…» → «1891 жылы…» (атау блоктың өзінде тұрады)."""
    pattern = r"^\s*(<b>)?\s*%s\s*[!:.]?\s*(</b>)?\s*" % re.escape((title or "").strip().rstrip("!:."))
    stripped = re.sub(pattern, "", body or "", count=1, flags=re.IGNORECASE)
    return stripped if len(strip_tags(stripped).strip()) >= 10 else body


TRILINGUAL_LINE = re.compile(r"^[^–—\-\n]{2,60}\s[–—-]\s[^–—\-\n]{2,60}\s[–—-]\s*[A-Za-z][A-Za-z ,()'-]*$")


def is_trilingual_glossary(text):
    """«Егер – Если – If», «пайдаланушы интерфейсі – пользовательский интерфейс – user interface»."""
    lines = [line.strip() for line in re.split(r"\n|<br\s*/?>", strip_tags_keep_breaks(text)) if line.strip()]
    if not lines:
        return False
    hits = sum(1 for line in lines if TRILINGUAL_LINE.match(line))
    return hits >= max(1, len(lines) // 2)


def strip_tags_keep_breaks(value):
    return re.sub(r"<(?!br)[^>]+>", "", value or "")

FIGURE_NUMBER = re.compile(r"\d+\s*[-–]?\s*(сурет|сызба|кесте|схема)", re.IGNORECASE)


def precise_box_ok(box):
    """Дәл қорап: пішіні дұрыс, өлшемі нөлдік емес (жіңішке құралдар тақтасы да сурет)."""
    return (
        isinstance(box, list) and len(box) == 4
        and box[2] - box[0] >= 15 and box[3] - box[1] >= 15
    )


def match_precise_figures(ocr_figures, precise, dropped):
    """Дәл қорапқа ең көп қабаттасатын OCR суретін табады.

    Қайтарады: (суреттер тізімі, алынатын индекстер). Жазу OCR суретінен
    алынады (ол «N-сурет. …» жолын толық оқиды), болмаса дәл қораптың өз жазуы.
    """
    def overlap(a, b):
        top, left = max(a[0], b[0]), max(a[1], b[1])
        bottom, right = min(a[2], b[2]), min(a[3], b[3])
        if bottom <= top or right <= left:
            return 0.0
        area = max(1.0, (a[2] - a[0]) * (a[3] - a[1]))
        return (bottom - top) * (right - left) / area

    def union_share(a, b):
        top, left = max(a[0], b[0]), max(a[1], b[1])
        bottom, right = min(a[2], b[2]), min(a[3], b[3])
        if bottom <= top or right <= left:
            return 0.0
        common = (bottom - top) * (right - left)
        total = (a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - common
        return common / max(1.0, total)

    figures = []
    drop = set()
    for index, item in enumerate(precise):
        box = item.get("box")
        best, best_score, best_union = None, 0.0, -1.0
        for ocr_index, ocr in enumerate(ocr_figures):
            ocr_box = ocr.get("box")
            if not (isinstance(ocr_box, list) and len(ocr_box) == 4 and isinstance(box, list) and len(box) == 4):
                continue
            score = max(overlap(box, ocr_box), overlap(ocr_box, box))
            # Бір бөлігі ғана (логотиптің біреуі) емес, қорапқа ең жақын OCR суреті
            union = union_share(box, ocr_box)
            if score >= 0.2 and union > best_union:
                best, best_score, best_union = ocr_index, score, union
        caption = item.get("caption") or ""
        if best is not None and best_score >= 0.2:
            caption = ocr_figures[best].get("caption") or caption
            if best in dropped:
                drop.add(index)
        figures.append({"box": box, "caption": caption})
    return figures, drop


def merge_touching_figures(figures):
    """Бір сызба бірнеше бөлікке бөлініп танылады («100 байт – …» жақтаулары).
    Нөмірсіз, бір-біріне тиіп тұрған бөліктер бір суретке біріктіріледі."""
    items = [dict(item) for item in figures]
    merged = True
    while merged:
        merged = False
        for first in range(len(items)):
            for second in range(first + 1, len(items)):
                a, b = items[first], items[second]
                box_a, box_b = a.get("box"), b.get("box")
                # Бөлік жеке алғанда жолақ сияқты жіңішке болуы мүмкін — тек пішінін тексереміз
                if not (isinstance(box_a, list) and len(box_a) == 4 and isinstance(box_b, list) and len(box_b) == 4):
                    continue
                if FIGURE_NUMBER.search(a.get("caption") or "") and FIGURE_NUMBER.search(b.get("caption") or ""):
                    continue
                gap_y = max(box_a[0], box_b[0]) - min(box_a[2], box_b[2])
                gap_x = max(box_a[1], box_b[1]) - min(box_a[3], box_b[3])
                if gap_y > 25 or gap_x > 25:
                    continue
                union = [min(box_a[0], box_b[0]), min(box_a[1], box_b[1]), max(box_a[2], box_b[2]), max(box_a[3], box_b[3])]
                caption = next(
                    (item.get("caption") for item in (a, b) if FIGURE_NUMBER.search(item.get("caption") or "")),
                    a.get("caption") or b.get("caption") or "",
                )
                items[first] = {"caption": caption, "box": union}
                del items[second]
                merged = True
                break
            if merged:
                break
    return items


def is_table_row(line):
    line = (line or "").strip()
    return len(line) >= 3 and line.startswith("|") and line.endswith("|") and "\n" not in line


CYRILLIC_LETTER = re.compile(r"[а-яёәғқңөұүһі]", re.IGNORECASE)
# Python жолы: кириллица айнымалы атауы болса да танылады
PYTHON_HINT = re.compile(
    r"^\s*(>>>|#|(\w+(\s*,\s*\w+)*\s*=\s*)?(print|input|int|float|str|open|len|range|map|list)\s*\(|"
    r"(if|elif|else|for|while|def|try|except|with)\b.*:\s*$|import\s+\w+|from\s+\w+\s+import)"
)


def looks_like_code(line):
    plain = html_unescape(strip_tags(line or "")).strip()
    if not plain or plain.startswith("|") or len(plain) > 200:
        return False
    if PYTHON_HINT.search(plain):
        return True
    # Жол литералы мен түсініктемені алып тастаған соң кириллица жоқ, бірақ код белгісі бар
    bare = re.sub(r"#.*$", "", re.sub(r"(['\"]).*?\1", "", plain))
    return not CYRILLIC_LETTER.search(bare) and bool(re.search(r"[()=\[\]]", bare)) and not re.search(r"\s[–—]\s", plain)


def console_output(line):
    """>>> командасынан кейінгі нәтиже жолы (кириллицасыз)."""
    plain = html_unescape(strip_tags(line or "")).strip()
    return bool(plain) and not CYRILLIC_LETTER.search(plain) and len(plain) < 120 and not plain.startswith("|")


def html_unescape(value):
    import html as html_module

    return html_module.unescape(value)


# Мәтінде рұқсат етілген тегтер; қалған «<» — мәтіннің өзі («<_io.TextIOWrapper>», «<=»)
ALLOWED_TAG = re.compile(r"<(?=/?(b|i|em|strong|sub|sup|br)\b[^<>]*>)", re.IGNORECASE)


def escape_unknown_tags(value):
    marked = ALLOWED_TAG.sub("\x00", value or "")
    return marked.replace("<", "&lt;").replace("\x00", "<")


# Шеткі белгісіз кесте жолы: кемі екі «|», әр ұяшықта мәтін бар
BARE_PIPE_ROW = re.compile(r"[^|\n]*[^|\s][^|\n]*(?:\|[^|\n]*[^|\s][^|\n]*){2,}")


def join_table_continuations(lines):
    """Ұяшық ішіндегі жол ауысуы («| Эукариоттар⏎1) қарапайым-⏎дылар | + |»):
    «|»-мен басталып, «|»-мен бітпеген жолға келесі жолдар жалғанады."""
    result = []
    for line in lines:
        line = line.strip()
        if not line:
            continue
        if result and result[-1].startswith("|") and not result[-1].endswith("|"):
            result[-1] = "%s %s" % (result[-1], line)
        else:
            result.append(line)
    return result


def split_table_lines(item):
    """«9-кесте⏎Атауы⏎| a | b |⏎|---|---|⏎…» — мәтін жолдары мен кесте жолдары
    бір элементке жабысып келеді. Кесте өз алдына бөлінбесе, ол абзац ішінде
    «| --- |» күйінде қалады."""
    lines = join_table_continuations(item.split("\n"))
    table_lines = [line for line in lines if is_table_row(line)]
    if len(table_lines) < 2 or len(table_lines) == len([line for line in lines if line]):
        return ["\n".join(lines)] if len(table_lines) == len(lines) and len(lines) >= 2 else [item]
    pieces, text = [], []
    for line in lines:
        if is_table_row(line):
            if text:
                pieces.append("\n".join(text))
                text = []
            pieces.append(line)
        elif line:
            text.append(line)
    if text:
        pieces.append("\n".join(text))
    return pieces


# Модель сызбаның орнына ойдан шығарған сілтеме: «![Сурет](https://example.com/image1.png)»,
# «<img src="placeholder_1.png" …/>», «![box](970,394,463,456)»
IMAGE_PLACEHOLDER = re.compile(r"!\[[^\]\n]*\]\([^)\n]*\)|<img\b[^>]*>|&lt;img\b.*?(?:/?&gt;|/?>)")


def drop_image_placeholders(value):
    return IMAGE_PLACEHOLDER.sub("", value or "")


def table_text_as_lines(text):
    """Блок ішіндегі markdown кесте («| 1. Платина | |⏎|---|---|⏎…») блокта
    кесте болып көрсетілмейді — әр жолы бөлек жол болады."""
    lines = (text or "").split("\n")
    if len([line for line in lines if is_table_row(line)]) < 2:
        return text
    result = []
    for line in lines:
        if not is_table_row(line):
            result.append(line)
            continue
        if re.fullmatch(r"[\s|:\-]+", line):
            continue
        cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
        cells = [cell for cell in cells if cell]
        if cells:
            result.append(" – ".join(cells))
    return "<br>".join(line.strip() for line in result if line.strip())


def group_body_blocks(body, origins=None):
    """Тану нәтижесінде кесте жолдары мен код жолдары бөлек абзац болып келеді —
    оларды бір кесте / бір код блогына жинаймыз.

    `origins` берілсе, оған әр нәтиже элементінің бастапқы body нөмірі
    жазылады: § соңы белгілері (mark_apparatus) бастапқы нөмірмен келеді."""
    # Абзац ішіне кірген код («…басыңдар:⏎```⏎>>> f = …⏎```») — мәтін мен кодқа бөлінеді
    split_body = []
    split_origin = []
    for raw_index, item in enumerate(body):
        item = item or ""
        if OPTIONS.get("dropImagePlaceholders"):
            item = drop_image_placeholders(item)
        if "```" in item and not item.lstrip().startswith("```"):
            pieces = [piece.strip() for piece in re.split(r"(```[\s\S]*?```)", item) if piece.strip()]
        elif not item.lstrip().startswith("```"):
            pieces = split_table_lines(item)
        else:
            pieces = [item]
        split_body.extend(pieces)
        split_origin.extend([raw_index] * len(pieces))
    # Шеткі «|» белгісі жоқ кесте жолдары («Cu⁰ – 2e → Cu⁺² | 1 | тотығу»):
    # бірдей бағанды қатар келген екі не одан көп жол — кесте
    bare = [bool(BARE_PIPE_ROW.fullmatch(item.strip())) for item in split_body]
    index = 0
    while index < len(split_body):
        if not bare[index]:
            index += 1
            continue
        end = index
        width = split_body[index].count("|")
        while end + 1 < len(split_body) and bare[end + 1] and split_body[end + 1].count("|") == width:
            end += 1
        if end > index:
            for position in range(index, end + 1):
                split_body[position] = "| %s |" % split_body[position].strip()
        index = end + 1
    body = [item if item.lstrip().startswith("```") else escape_unknown_tags(item) for item in split_body]
    result = []
    result_origin = []
    index = 0
    while index < len(body):
        item = (body[index] or "").strip()
        if is_table_row(item):
            cursor = index
            rows = []
            while cursor < len(body) and is_table_row(body[cursor]):
                rows.append(body[cursor].strip())
                cursor += 1
            if len(rows) >= 2:
                result.append("\n".join(rows))
                result_origin.append(split_origin[index])
                index = cursor
                continue
            # Жалғыз қалған кесте жолы — кесте емес: «| темір + оттек = … |»
            cells = [cell.strip() for cell in item.strip().strip("|").split("|")]
            cells = [cell for cell in cells if cell]
            if cells:
                result.append(" — ".join(cells))
                result_origin.append(split_origin[index])
                index += 1
                continue
        if not item.startswith("```") and looks_like_code(item):
            cursor = index + 1
            lines = [item]
            while cursor < len(body):
                following = (body[cursor] or "").strip()
                if following.startswith("```"):
                    break
                if looks_like_code(following) or (
                    console_output(following) and html_unescape(strip_tags(lines[-1])).lstrip().startswith(">>>")
                ):
                    lines.append(following)
                    cursor += 1
                    continue
                break
            if len(lines) >= 2 or PYTHON_HINT.search(html_unescape(strip_tags(item))):
                code = "\n".join(html_unescape(strip_tags(line.replace("<br>", "\n"))) for line in lines)
                result.append("```\n%s\n```" % code)
                result_origin.append(split_origin[index])
                index = cursor
                continue
        result.append(body[index])
        result_origin.append(split_origin[index])
        index += 1
    if origins is not None:
        origins[:] = result_origin
    return result


# § мәтінінің бірінші тармағы: «<b>1. Қазақ қолөнерінің бастаулары.</b>»
FIRST_POINT = re.compile(r"\s*<b>\s*1\.\s")

# Тест жауабының нұсқасы (латын не кирилл әрпі): «A) 1939 жылы», «С) алпыстан астам»
TEST_OPTION = re.compile(r"^\s*[A-EАВСЕ]\s*\)\s*\S")


def trusted_apparatus(page):
    """Беттегі § соңы белгілері. flash-lite белгілері негізгі мәтінді де
    қамтып кететіндіктен, оларға сенбейміз."""
    apparatus = page.get("apparatus")
    if not apparatus:
        return None
    model = apparatus.get("model") or ""
    # Информатикада тапсырма бөліктерінің белгісі айқын — flash-lite мұнда дұрыс
    # белгілейді (баптау: trustLiteApparatus)
    if not model or ("lite" in model and not OPTIONS.get("trustLiteApparatus")):
        return None
    return apparatus


def paragraph_bounds(number):
    """«§12-13.» → (12, 13), «7» → (7, 7), «4.3–4.4» → (403, 404). Сан болмаса None."""
    dotted = re.findall(r"(\d+)\.(\d+)", number or "")
    if dotted:
        keys = [int(major) * 100 + int(minor) for major, minor in dotted[:2]]
        return keys[0], keys[-1]
    values = [int(value) for value in re.findall(r"\d+", number or "")[:2]]
    if not values:
        return None
    return values[0], values[-1]


def is_inner_point(number, current_number):
    """«1», «2» — параграф ішіндегі тармақ нөмірі ме.

    Кітапта § нөмірлері үзіліссіз өседі (1-2, 3, 4-5 …). Сондықтан жаңа
    нөмір алдыңғы §-тен үлкен болмаса (не тым алыс секірсе — тану қатесі),
    бұл жаңа параграф емес, ішкі тармақ.
    """
    current = paragraph_bounds(current_number)
    new = paragraph_bounds(number)
    if current is None or new is None or current_number.startswith("summary-"):
        return False
    # Нүктелі нөмірде (1.4 → 2.1) бөлім ауысқанда нөмір 100-ге секіреді
    limit = 200 if re.search(r"\d\.\d", current_number) else 3
    return not (current[1] < new[0] <= current[1] + limit)


def build_outline_structure(config, topics):
    """Бөлім → тарау → § құрылымын кітаптың «Мазмұны» бетінен алады.

    `outline` — [{"title": бөлім, "chapters": [{"title": тарау, "page": бет}]}].
    Тақырып өзі басталған беттен бұрын басталған соңғы тарауға жатады.
    """
    # Мазмұнындағы бет нөмірі мен PDF бетінің айырмасы
    offset = config.get("pageOffset", 0)
    chapters = []
    for section in config["outline"]:
        for chapter in section["chapters"]:
            chapters.append((chapter["page"] + offset, section["title"], chapter["title"]))
    chapters.sort()

    sections = []
    for index, topic in enumerate(topics):
        owner = None
        for page, section_title, chapter_title in chapters:
            if page <= topic["page"]:
                owner = (section_title, chapter_title)
        if owner is None:
            owner = (chapters[0][1], chapters[0][2])
        section_title, chapter_title = owner
        if not sections or sections[-1]["title"] != section_title:
            sections.append({"title": section_title, "groups": []})
        groups = sections[-1]["groups"]
        if not groups or groups[-1]["title"] != chapter_title:
            groups.append({"title": chapter_title, "topics": []})
        groups[-1]["topics"].append(topic_title(topic, index))

    return {
        "bookTitle": config["bookTitle"],
        "subjectId": config["subjectId"],
        "sourceInfo": config["sourceInfo"],
        "theme": config.get("theme", "sky"),
        "sections": sections,
    }


def build_auto_structure(config, topics, detected_sections):
    """Бөлім атаулары мен параграф тақырыптарын OCR нәтижесінен жинайды."""
    groups = []
    for index, section in enumerate(detected_sections):
        start = section["firstTopic"]
        end = detected_sections[index + 1]["firstTopic"] if index + 1 < len(detected_sections) else len(topics)
        if end <= start:
            continue
        groups.append({"title": clean_section_title(section["title"]), "start": start, "end": end})

    # Бірінші бөлімге дейінгі тақырыптар да жоғалмауы керек
    if not groups or groups[0]["start"] > 0:
        groups.insert(0, {"title": "Кіріспе бөлім", "start": 0, "end": groups[0]["start"] if groups else len(topics)})
        if groups[0]["end"] <= 0:
            groups.pop(0)

    sections = []
    for group in groups:
        titles = [topic_title(topics[i], i) for i in range(group["start"], group["end"])]
        sections.append(
            {
                "title": group["title"],
                "groups": [{"title": group["title"], "topics": titles}],
            }
        )

    return {
        "bookTitle": config["bookTitle"],
        "subjectId": config["subjectId"],
        "sourceInfo": config["sourceInfo"],
        "theme": config.get("theme", "sky"),
        "sections": sections,
    }


# Сөзбен жазылған реттік сандар: «екінші БӨЛІМ» деген атаулар үшін
ORDINALS = (
    "бірінші", "екінші", "үшінші", "төртінші", "бесінші",
    "алтыншы", "жетінші", "сегізінші", "тоғызыншы", "оныншы",
)


def clean_section_title(value):
    value = re.sub(r"\s+", " ", (value or "").strip())

    # «Екінші БӨЛІМ» немесе «II бөлім» — атауы жоқ, тек реттік сан
    bare = re.fullmatch(
        r"([IVX]+|\d+|%s)\s*[-\s]*(бөлім|тарау)\s*[.:-]*" % "|".join(ORDINALS),
        value,
        flags=re.IGNORECASE,
    )
    if bare:
        head = bare.group(1).strip().lower()
        kind = bare.group(2).lower()
        return "%s %s" % (head.capitalize(), kind)

    value = re.sub(
        r"^([IVX]+|\d+|%s)\s*[-\s]*(бөлім|тарау)\s*[.\-–—:]*\s*" % "|".join(ORDINALS),
        "",
        value,
        flags=re.IGNORECASE,
    )
    value = re.sub(r"\s+", " ", value).strip(" .-–—:")
    if value.isupper():
        value = value.capitalize()
    return value or "Бөлім"


# Сөйлем соңындағы 2-жақ көпше бұйрық рай: тапсырманың нақты белгісі.
# «заңдар», «өлеңдер» сияқты зат есімдер бұған кірмеуі керек.
SENTENCE_IMPERATIVE = re.compile(
    r"([а-яәғқңөұүіһ]+(?:ыңдар|іңдер|ыңыздар|іңіздер|ңдар|ңдер))\s*[.!]",
    re.IGNORECASE,
)

NOT_IMPERATIVE = {
    "заңдар", "өлеңдер", "аңдар", "теңдер", "таңдар", "шаңдар",
    "соңдар", "жаңдар", "маңдар", "күңдер",
}


# «қарастырдыңдар» (өткен шақ), «көресіңдер», «барасыңдар» (осы шақ) — бұйрық емес.
# «айтыңдар» (бұйрық) мен «таныстыңдар» (өткен шақ) жалғауы бірдей, сондықтан
# тек анық формалар ғана шығарылады.
NOT_IMPERATIVE_ENDING = re.compile(r"(д[ыі]ң(дар|дер)|[йи]с[ыі]ң(дар|дер)|д[ыі]ң[ыі]з(дар|дер)?)$", re.IGNORECASE)
# «барасыңдар», «көресіңдер» (осы шақ) пен «басыңдар» (бұйрық: бас+ыңдар) жалғауы
# бірдей — осы шақ формасы ұзынырақ болады
PRESENT_TENSE = re.compile(r"[аеі]с[ыі]ң(дар|дер)$", re.IGNORECASE)


def is_imperative_word(word):
    lowered = (word or "").lower()
    if lowered in NOT_IMPERATIVE or NOT_IMPERATIVE_ENDING.search(lowered):
        return False
    if PRESENT_TENSE.search(lowered) and len(lowered) >= 9:
        return False
    return bool(IMPERATIVE_SUFFIX.search(lowered))


def drop_quotes(value):
    """Дәйексөздің ішін алып тастайды — ондағы бұйрық сөз автордың нұсқауы емес."""
    return QUOTED_SPAN.sub(" ", value or "")


def drop_asides(value):
    """Дәйексөз мен жақша ішіндегі қосымша нұсқауды алып тастайды.

    «…ғұн тайпалары бастады. (Ғұндар туралы білгендеріңді еске түсіріңдер).»
    — абзацтың өзі баяндау мәтіні, жақшадағы нұсқау оны тапсырма қылмайды.
    """
    return BRACKETED.sub(" ", drop_quotes(value))


def ends_inside_quote(value):
    """Абзац дәйексөзбен бітеді ме: «...қатынас жаса». — бұл тапсырма емес."""
    tail = re.sub(r"[\s.!?…]+$", "", (value or "").rstrip())
    return tail.endswith(QUOTE_CLOSE)


def has_task_sentence(value):
    """Мәтінде бұйрық райда бітетін сөйлем бар ма."""
    for match in SENTENCE_IMPERATIVE.finditer(drop_asides(value)):
        if is_imperative_word(match.group(1)):
            return True
    return False


def is_task_text(value):
    """Мәтін тапсырма ма (сурет қолтаңбасында да, блокта да кездеседі)."""
    plain = (value or "").strip()
    if not plain:
        return False

    lowered = plain.lower()
    if TASK_START.search(plain) or re.search(r"\d\s*[-–—.]?\s*тапсырма", lowered):
        return True
    if any(lowered.startswith(marker) for marker in TASK_LABELS):
        return True
    if not ends_inside_quote(plain):
        if is_imperative_word(last_word(plain)):
            return True
        if last_word(plain) in IMPERATIVE_TAIL:
            return True
    if plain.endswith("?") and len(plain) < 300:
        return True

    # Нұсқаулық: сөйлемі бұйрық райда бітеді
    return has_task_sentence(plain)


def is_broken_title(value):
    """Тану кезінде бүлінген атау ма (басы не аяғы кесілген)."""
    if not value:
        return True
    # Бір сөзден тұратын қысқа атау («ХЛОР», «АММИАК», «Мұнай») — бүтін атау
    if re.fullmatch(r"[A-ZА-ЯЁӘҒҚҢӨҰҮҺІ][A-Za-zА-Яа-яЁёӘәҒғҚқҢңӨөҰұҮүҺһІі]{2,}", value.strip()):
        return False
    if len(value) < 8:
        return True
    # Сөйлемнің ортасынан басталған үзінді
    if value[0] in "-–—,;:)" or value[0].islower():
        return True
    if value.rstrip().endswith(("-", "–", "—", ",")):
        return True
    # Әріптен гөрі сан мен белгі көп болса, бұл атау емес
    letters = sum(1 for ch in value if ch.isalpha())
    return letters < len(value) * 0.55


def lead_title(topic):
    """Мәтіннің басындағы қалың қаріпті тақырыпшадан атау алады."""
    for part in topic.get("parts") or []:
        if part.get("type") != "body":
            continue
        match = re.match(r"\s*<b>(.{8,90}?)</b>", part.get("html") or "")
        if match:
            return strip_tags(match.group(1)).strip(" .:")
        break
    return ""


# Кирилл әрпіне ұқсас латын бас әріптері
LATIN_LOOKALIKE = {"A": "А", "B": "В", "C": "С", "E": "Е", "H": "Н", "K": "К", "M": "М", "O": "О", "P": "Р", "T": "Т", "X": "Х", "Y": "У"}


def topic_title(topic, index):
    title = (topic.get("title") or "").strip()
    title = re.sub(r"^§+\s*[\d\-–—]+\s*[.:]?\s*", "", title)
    title = re.sub(r"\s+", " ", title).strip(" .")
    # Атау екі жолға сыйып, тасымалмен бөлінуі мүмкін («жануарлар- дың») — 3-талап
    title = join_hyphenated(title)

    # Бүлінген атаудың орнына мәтіннің өз тақырыпшасын аламыз
    if is_broken_title(title):
        fallback = lead_title(topic)
        if fallback and not is_broken_title(fallback):
            title = fallback
        elif is_broken_title(title):
            title = ""

    if title.isupper():
        # Тек кирилл әріптері кішірейеді: «14 (IVA) ТОП ЭЛЕМЕНТТЕРІ» →
        # «14 (IVA) топ элементтері», ал «(iva)» болып кетпейді
        letters = list(title)
        cyrillic = lambda value: bool(value) and 0x400 <= ord(value) <= 0x4FF
        first = True
        for position, char in enumerate(letters):
            if not char.isalpha():
                continue
            # Кирилл сөздің ішіне кірген латын әрпі («АДЕНOЗИН») — кириллге айналады
            neighbours = (title[position - 1] if position else "") + (title[position + 1] if position + 1 < len(title) else "")
            if char in LATIN_LOOKALIKE and any(cyrillic(value) for value in neighbours):
                char = LATIN_LOOKALIKE[char]
            if first:
                letters[position] = char.upper()
                first = False
            elif cyrillic(char):
                letters[position] = char.lower()
            else:
                letters[position] = char
        title = "".join(letters)
        # «IV БӨЛІМ …» → «Iv бөлім» болмауы керек: рим цифры бас әріппен қалады
        # (кирилл «І» латын «I»-ге ауысады)
        title = re.sub(
            r"^([ivxlcі]+)(?=\s)",
            lambda match: match.group(1).upper().replace("І", "I"),
            title,
            flags=re.IGNORECASE,
        )
    return title or ("%s-тақырып" % (index + 1))


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    config = json.loads(io.open(sys.argv[1], encoding="utf-8").read())
    structure = {}
    if config.get("structurePath"):
        structure = json.loads(io.open(config["structurePath"], encoding="utf-8").read())

    slug = config["slug"]
    # Векторлық PDF суреттері тікелей салынады (сканға арналған тазалаусыз)
    import figure_crop

    figure_crop.DIRECT_RENDER = bool(config.get("vectorPdf"))
    # Сызба бөліктерін біріктіру (информатика) — тарихта қатар тұрған
    # портреттер бір суретке бірігіп кетпеуі үшін тек баптаумен қосылады
    OPTIONS["mergeFigureParts"] = bool(config.get("mergeFigureParts"))
    OPTIONS["noMergePages"] = set(config.get("noMergePages") or [])
    OPTIONS["trustLiteApparatus"] = bool(config.get("trustLiteApparatus"))
    OPTIONS["watermarkImageSize"] = config.get("watermarkImageSize")
    OPTIONS["useFigureBoxes"] = bool(config.get("useFigureBoxes"))
    OPTIONS["convertLatex"] = bool(config.get("convertLatex"))
    OPTIONS["formulaCode"] = bool(config.get("formulaCode"))
    OPTIONS["dropImagePlaceholders"] = bool(config.get("dropImagePlaceholders"))
    OPTIONS["tableFigures"] = config.get("tableFigures") or {}
    OPTIONS["dropFigures"] = config.get("dropFigures") or {}
    OPTIONS["extraFigures"] = config.get("extraFigures") or {}
    OPTIONS["dropBody"] = config.get("dropBody") or {}
    OPTIONS["pageKinds"] = config.get("pageKinds") or {}
    OPTIONS["textReplace"] = config.get("textReplace") or {}
    OPTIONS["figureAfter"] = config.get("figureAfter") or {}
    figure_crop.TIGHT_CROP = bool(config.get("useFigureBoxes"))
    figure_crop.EDGE_TEXT = config.get("stripEdgeText")
    figure_crop.EXACT_PAGES = set(config.get("exactFigurePages") or [])
    figure_crop.NO_STRIP_PAGES = set(config.get("noEdgeStripPages") or [])
    image_root = os.path.join(config["publicRoot"], slug)
    if os.path.isdir(image_root):
        shutil.rmtree(image_root)
    os.makedirs(image_root, exist_ok=True)

    pages = load_pages(config["jsonDir"], config["firstPage"], config["lastPage"])
    # Бет кескінімен тексерілген § нөмірі (танылғаны қате болса: «§32» → «82»)
    overrides = config.get("numberOverrides") or {}
    for page in pages:
        if str(page["page"]) in overrides:
            page["paragraphNumber"] = overrides[str(page["page"])]

    # Кітапқа тән жүйелі тану қатесі (кескінмен тексерілген): «пісімдеу» → «пішімдеу»
    corrections = config.get("textCorrections") or {}
    if corrections:
        def correct(value):
            if isinstance(value, str):
                for wrong, right in corrections.items():
                    value = value.replace(wrong, right).replace(wrong.capitalize(), right.capitalize())
                return value
            if isinstance(value, list):
                return [correct(item) for item in value]
            if isinstance(value, dict):
                return {key: correct(item) for key, item in value.items()}
            return value

        pages = [correct(page) for page in pages]
    topics, detected_sections = build_topics(
        pages, config["pdf"], slug, image_root, config["publicPrefix"],
        skip_task_residue=config.get("skipTaskResidue", False),
    )

    # Тапсырмалары алынған соң мазмұны қалмаған тақырып (тек практикалық
    # жұмыс не тесттен тұратын) кітапқа бос бет болып кірмейді
    min_chars = config.get("minTopicChars")
    if min_chars:
        kept = []
        for topic in topics:
            size = sum(
                len(strip_tags(part.get("html") or part.get("text") or ""))
                for part in topic["parts"]
                if part["type"] in ("body", "code", "table", "note")
            )
            if size < min_chars:
                print("мазмұнсыз тақырып алынды: §%s %s (%d таңба)" % (topic["number"], topic["title"][:50], size))
                for part in topic["parts"]:
                    if part["type"] == "figure":
                        remove_image(image_root, part["file"])
                continue
            kept.append(topic)
        topics = kept

    if config.get("outline"):
        book = build_outline_structure(config, topics)
    elif config.get("structureMode") == "auto":
        book = build_auto_structure(config, topics, detected_sections)
    else:
        book = structure[slug]

    planned = [
        (section["title"], group["title"], title)
        for section in book["sections"]
        for group in section["groups"]
        for title in group["topics"]
    ]

    print("from pdf: %d topics, in structure: %d" % (len(topics), len(planned)))
    expected = config.get("expectedTopics")
    if expected and expected != len(topics):
        for index, topic in enumerate(topics):
            print("  %2d §%-8s p%-4d %s" % (index + 1, topic["number"], topic["page"], topic["title"][:60]))
        raise SystemExit("мазмұнында %d тақырып, құрастырылғаны %d" % (expected, len(topics)))
    if len(planned) != len(topics) and config.get("structureMode") != "auto":
        for index, topic in enumerate(topics):
            print("  %2d §%-8s %s" % (index + 1, topic["number"], topic["title"][:60]))
        raise SystemExit("topic count mismatch")

    book_entry = {
        "slug": slug,
        "title": book["bookTitle"],
        "subjectId": book["subjectId"],
        "sourceInfo": book["sourceInfo"],
        "theme": book["theme"],
        "sections": [],
    }

    cursor = 0
    for section in book["sections"]:
        section_entry = {"title": section["title"], "groups": []}
        for group in section["groups"]:
            group_entry = {"title": group["title"], "topics": []}
            for title in group["topics"]:
                topic = topics[cursor]
                cursor += 1
                group_entry["topics"].append(
                    {
                        "title": title,
                        "excerpt": build_excerpt(topic),
                        "pdfPage": topic["page"],
                        "content": build_content(topic, title),
                    }
                )
            section_entry["groups"].append(group_entry)
        book_entry["sections"].append(section_entry)

    existing = []
    if os.path.exists(config["payloadPath"]):
        existing = json.loads(io.open(config["payloadPath"], encoding="utf-8").read())
        existing = [item for item in existing if item["slug"] != slug]

    io.open(config["payloadPath"], "w", encoding="utf-8").write(
        json.dumps(existing + [book_entry], ensure_ascii=False)
    )

    chars = sum(
        len(topic["content"])
        for section in book_entry["sections"]
        for group in section["groups"]
        for topic in group["topics"]
    )
    print("%s: topics=%d chars=%d" % (slug, len(planned), chars))


if __name__ == "__main__":
    main()
