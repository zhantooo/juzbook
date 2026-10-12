"""Атамұра оқулықтарын сайтқа дайындау.

PDF-тегі мәтін қаріп түрі мен өлшемі бойынша нақты ажыратылады:
  * SchoolBookKza, 11 pt      — параграфтың негізгі мәтіні
  * SchoolBookKza, 9 pt       — сурет асты жазуы және сызба белгілері
  * SchoolBookKza, 9.5–10 pt  — параграф соңындағы тест/тапсырмалар (алынып тасталады)
  * SegoeUI, 9.5 pt           — шет жақтағы блоктар (сұрақ немесе ескертпе)
  * Arial                     — колонтитул (алынып тасталады)

Суреттер мен сызбалар бет ішіндегі аймақ ретінде растрланады — сол себепті
карта мен сызбадағы жазулар суретпен бірге сақталады.
"""

import io
import json
import os
import re
import subprocess
import sys

import fitz
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import figure_crop
import figure_orientation
from build_ocr_payload import heal_split_paragraphs, join_hyphenated

BODY_FONT = "SchoolBookKza"
SIDE_FONT = "SegoeUI"
FOOTER_FONT = "Arial"

# Қаріп өлшемінің шектері (pt). Әдепкі мән — негізгі мәтіні 11 pt кітап.
# Басқа макетте баптаудан өзгереді: Атамұра 8-сынып химиясында негізгі мәтін
# 10,5 pt, сондықтан `bodyMinSize: 10.2`.
LAYOUT = {"body_min": 10.6, "caption_max": 9.3, "heading_min": 10.4}

# Кейбір PDF кириллица әріптерінің бір бөлігін cp1251 коды бойынша Latin-1
# таңбасы етіп сақтаған («Қàíдàуыðìеí» = «Қандауырмен»). Баптауда
# `cp1251Latin: true` болса, мұндай әріп қайта оқылады. Нағыз латын әрпі
# (Na, Cl — ASCII) мен қазақ әріптері өзгермейді.
CP1251_LATIN = {"enabled": False}


def decode_cp1251_latin(text):
    return "".join(
        bytes([ord(ch)]).decode("cp1251") if 0xC0 <= ord(ch) <= 0xFF and ch.isalpha() else ch
        for ch in text
    )


def page_dict(page):
    """page.get_text("dict"), қажет болса бұзық кодталуы түзетілген."""
    data = page.get_text("dict")
    if CP1251_LATIN["enabled"]:
        for block in data["blocks"]:
            for line in block.get("lines", []):
                for span in line["spans"]:
                    span["text"] = decode_cp1251_latin(span["text"])
    return data

# Сұрақ пен тапсырманы танытатын белгілер (қазақ тіліндегі бұйрық рай)
TASK_PATTERNS = [
    r"\?",
    r"[а-яәғқңөұүіһa-z]ңдар\b",
    r"[а-яәғқңөұүіһa-z]ңдер\b",
    r"[а-яәғқңөұүіһa-z]ңыз\b",
    r"[а-яәғқңөұүіһa-z]ңіз\b",
    r"\bболасыңдар\b",
    r"\bбілесіңдер\b",
    r"\bтүсінесіңдер\b",
    r"\bтанысасыңдар\b",
    r"\bаласыңдар\b",
    r"\bжасайсыңдар\b",
    r"\bанықтайсыңдар\b",
]
TASK_RE = re.compile("|".join(TASK_PATTERNS), re.IGNORECASE)

TASK_HEADINGS = re.compile(
    r"(тест тапсырмалар|сұрақтар мен тапсырмалар|тәжiрибелiк тапсырма|тәжірибелік тапсырма|"
    r"қайталау-жинақтау|тақырыпты оқу барысында)",
    re.IGNORECASE,
)

# Параграф нөмірінің белгісі: §1. немесе §19–20.
TOPIC_MARK = re.compile(r"\u00a7\s*\d")

SENTENCE_END = re.compile(r"[.!?:»…]\s*$")

# Тарау соңындағы қайталау-жинақтау сабағының тақырыбы
REVISION_HEADING = re.compile(r"(бойынша|ҚАЙТАЛАУ|Қайталау)", re.IGNORECASE)

# Тарау/бөлім соңындағы қайталау сабағының басталуы — одан кейінгісі параграфқа кірмейді
REVISION_START = re.compile(
    r"(ҚАЙТАЛАУ-ЖИНАҚТАУ|қайталау-жинақтау|бөлімге қорытынды|бөлімді қайталау|бөлімге шолу)",
    re.IGNORECASE,
)

# Параграф басындағы оқу мақсаттары — теориялық материал емес
OBJECTIVES = re.compile(
    r"(Тақырыпты оқу барысында|Кіріспені оқу барысында|Бүгінгі сабағымызда|Тірек сөздер"
    r"|Тақырыпта мыналар қарастырылады)",
    re.IGNORECASE,
)

# Мағынасыз жазулар: баспа коды, бет нөмірі сияқты
MEANINGLESS_CAPTION = re.compile(r"^[\d\s\u2013\u2014.\-*]+$")


# § соңындағы тапсырма рубрикалары (Атамұра биология оқулықтары Блум
# таксономиясының атауларын қолданады). Осыдан бастап параграф аяқталады.
RUBRIC_START = re.compile(
    r"^(Білу және түсіну|Қолданылуы|Қолдану|Талдау|Синтез|Жинақтау|Бағалау|Пікірталас)\s*[:.]",
    re.IGNORECASE,
)

