"""Шығарылған параграфтарды сайттың мазмұн пішіміне айналдырады.

Кіріс: pdf_textbook_extract.py дайындаған topics.json және кітап құрылымы.
Шығыс: әр тақырыпқа HTML мазмұны бар payload.json, суреттер public/books ішіне
көшіріледі.
"""

import difflib
import io
import json
import os
import re
import shutil
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_ocr_payload import heal_split_paragraphs
from pdf_textbook_extract import is_caption_fragment, merge_continuations

# Ескертпе блогының әдепкі атауы
NOTE_TITLE = "Біліп жүргенге"

# Оқулықтың өз белгілері: блок осылай басталса, сол атау қолданылады
NOTE_MARKERS = [
    ("біліп жүр", "Біліп жүр"),
    ("есіңе сақта", "Есіңе сақта"),
    ("есте сақта", "Есте сақта"),
    ("қажетті дерек", "Қажетті дерек"),
    ("бұл маңызды", "Бұл маңызды"),
    ("назар аудар", "Назар аудар"),
]
# Оқулықтағы боялған тақтаның түсі
PANEL_COLOR = "#ede5c3"


def strip_tags(value):
    return re.sub(r"<[^>]+>", "", value)


def escape_attr(value):
    return value.replace('"', "&quot;")


def split_note_marker(text, html):
    """Блоктың басындағы «Қажетті дерек» сияқты белгіні атауға шығарады."""
    lowered = text.strip().lower()

    for marker, title in NOTE_MARKERS:
        if not lowered.startswith(marker):
            continue

        # HTML нұсқасынан да сол белгіні алып тастаймыз (тегтердің ішінде болуы мүмкін)
        pattern = re.compile(
            r"^(?:<[^>]+>|\s)*" + r"\s*".join(re.escape(word) for word in marker.split()) + r"\s*!?\s*(?:</[^>]+>)*\s*",
            re.IGNORECASE,
        )
        stripped = pattern.sub("", html, count=1).strip()
        return title, stripped or html

    return NOTE_TITLE, html


def build_content(topic, slug, public_prefix, topic_title):
    """Тақырыптың HTML мазмұнын құрайды."""
    # Беттің жоғарғы колонтитулы (параграф атауы) келесі беттің бірінші
    # жолымен бір блокқа жабысып қалуы мүмкін: «Кенесары … қозғалыс» + «тын.»
    parts = strip_running_head(topic["parts"], topic_title)
    parts = merge_continuations(heal_split_paragraphs(parts))
    chunks = []
    figure_number = 0
    index = 0

    while index < len(parts):
        part = parts[index]

        if part["type"] == "body":
            panel = part.get("panel")
            if not panel:
                chunks.append(paragraph_html(part))
                index += 1
                continue

            # Оқулықта бір түсті тақтаның ішінде тұрған абзацтар бір блокқа жиналады
            body = []
            while index < len(parts) and parts[index].get("panel") == panel and parts[index]["type"] == "body":
                body.append(paragraph_html(parts[index]))
                index += 1

            chunks.append('[colorbox color="%s"]%s[/colorbox]' % (PANEL_COLOR, "".join(body)))
            continue

        if part["type"] == "note":
            title, body = split_note_marker(part["text"], part["html"])
            chunks.append('[danger title="%s" color="blue"]<p>%s</p>[/danger]' % (title, body))
            index += 1
            continue

        if part["type"] == "figure":
            figure_number += 1
            # Жазу суретке орналасуы бойынша бекітілген, сондықтан ол әрқашан
            # өз суретінің астында тұрады
            caption = (part.get("caption") or "").strip()
            label = caption or "%s, %d-сурет" % (topic_title, figure_number)
            plain_label = escape_attr(strip_tags(label))
            src = "%s/%s/%s" % (public_prefix, slug, part["file"])
            align = part.get("align") or "center"
            chunks.append(
                '<figure data-juz-image="true" data-align="%s">'
                '<img src="%s" alt="%s" data-caption="%s" data-align="%s" />'
                "<figcaption>[СУРЕТ: %s]</figcaption></figure>"
                % (
                    align,
                    src,
                    plain_label,
                    escape_attr("[СУРЕТ: %s]" % strip_tags(label)),
                    align,
                    label,
                )
            )
            index += 1
            continue

        if part["type"] == "caption":
            # Суретке жалғаспаған жазу — сызбаның астындағы түсініктеме.
            # Ал «а ә ә», «молекуласының» сияқты үзінді мен «…қайтарады;»
            # деп бітетін белгі тізімі — суреттің өз жазуы, ол негізгі
            # мәтінге абзац болып қосылмайды (13-талап).
            text = (part.get("text") or "").strip()
            if text and not is_caption_fragment(text) and not text.endswith(";"):
                chunks.append("<p><i>%s</i></p>" % text)
            index += 1
            continue

        index += 1

    return "\n".join(chunks)


# Кітаптағы барлық тақырып атаулары (колонтитулды тану үшін)
BOOK_TITLES = []