# Тапсырма блогы сурет болып түскенде — қиындыдағы жазудан танылады
TASK_FIGURE_RE = re.compile(
    r"(білу және түсіну|қолданылуы\s*[:.]|талдау\s*[:.]|синтез\s*[:.]|бағалау\s*[:.]|"
    r"жинақтау\s*[:.]|пікірталас|кестені толтыр|тапсырма|сұрақтар)",
    re.IGNORECASE,
)


def is_key_terms(html, text):
    """§ соңындағы тірек сөздер тізімі бе (11-талап: ол алынып тасталады).

    Мұндай абзац түгелдей көлбеу жазылады, үтірмен бөлінген терминдерден
    тұрады және бір ғана нүктемен бітеді — сөйлем емес.
    """
    body = html.strip()
    tight = len(re.findall(r",\S", text)) >= 2
    if not (body.startswith("<i>") and body.endswith("</i>")):
        # Тізімнің келесі бетке түскен жалғасы көлбеу белгісінсіз қалуы мүмкін:
        # онда үтірден кейін бос орын қойылмайтыны (теріліп қалғаны) танытады
        if not (tight and text.count(",") >= 3 and text.count(".") <= 1):
            return False
    if len(text) < 40 or text.count(",") < 4:
        return len(text) >= 20 and tight and text.count(",") >= 3
    return text.count(".") <= 1 and "?" not in text and "!" not in text


# Сурет асты жазуындағы белгілер: «а – жабайы түрі; ә – мәдени түрі»
LEGEND = re.compile(r"(^|[;.]\s*)[а-яәғқңөұүһі\d]{1,3}\s*[–—-]\s", re.IGNORECASE)


def is_caption_fragment(text):
    """Сурет асты жазуының мәтінге кіріп кеткен бөлігі ме (13, 17б-талап).

    Мұндай үзінді қысқа әрі сөйлеммен бітпейді («бүршікше сабақша тамырша»),
    не суреттегі белгілерді тізеді («1 – лейкоцит; 3 – тромбоциттер»). Ол
    абзац болып қалса, негізгі мәтіннің сөйлемі ортасынан үзіледі.
    """
    body = text.strip()
    if not body or len(body) > 90:
        return False
    if len(LEGEND.findall(body)) >= 2:
        return True
    if len(body) < 45 and not re.search(r"[.!?]$", body):
        return True
    # «жапырақтылар, жабықтұқымдылар.» — атаулардың жалғасы, сөйлем емес
    return len(body) < 45 and body[:1].islower() and " " not in body.rstrip(".")


def figure_text(path, tess):
    """Суреттегі жазуды Tesseract арқылы оқиды (тапсырма блогын тану үшін)."""
    env = dict(os.environ, TESSDATA_PREFIX=tess["tessdata"])
    try:
        result = subprocess.run(
            [tess["binary"], path, "stdout", "-l", "kaz", "--psm", "6"],
            capture_output=True,
            env=env,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=180,
        )
    except Exception:
        return ""
    return result.stdout or ""


def drop_task_figures(topics, image_dir, tess):
    """Тапсырма блогы сурет болып түссе, одан бастап § соңы алынып тасталады.

    Атамұра биологиясында § соңындағы тапсырмалар боялған тақтада тұрады да,
    қиынды ретінде түсіп қалады (12а-талап). Мұндай сурет тақырыптың соңғы
    бөлігінде ғана кездеседі, сондықтан одан кейінгісі де қосымша бөлік.
    """
    dropped = 0
    for topic in topics:
        cut = None
        for index, part in enumerate(topic["parts"]):
            if part["type"] != "figure":
                continue
            if TASK_FIGURE_RE.search(figure_text(os.path.join(image_dir, part["file"]), tess)):
                cut = index
                break
        if cut is None:
            continue
        for part in topic["parts"][cut:]:
            if part["type"] == "figure":
                path = os.path.join(image_dir, part["file"])
                if os.path.exists(path):
                    os.remove(path)
                dropped += 1
        topic["parts"] = topic["parts"][:cut]
    return dropped


def span_html(span):
    """Бір үзіндіні қалың/көлбеу пішімін сақтап HTML-ге айналдырады."""
    text = span["text"]
    if not text:
        return ""

    text = (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )

    font = span["font"]
    if "Bold" in font and "Italic" in font:
        return "<b><i>%s</i></b>" % text
    if "Bold" in font:
        return "<b>%s</b>" % text
    if "Italic" in font:
        return "<i>%s</i>" % text
    return text


def block_info(block):
    spans = [s for line in block["lines"] for s in line["spans"]]
    if not spans:
        return None

    plain_lines = ["".join(s["text"] for s in line["spans"]) for line in block["lines"]]
    html_lines = ["".join(span_html(s) for s in line["spans"]) for line in block["lines"]]

    fonts = {s["font"] for s in spans}
    family = "other"
    if any(f.startswith(BODY_FONT) for f in fonts):
        family = BODY_FONT
    elif any(f.startswith(SIDE_FONT) for f in fonts):
        family = SIDE_FONT
    elif any(f.startswith(FOOTER_FONT) for f in fonts):
        family = FOOTER_FONT

    return {
        "text": "\n".join(plain_lines),
        "html": "\n".join(html_lines),
        # Азат жолды табу үшін әр жолдың сол жақ шеті керек
        "lines": [
            {"x0": round(line["bbox"][0], 1), "text": plain_lines[index], "html": html_lines[index]}
            for index, line in enumerate(block["lines"])
        ],
        "family": family,
        # Тік (бүйірінен басылған) мәтін — карта не сызбаның атауы, негізгі мәтін емес
        "vertical": sum(1 for line in block["lines"] if abs(line.get("dir", (1, 0))[0]) < 0.5)
        > len(block["lines"]) / 2,
        "size": max(round(s["size"], 1) for s in spans),
        "bold": all("Bold" in s["font"] for s in spans),
        "italic": all("Italic" in s["font"] for s in spans),
        "bbox": tuple(block["bbox"]),
    }