def strip_running_head(parts, title):
    """Абзац басына жабысқан колонтитулды (параграф атауын) алып тастайды."""
    def clean(value):
        value = re.sub(r"\s*\(.*$", "", strip_tags(value or "")).strip()
        return re.sub(r"^§\s*[\d\-–—]+\.?\s*", "", value).strip()

    heads = []
    for candidate in [title] + list(BOOK_TITLES):
        value = clean(candidate)
        if len(value) >= 15 and value not in heads:
            heads.append(value)
    if not heads:
        return parts

    def cut_length(text):
        """Абзац басындағы колонтитулдың ұзындығы (атаумен ұқсастығы бойынша).

        Колонтитулда аттар қысқартылуы мүмкін («Ж. Нұрмұхамедұлы» —
        «Жанқожа Нұрмұхамедұлы»), сондықтан дәл емес, ұқсастықпен іздейміз.
        """
        best, best_ratio = 0, 0.0
        for head in heads:
            if text.startswith(head):
                return len(head)
            for length in range(max(10, len(head) - 20), min(len(text), len(head) + 20) + 1):
                if length < len(text) and not text[length].isspace():
                    continue
                ratio = difflib.SequenceMatcher(None, text[:length].lower(), head.lower()).ratio()
                if ratio > best_ratio:
                    best, best_ratio = length, ratio
        return best if best_ratio >= 0.8 else 0

    result = []
    previous_body = None
    for part in parts:
        text = (part.get("text") or "").lstrip()
        # Колонтитул тек аяқталмаған абзацтың жалғасына ғана жабысады:
        # тақырып өз атауымен басталса, оған тиіспейміз
        continuing = previous_body is not None and (
            previous_body.rstrip().endswith("-") or not re.search(r"[.!?:»…]\s*$", previous_body)
        )
        length = cut_length(text) if part.get("type") == "body" and continuing else 0
        if part.get("type") == "body":
            previous_body = text
        if length:
            rest = text[length:].lstrip()
            # Атаудың жалғасы («(1837–1847 жылдар)») болса, оны да өткіземіз
            rest = re.sub(r"^\(\d[^)]*\)\s*", "", rest)
            if rest[:1].islower():
                part = dict(part)
                part["text"] = rest
                html = (part.get("html") or "").lstrip()
                part["html"] = html[length:].lstrip() if html.startswith(text[:length]) else rest
                part["indent"] = False
        result.append(part)
    return result


def paragraph_html(part):
    """Абзацты HTML-ге айналдырады; азат жол шегінісі белгіленеді."""
    if part.get("indent"):
        return '<p data-indent="true">%s</p>' % part["html"]
    return "<p>%s</p>" % part["html"]


def build_excerpt(topic):
    for part in topic["parts"]:
        if part["type"] == "body":
            text = part["text"].strip()
            if len(text) > 240:
                cut = text[:240].rsplit(" ", 1)[0]
                return cut + "..."
            return text
    return ""


def main():
    config = json.loads(io.open(sys.argv[1], encoding="utf-8").read())

    topics_data = json.loads(
        io.open(os.path.join(config["extractDir"], "topics.json"), encoding="utf-8").read()
    )
    structure = json.loads(io.open(config["structurePath"], encoding="utf-8").read())

    public_root = config["publicRoot"]
    public_prefix = config["publicPrefix"]

    payload = []
    for slug, book in structure.items():
        topics = topics_data[slug]

        planned = []
        for section in book["sections"]:
            for group in section["groups"]:
                for title in group["topics"]:
                    planned.append((section["title"], group["title"], title))

        if len(planned) != len(topics):
            raise SystemExit(
                "%s: құрылымда %d тақырып, PDF-тен %d шықты"
                % (slug, len(planned), len(topics))
            )

        target_dir = os.path.join(public_root, slug)
        if os.path.isdir(target_dir):
            shutil.rmtree(target_dir)
        shutil.copytree(os.path.join(config["extractDir"], slug), target_dir)

        book_entry = {
            "slug": slug,
            "title": book["bookTitle"],
            "subjectId": book["subjectId"],
            "sourceInfo": book["sourceInfo"],
            "theme": book["theme"],
            "sections": [],
        }

        cursor = 0
        # Тақырып атаулары және PDF-тен жиналған колонтитулдар
        heads_path = os.path.join(config["extractDir"], "running_heads.json")
        running_heads = []
        if os.path.exists(heads_path):
            running_heads = json.loads(io.open(heads_path, encoding="utf-8").read()).get(slug, [])
        BOOK_TITLES[:] = [item[2] for item in planned] + running_heads

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
                            "content": build_content(topic, slug, public_prefix, title),
                        }
                    )
                section_entry["groups"].append(group_entry)
            book_entry["sections"].append(section_entry)

        payload.append(book_entry)

    io.open(config["payloadPath"], "w", encoding="utf-8").write(
        json.dumps(payload, ensure_ascii=False)
    )

    for book in payload:
        total = sum(
            len(group["topics"]) for section in book["sections"] for group in section["groups"]
        )
        chars = sum(
            len(topic["content"])
            for section in book["sections"]
            for group in section["groups"]
            for topic in group["topics"]
        )
        print("%s: topics=%d chars=%d" % (book["slug"], total, chars))


if __name__ == "__main__":
    main()