# Азат жолдың шегінісі осы аралықта болуы керек: кішісі — қате өлшем,
# үлкені — ортаға тураланған тақырып не бөлек баған
INDENT_MIN_PT = 8.0
INDENT_MAX_PT = 45.0


def body_left_margin(infos):
    """Беттегі негізгі мәтіннің сол жақ шетін табады.

    Абзацтың бірінші жолы шегініспен басталатындықтан, ең жиі кездесетін
    сол жақ шет — абзацтың қалған жолдарының шеті болады.
    """
    counts = {}
    for info in infos:
        for line in info.get("lines") or []:
            if not line["text"].strip():
                continue
            key = round(line["x0"] / 2.0) * 2.0
            counts[key] = counts.get(key, 0) + 1

    if not counts:
        return None

    return max(counts, key=lambda key: (counts[key], -key))


def split_paragraphs(info, page_margin):
    """Блокты азат жолдар бойынша абзацтарға бөледі.

    Суреттің жанындағы мәтін блогының сол жақ шеті беттің жалпы шетінен
    бөлек болады, сондықтан үш жолдан ұзын блоктың шетін оның өз жолдары
    бойынша анықтаймыз — әйтпесе әр жол жеке абзац болып кетеді.
    """
    lines = [line for line in (info.get("lines") or []) if line["text"].strip()]
    if not lines:
        return []

    if len(lines) >= 3:
        counts = {}
        for line in lines:
            key = round(line["x0"] / 2.0) * 2.0
            counts[key] = counts.get(key, 0) + 1
        margin = max(counts, key=lambda key: (counts[key], -key))
    elif page_margin is not None:
        margin = page_margin
    else:
        margin = min(line["x0"] for line in lines)

    # Қорғаныс: жолдардың басым бөлігі «азат жол» болып шықса, шет қате
    # табылған. Ондайда блок біртұтас абзац болып қалады.
    marked = sum(1 for line in lines if INDENT_MIN_PT < line["x0"] - margin < INDENT_MAX_PT)
    if len(lines) >= 3 and marked > len(lines) * 0.55:
        margin = min(line["x0"] for line in lines)

    marked = sum(1 for line in lines if INDENT_MIN_PT < line["x0"] - margin < INDENT_MAX_PT)
    trust_indent = not (len(lines) >= 3 and marked > len(lines) * 0.55)

    paragraphs = []
    for line in lines:
        shift = line["x0"] - margin
        starts_new = trust_indent and INDENT_MIN_PT < shift < INDENT_MAX_PT
        if starts_new or not paragraphs:
            paragraphs.append({"lines": [line], "indent": starts_new})
        else:
            paragraphs[-1]["lines"].append(line)

    result = []
    for paragraph in paragraphs:
        result.append(
            {
                "text": "\n".join(line["text"] for line in paragraph["lines"]),
                "html": "\n".join(line["html"] for line in paragraph["lines"]),
                "indent": paragraph["indent"],
            }
        )

    return result


SOFT_HYPHEN = "­"


def dehyphenate(value):
    """Жол соңындағы тасымалды біріктіреді, қалған жол ауысуын бос орынға айналдырады.

    Кітапта жұмсақ тасымал таңбасы (U+00AD) екі мағынада кездеседі:
      * жол соңында бос орынсыз тұрса — сөз сол жерден бөлінген (біріктіреміз);
      * артынан бос орын келсе — сөз аяқталған, таңба тек ықтимал тасымал нүктесі.
    """
    # Кәдімгі сызықшамен жасалған тасымал: "Маньчжу- \nриядан"
    value = re.sub(r"(\w)-[ \t]*\n[ \t]*(?=[а-яәғқңөұүіһa-z])", r"\1", value)
    # Жұмсақ тасымал жол соңында, бос орынсыз: "қа\u00ad\nлың"
    value = re.sub(SOFT_HYPHEN + r"\n[ \t]*", "", value)
    # Жұмсақ тасымал + бос орын + жол ауысуы, ал келесі жол қысқа бөлшектен
    # басталса ("Омб\u00ad ы,") — бұл да тасымал, сөз біріктіріледі
    value = re.sub(
        SOFT_HYPHEN + r"[ \t]*\n[ \t]*(?=[а-яәғқңөұүіһa-z]{1,3}[,.;:!?\s])",
        "",
        value,
    )
    # Жұмсақ тасымал + бос орын: сөз аяқталған, бос орын сақталады
    value = re.sub(SOFT_HYPHEN + r"[ \t]+\n?[ \t]*", " ", value)
    value = value.replace(SOFT_HYPHEN, "")
    value = value.replace("\n", " ")
    return re.sub(r"[ \t]+", " ", value)


def clean_text(value):
    return dehyphenate(value).strip()


def clean_html(value):
    value = dehyphenate(value)
    # Тек бос орыннан тұратын пішім тегтерін тазалаймыз
    for tag in ("b", "i"):
        value = re.sub(r"<%s>(\s*)</%s>" % (tag, tag), r"\1", value)
        value = re.sub(r"</%s>(\s*)<%s>" % (tag, tag), r"\1", value)
    value = re.sub(r"\s+", " ", value)
    return value.strip()


def rects_touch(a, b, pad=6.0):
    return not (
        a[2] + pad < b[0] or b[2] + pad < a[0] or a[3] + pad < b[1] or b[3] + pad < a[1]
    )


def rects_stacked(a, b, gap=22.0, overlap_ratio=0.3):
    """Бір-бірінің астында тұрған, көлденеңінен қабысатын аймақтар (сызба бөліктері)."""
    left = max(a[0], b[0])
    right = min(a[2], b[2])
    if right - left <= 0:
        return False

    narrow = min(a[2] - a[0], b[2] - b[0])
    if narrow <= 0 or (right - left) / narrow < overlap_ratio:
        return False

    vertical_gap = max(a[1] - b[3], b[1] - a[3])
    return vertical_gap <= gap


def figures_join(a, b):
    return rects_touch(a, b) or rects_stacked(a, b)


def merge_rect(a, b):
    return (min(a[0], b[0]), min(a[1], b[1]), max(a[2], b[2]), max(a[3], b[3]))


def rect_contains(outer, inner, pad=3.0):
    return (
        inner[0] >= outer[0] - pad
        and inner[1] >= outer[1] - pad
        and inner[2] <= outer[2] + pad
        and inner[3] <= outer[3] + pad
    )


def collect_figures(page, page_rect, texts):
    """Нағыз суреттер мен сызбалардың аймақтарын анықтайды."""
    width, height = page_rect[2], page_rect[3]
    raw_images = [tuple(b["bbox"]) for b in page_dict(page)["blocks"] if b["type"] == 1]

    candidates = []
    for rect in raw_images:
        w, h = rect[2] - rect[0], rect[3] - rect[1]
        if w < 55 or h < 45:
            continue
        if rect[1] > height - 60 or rect[3] < 20:
            continue
        if rect[0] < 5 and rect[1] < 5 and w < 130:
            continue
        if w > width * 0.97 and h > height * 0.9:
            continue

        inside = [t for t in texts if rect_contains(rect, t["bbox"], pad=4)]
        # Шеткі блоктың фоны немесе мәтін астындағы түсті тақта — сурет емес
        if inside and all(t["family"] == SIDE_FONT for t in inside):
            continue
        if any(t["family"] == BODY_FONT and t["size"] >= LAYOUT["body_min"] for t in inside):
            continue

        candidates.append(rect)

    # Сызбалар вектор графикамен салынған: 9 pt белгілері бар аймақтарды жинаймыз
    drawings = []
    for item in page.get_drawings():
        r = item["rect"]
        rect = (r.x0, r.y0, r.x1, r.y1)
        if rect[0] < 0 or rect[2] > width + 1:
            continue
        if rect[1] > height - 70:
            continue
        if (rect[2] - rect[0]) < 3 and (rect[3] - rect[1]) < 3:
            continue
        drawings.append(rect)

    small_texts = [t for t in texts if t["family"] == BODY_FONT and t["size"] < LAYOUT["body_min"]]
    scheme_rects = []
    for t in small_texts:
        touching = [
            d
            for d in drawings
            if rects_touch(d, t["bbox"], pad=10)
            and (d[2] - d[0]) * (d[3] - d[1]) > 400
        ]
        if not touching:
            continue
        rect = t["bbox"]
        for d in touching:
            rect = merge_rect(rect, d)
        scheme_rects.append(rect)

    figures = candidates + scheme_rects

    # Қабысатын аймақтарды біріктіреміз
    merged = []
    for rect in sorted(figures, key=lambda r: (r[1], r[0])):
        placed = False
        for i, existing in enumerate(merged):
            if figures_join(existing, rect):
                merged[i] = merge_rect(existing, rect)
                placed = True
                break
        if not placed:
            merged.append(rect)

    changed = True
    while changed:
        changed = False
        for i in range(len(merged)):
            for j in range(i + 1, len(merged)):
                if figures_join(merged[i], merged[j]):
                    merged[i] = merge_rect(merged[i], merged[j])
                    del merged[j]
                    changed = True
                    break
            if changed:
                break

    # Біріккеннен кейін негізгі мәтінді жұтып қойған аймақтарды алып тастаймыз
    final = []
    for rect in merged:
        inside = [t for t in texts if rect_contains(rect, t["bbox"], pad=4)]
        if any(t["family"] == BODY_FONT and t["size"] >= LAYOUT["body_min"] for t in inside):
            continue
        if inside and all(t["family"] == SIDE_FONT for t in inside):
            continue
        final.append(rect)

    return final


def horizontal_overlap_ratio(a, b):
    left = max(a[0], b[0])
    right = min(a[2], b[2])
    if right <= left:
        return 0.0
    narrow = min(a[2] - a[0], b[2] - b[0])
    return (right - left) / narrow if narrow > 0 else 0.0


def vertical_overlap_ratio(a, b):
    top = max(a[1], b[1])
    bottom = min(a[3], b[3])
    if bottom <= top:
        return 0.0
    short = min(a[3] - a[1], b[3] - b[1])
    return (bottom - top) / short if short > 0 else 0.0


def attach_captions(figures, caption_infos):
    """Әр сурет жазуын өз суретімен байланыстырады.

    Жазу әдетте суреттің дәл астында тұрады; кейде үстінде де кездеседі.
    Байланыс блоктардың реті бойынша емес, орналасуы бойынша жасалады —
    сондықтан жазу мәтіннің ортасына түсіп қалмайды.
    """
    used = set()
    attached = {}

    for index, info in enumerate(caption_infos):
        bbox = info["bbox"]
        best = None
        best_gap = None

        for figure_index, rect in enumerate(figures):
            if horizontal_overlap_ratio(rect, bbox) < 0.15:
                # Жазу суреттің бүйірінде тұруы мүмкін (тік бойынша қабысады)
                if vertical_overlap_ratio(rect, bbox) >= 0.15:
                    side_gap = max(bbox[0] - rect[2], rect[0] - bbox[2])
                    if 0 <= side_gap <= 26:
                        if best_gap is None or side_gap + 300 < best_gap:
                            best_gap = side_gap + 300
                            best = figure_index
                continue

            below_gap = bbox[1] - rect[3]      # жазу суреттің астында
            above_gap = rect[1] - bbox[3]      # жазу суреттің үстінде
            gap = below_gap if -4 <= below_gap <= 60 else (above_gap + 200 if 0 <= above_gap <= 16 else None)
            if gap is None:
                continue

            if best_gap is None or gap < best_gap:
                best_gap = gap
                best = figure_index

        if best is not None and best not in attached:
            attached[best] = info
            used.add(index)

    return attached, used


def collect_panels(page, page_rect, texts):
    """Оқулықтағы боялған тақталар — негізгі мәтіннің астындағы түсті төртбұрыштар.

    Олар не сурет блогы, не вектор толтыру түрінде салынады. Тақта деп тек
    ішінде негізгі мәтін тұрған аймақ есептеледі.
    """
    width, height = page_rect[2], page_rect[3]
    body_texts = [t for t in texts if t["family"] == BODY_FONT and t["size"] >= LAYOUT["body_min"]]
    if not body_texts:
        return []

    candidates = []

    for block in page_dict(page)["blocks"]:
        if block["type"] == 1:
            candidates.append(tuple(block["bbox"]))

    for item in page.get_drawings():
        if not item.get("fill"):
            continue
        r = item["rect"]
        candidates.append((r.x0, r.y0, r.x1, r.y1))

    panels = []
    for rect in candidates:
        w, h = rect[2] - rect[0], rect[3] - rect[1]
        if w < 120 or h < 40:
            continue
        if rect[0] < -1 or rect[2] > width + 1:      # беттің шетіндегі жолақтар
            continue
        if rect[1] > height - 70:                     # төменгі колонтитул аймағы
            continue
        if w > width * 0.97 and h > height * 0.9:
            continue

        inside = [t for t in body_texts if rect_contains(rect, t["bbox"], pad=6)]
        if not inside:
            continue

        panels.append(rect)

    merged = []
    for rect in sorted(panels, key=lambda r: (r[1], r[0])):
        placed = False
        for i, existing in enumerate(merged):
            if rects_touch(existing, rect, pad=2):
                merged[i] = merge_rect(existing, rect)
                placed = True
                break
        if not placed:
            merged.append(rect)

    return merged


def classify_text(info, figures):
    text = info["text"].strip()

    if info["family"] == FOOTER_FONT:
        return "drop"
    if re.fullmatch(r"\d{1,3}", text):
        return "drop"
    if "OKULYK" in text or "Книга предоставлена" in text:
        return "drop"

    # Параграф тақырыбы: 7-сынып оқулығында "§19–20." белгісі мәтіннің соңында тұрады
    if TOPIC_MARK.search(text) and len(text) < 220 and info["size"] >= LAYOUT["heading_min"]:
        return "topic-heading"

    if info["family"] == SIDE_FONT:
        if info["size"] >= 11.5:
            return "structure-heading"
        return "side"

    if info["family"] == BODY_FONT:
        if info["size"] >= LAYOUT["body_min"]:
            return "body"

        for rect in figures:
            if rect_contains(rect, info["bbox"], pad=8):
                return "in-figure"

        if info["size"] <= LAYOUT["caption_max"]:
            return "caption"

        # 8(7)-сынып оқулығында сурет жазуы 10 pt көлбеу қаріппен теріледі.
        # Бірақ өлең астындағы автор аты да осылай терілген — сондықтан мұндай
        # жазу тек нақты суретке байланысқанда ғана сақталады.
        if info["italic"] and info["size"] < LAYOUT["body_min"] and len(text) < 200:
            return "caption-weak"

        # Тарау соңындағы қайталау сабағы — одан кейінгі беттер параграфқа кірмейді
        if info["bold"] and REVISION_HEADING.search(info["text"]):
            return "revision"

        return "task"

    return "drop"


def is_question_block(text):
    """Негізгі қаріппен терілген, бірақ түгелдей сұрақтан тұратын шағын блок.

    Мәтін ішіндегі риторикалық сұрақтар ұзын абзацта тұрады, сондықтан
    тек қысқа әрі барлық сөйлемі сұрақ/тапсырма болатын блоктар алынып тасталады.
    """
    body = text.strip()
    if not body or len(body) > 320:
        return False

    sentences = [item for item in re.split(r"(?<=[.!?])\s+", body) if item.strip()]
    if not sentences:
        return False

    matched = sum(1 for item in sentences if item.rstrip().endswith("?") or TASK_RE.search(item))
    return matched >= len(sentences)


LEADING_QUESTION = re.compile(r"^([^<>]{5,220}?\?)\s+")
# HTML нұсқасында сұрақ қалың/көлбеу тегтердің ішінде тұруы мүмкін
LEADING_QUESTION_HTML = re.compile(r"^((?:<[^>]+>|[^<>]){5,260}?\?)((?:</[^>]+>)*)\s+")


def strip_leading_question(text, html):
    """Абзац сұрақпен басталса, сол сұрақ сөйлемін ғана алып тастайды."""
    match = LEADING_QUESTION.match(text)
    if not match:
        return text, html

    rest = text[match.end():].strip()
    if len(rest) < 200:
        return text, html

    html_match = LEADING_QUESTION_HTML.match(html)
    if not html_match:
        return text, html

    return rest, html[html_match.end():].strip()


# Пайдалы ақпарат блоктарының бастауыш белгілері — олар сақталады
KEEP_MARKERS = (
    "біліп жүр",
    "есіңе сақта",
    "есте сақта",
    "қажетті дерек",
    "бұл маңызды",
    "назар аудар",
)

# Тапсырма блоктарының бастауыш белгілері
TASK_MARKERS = (
    "анықта",
    "ізден",
    "ойлан",
    "түсіндір",
    "дәйекте",
    "сөзіңді дәйекте",
    "салыстыр",
    "талда",
    "зертте",
    "бағала",
    "ойтолғау",
    "кесте жаса",
    "саяхат жаса",
    "шеберлік таныт",
    "шығармашылықпен айналыс",
    "ұсыныс",
    "тапсырма",
    "жоба қорға",
    "пікірталас",
)

# Екінші жақ бұйрық райдағы етістіктер — сөйлем осылай аяқталса, бұл тапсырма
IMPERATIVE_TAIL = {
    "бер", "айт", "ата", "көрсет", "анықта", "талда", "жаса", "құрастыр", "түсіндір",
    "жаз", "тап", "дәлелде", "бағала", "сипатта", "толықтыр", "есепте", "белгіле",
    "таңда", "оқы", "көр", "жина", "ізде", "ойлан", "дәйекте", "салыстыр", "зертте",
    "таныт", "шық", "ұсын", "білдір", "келтір", "әңгімеле", "орында", "аяқта",
    "тұжырымда", "топта", "сал", "шеш", "толтыр", "жалғастыр", "сипаттап",
}

# Баспаның қызметтік жазулары
JUNK_NOTE = re.compile(r"(©|ЖШС\s*«8&8»|OKULYK)", re.IGNORECASE)


def last_word(text):
    cleaned = re.sub(r"[^\w\s]+$", "", text.strip())
    parts = cleaned.split()
    return parts[-1].lower() if parts else ""


def is_useful_note(text):
    """Шеткі блок оқуға пайдалы ақпарат па, әлде тапсырма ма?"""
    body = text.strip()
    if not body or JUNK_NOTE.search(body):
        return False

    lowered = body.lower()

    # «Біліп жүр!», «Қажетті дерек» сияқты блоктарда нақты ақпарат болса — қалады
    for marker in KEEP_MARKERS:
        if lowered.startswith(marker):
            return len(body) - len(marker) > 40

    if len(body) < 25:
        return False

    # Кесте тақырыбы сияқты аяқталмаған қысқа жолдар
    if len(body) < 70 and body[-1] not in ".!?»)":
        return False

    for marker in TASK_MARKERS:
        if lowered.startswith(marker):
            return False

    if last_word(body) in IMPERATIVE_TAIL:
        return False

    return True


def is_task_text(text):
    body = text.strip()
    if not body:
        return True
    if TASK_HEADINGS.search(body):
        return True
    return bool(TASK_RE.search(body))


def extract_book(pdf_path, out_dir, slug, first_page, last_page, tess=None):
    doc = fitz.open(pdf_path)
    image_dir = os.path.join(out_dir, slug)
    os.makedirs(image_dir, exist_ok=True)

    topics = []
    current = None
    fig_counter = 0

    for pno in range(first_page - 1, min(last_page, doc.page_count)):
        page = doc[pno]
        page_rect = (page.rect.x0, page.rect.y0, page.rect.x1, page.rect.y1)

        texts = []
        for block in page_dict(page)["blocks"]:
            if block["type"] == 1:
                continue
            info = block_info(block)
            if info and info["text"].strip() and not info.get("vertical"):
                texts.append(info)

        figures = collect_figures(page, page_rect, texts)
        panels = collect_panels(page, page_rect, texts)

        classified = []
        for info in texts:
            kind = classify_text(info, figures)
            if kind in ("drop", "in-figure"):
                continue
            classified.append((kind, info))

        caption_infos = [
            info
            for kind, info in classified
            if kind in ("caption", "caption-weak")
            and not MEANINGLESS_CAPTION.match(clean_text(info["text"]))
        ]
        attached, used_captions = attach_captions(figures, caption_infos)
        attached_ids = {id(info) for info in attached.values()}

        # Беттегі негізгі мәтіннің сол жақ шеті — азат жолды осымен салыстырамыз
        body_infos = [info for kind, info in classified if kind == "body"]
        page_margin = body_left_margin(body_infos)

        items = []
        for kind, info in classified:
            if kind in ("caption", "caption-weak") and id(info) in attached_ids:
                continue
            if kind == "caption-weak":
                # Суретке байланыспады — бұл сурет жазуы емес (өлең авторы, тапсырма үзіндісі)
                continue
            panel_id = None
            if kind == "body":
                for panel_index, panel_rect in enumerate(panels):
                    if rect_contains(panel_rect, info["bbox"], pad=6):
                        panel_id = "%d:%d" % (pno, panel_index)
                        break

            items.append(
                {
                    "kind": kind,
                    "info": info,
                    "panel": panel_id,
                    "margin": page_margin,
                    "y": info["bbox"][1],
                    "x": info["bbox"][0],
                }
            )

        for figure_index, rect in enumerate(figures):
            caption_info = attached.get(figure_index)
            items.append(
                {
                    "kind": "figure",
                    "rect": rect,
                    "caption": clean_text(caption_info["text"]) if caption_info else "",
                    "y": rect[1],
                    "x": rect[0],
                }
            )

        items.sort(key=lambda it: (round(it["y"] / 4), it["x"]))

        for position, item in enumerate(items):
            kind = item["kind"]

            # Келесі параграфтың атауы "§N." белгісінен бұрын келуі мүмкін —
            # ондай толық қалың қысқа блок мәтінге қосылмайды.
            if (
                kind == "body"
                and item["info"]["bold"]
                and len(item["info"]["text"].strip()) < 160
                and any(nxt["kind"] == "topic-heading" for nxt in items[position + 1 : position + 4])
            ):
                continue

            if kind == "topic-heading":
                current = {
                    "raw_title": clean_text(item["info"]["text"]),
                    "page": pno + 1,
                    "parts": [],
                    "awaiting_title": True,
                }
                topics.append(current)
                continue

            if kind == "structure-heading" or current is None:
                continue

            raw_text = item.get("info", {}).get("text", "") if "info" in item else ""

            # Қайталау сабағы басталса, параграф аяқталды
            if raw_text and REVISION_START.search(raw_text):
                current["skip_rest"] = True
                continue

            # «Білу және түсіну:», «Талдау:» сияқты рубрика — § соңындағы тапсырма
            if raw_text and RUBRIC_START.match(clean_text(raw_text).lstrip()):
                current["skip_rest"] = True
                continue

            # Оқу мақсаттарының тізімі теорияға жатпайды
            if raw_text and OBJECTIVES.search(raw_text):
                continue

            if kind == "revision":
                current["skip_rest"] = True
                continue

            if kind == "task":
                continue

            if current.get("skip_rest"):
                continue

            if kind == "body":
                # Параграф белгісінен кейінгі толық қалың қысқа блок — тақырып атауы
                if current.get("awaiting_title"):
                    if item["info"]["bold"] and len(item["info"]["text"].strip()) < 160:
                        current["awaiting_title"] = False
                        continue
                    current["awaiting_title"] = False

                if is_question_block(item["info"]["text"]):
                    continue

                # Блок ішіндегі азат жолдарды бөлек абзац қылып шығарамыз —
                # кітаптағы шегіністер сол күйінде сақталуы керек.
                paragraphs = split_paragraphs(item["info"], item.get("margin"))
                if not paragraphs:
                    paragraphs = [
                        {"text": item["info"]["text"], "html": item["info"]["html"], "indent": False}
                    ]

                for index, paragraph in enumerate(paragraphs):
                    body_text = clean_text(paragraph["text"])
                    body_html = clean_html(paragraph["html"])

                    if index == 0:
                        body_text, body_html = strip_leading_question(body_text, body_html)

                    if not body_text:
                        continue

                    # Тірек сөздер тізімі теориялық мәтін емес
                    if is_key_terms(body_html, body_text):
                        continue

                    # Сурет асты жазуының үзіндісі абзацты бөліп тастамауы керек
                    if is_caption_fragment(body_text):
                        continue

                    current["parts"].append(
                        {
                            "type": "body",
                            "html": join_hyphenated(body_html),
                            "text": join_hyphenated(body_text),
                            "indent": paragraph["indent"],
                            "panel": item.get("panel"),
                        }
                    )
            elif kind == "caption":
                caption = clean_text(item["info"]["text"])
                if caption and not MEANINGLESS_CAPTION.match(caption):
                    current["parts"].append({"type": "caption", "text": caption})
            elif kind == "side":
                text = clean_text(item["info"]["text"])
                if is_task_text(text) or not is_useful_note(text):
                    continue
                current["parts"].append(
                    {"type": "note", "html": clean_html(item["info"]["html"]), "text": text}
                )
            elif kind == "figure":
                fig_counter += 1
                clip = fitz.Rect(item["rect"])
                name = "%s-%03d.jpg" % (slug, fig_counter)
                target = os.path.join(image_dir, name)
                # Скан төмен ажыратымдылықта болса, пикселденбеуі үшін тегіс ұлғайтамыз
                figure_crop.render_clip(page, clip, 3.0).save(target, format="JPEG", quality=90, optimize=True)

                # Кітапта карта мен аңыз бүйіріне қарай басылуы мүмкін —
                # ондай суретті оқылатын күйге келтіреміз.
                # Мәтін қабаты бар PDF-те жол бағыты дәл көрсетеді, сондықтан
                # суреттен болжау қажет емес — ол жалған нәтиже беруі мүмкін.
                direction = figure_orientation.direction_from_pdf(page, clip)
                if direction == "none":
                    # Карта растр сурет болса, мәтін қабатында жазуы болмайды —
                    # ондайда суреттің орналасу матрицасы бұрылысты көрсетеді.
                    direction = figure_orientation.direction_from_placement(page, clip)

                if direction != "none":
                    with Image.open(target) as image:
                        image.load()
                        figure_orientation.rotate(image, direction).save(
                            target, quality=88, optimize=True
                        )
                current["parts"].append(
                    {
                        "type": "figure",
                        "file": name,
                        "caption": item.get("caption", ""),
                        "align": figure_alignment(item["rect"], body_infos, page_rect),
                    }
                )

    doc.close()

    if tess:
        dropped = drop_task_figures(topics, image_dir, tess)
        print("  тапсырма блогы болған сурет алынып тасталды:", dropped)

    for topic in topics:
        topic.pop("skip_rest", None)
        topic.pop("awaiting_title", None)
        topic["parts"] = merge_continuations(heal_split_paragraphs(topic["parts"]))

    return topics


def figure_alignment(rect, body_infos, page_rect):
    """Кітаптағыдай: суреттің жанында мәтін болса — сол/оң жақта тұрады."""
    width = page_rect[2] - page_rect[0]
    if (rect[2] - rect[0]) >= width * 0.6:
        return "center"

    left = right = False
    for info in body_infos:
        box = info["bbox"]
        # Тік бағытта қабысу болмаса, ол мәтін суреттің жанында емес
        overlap = min(box[3], rect[3]) - max(box[1], rect[1])
        if overlap <= (rect[3] - rect[1]) * 0.25:
            continue
        if box[2] <= rect[0] + 4:
            left = True
        elif box[0] >= rect[2] - 4:
            right = True

    if left and not right:
        return "right"
    if right and not left:
        return "left"
    return "center"


def merge_continuations(parts):
    """Бет ауысқанда бөлініп қалған сөйлемдерді біріктіреді."""
    result = []
    for part in parts:
        if (
            part["type"] == "body"
            and result
            and result[-1]["type"] == "body"
            and result[-1].get("panel") == part.get("panel")
            and not SENTENCE_END.search(result[-1]["text"])
            and part["text"][:1].islower()
            # Азат жолмен басталған абзац — жаңа абзац, жалғасы емес
            and not part.get("indent")
        ):
            # Бет ауысқанда сөз сызықшамен бөлінсе, дефис те, бос орын да қалмайды
            previous_text = result[-1]["text"].rstrip()
            previous_html = result[-1]["html"].rstrip()
            if previous_text.endswith("-"):
                result[-1]["text"] = previous_text[:-1] + part["text"]
                result[-1]["html"] = (previous_html[:-1] if previous_html.endswith("-") else previous_html) + part["html"]
            else:
                result[-1]["text"] = previous_text + " " + part["text"]
                result[-1]["html"] = previous_html + " " + part["html"]
            continue
        result.append(part)
    return result


def collect_running_heads(pdf_path, first_page, last_page):
    """Беттің жоғарғы жиегінде бірнеше бетте қайталанатын жолдар — колонтитул.

    Колонтитул кейде келесі беттің бірінші жолымен бір блокқа жабысып,
    абзацтың жалғасына араласып кетеді. Тақырып атауымен әрдайым сәйкес
    келмейді («Ж. Нұрмұхамедұлы…»), сондықтан оны PDF-тің өзінен жинаймыз.
    """
    doc = fitz.open(pdf_path)
    counts = {}

    for pno in range(first_page - 1, min(last_page, doc.page_count)):
        page = doc[pno]
        top = page.rect.y0 + page.rect.height * 0.09
        for block in page_dict(page)["blocks"]:
            if block.get("type") != 0:
                continue
            for line in block.get("lines", []):
                if line["bbox"][1] > top:
                    continue
                text = re.sub(r"\s+", " ", "".join(span["text"] for span in line["spans"])).strip()
                letters = sum(1 for ch in text if ch.isalpha())
                if 15 <= len(text) <= 120 and letters >= 10:
                    counts[text] = counts.get(text, 0) + 1

    doc.close()
    return sorted(text for text, count in counts.items() if count >= 2)


def main():
    config = json.loads(io.open(sys.argv[1], encoding="utf-8").read())
    out_dir = config["outDir"]
    os.makedirs(out_dir, exist_ok=True)

    result = {}
    heads = {}
    for book in config["books"]:
        LAYOUT["body_min"] = book.get("bodyMinSize", 10.6)
        LAYOUT["caption_max"] = book.get("captionMaxSize", 9.3)
        LAYOUT["heading_min"] = book.get("headingMinSize", 10.4)
        CP1251_LATIN["enabled"] = bool(book.get("cp1251Latin"))
        topics = extract_book(
            book["path"],
            out_dir,
            book["slug"],
            book["firstPage"],
            book["lastPage"],
            config.get("tesseract"),
        )
        result[book["slug"]] = topics
        heads[book["slug"]] = collect_running_heads(book["path"], book["firstPage"], book["lastPage"])
        print(book["slug"], "topics:", len(topics), "running heads:", len(heads[book["slug"]]))

    io.open(os.path.join(out_dir, "topics.json"), "w", encoding="utf-8").write(
        json.dumps(result, ensure_ascii=False, indent=1)
    )
    io.open(os.path.join(out_dir, "running_heads.json"), "w", encoding="utf-8").write(
        json.dumps(heads, ensure_ascii=False, indent=1)
    )


if __name__ == "__main__":
    main()
