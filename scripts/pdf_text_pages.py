# -*- coding: utf-8 -*-
"""Танылмай қалған беттерді PDF-тің өз мәтін қабатынан алады.

Gemini кейбір бетке авторлық құқық сүзгісімен («RECITATION») бос жауап
қайтарады. Векторлық оқулықта мәтін қабаты таза болса, сол беттің мазмұнын
тікелей PDF-тен алып, ocr_pages.mjs шығаратын JSON пішімінде сақтаймыз.

Қолдану: python scripts/pdf_text_pages.py config.json
config: {"pdf": …, "outDir": …, "pages": [72, 73], "overwrite": true}
"""

import io
import json
import os
import re
import sys

import fitz

# Беттегі баспа су таңбасы мен ескертпесі — мазмұн емес
JUNK_LINE = re.compile(
    r"(Все учебники|Книга предоставлена|согласно Приказа|OKULYK|окулык|^\s*\d{1,3}\s*$)",
    re.IGNORECASE,
)
# «§ 3», «§ 8–9», «3.1. Литосфера» сияқты айдарлар
PARAGRAPH_HEAD = re.compile(r"^\s*§\s*(\d+(?:\s*[–—-]\s*\d+)?)\s*\.?\s*(.*)$")
SUBSECTION_HEAD = re.compile(r"^\s*(\d+\.\d+)\.\s*(.+)$")
# Бояулы шеңбердегі параграф нөмірі: «12», «8–9», «15–16»
NUMBER_ONLY = re.compile(r"\s*\d{1,3}(?:\s*[–—-]\s*\d{1,3})?\s*")


# Скан қабатының көрінбейтін мәтіні (OKULYK қосқан OCR): нағыз мәтінмен қатар тұрады
HIDDEN_FONT = re.compile(r"glyphless", re.IGNORECASE)


def block_text(block):
    """Блоктың мәтіні: қалың қаріп <b>-мен, тасымал біріктіріледі."""
    parts = []
    for line in block.get("lines") or []:
        pieces = []
        for span in line.get("spans") or []:
            text = span.get("text") or ""
            if not text or HIDDEN_FONT.search(span.get("font") or ""):
                continue
            if "bold" in (span.get("font") or "").lower() and text.strip():
                pieces.append("<b>%s</b>" % text)
            else:
                pieces.append(text)
        merged = "".join(pieces).strip()
        if not merged:
            continue
        if parts and parts[-1].endswith("-"):
            parts[-1] = parts[-1][:-1] + merged
        else:
            parts.append(merged)
    text = " ".join(parts)
    text = re.sub(r"</b>\s*<b>", " ", text)
    return re.sub(r"\s{2,}", " ", text).strip()


def page_json(page, heading=None):
    """Беттің мазмұнын ocr_pages.mjs пішімінде құрайды."""
    rect = page.rect
    data = page.get_text("dict")
    body, figures = [], []
    number = title = None

    for block in sorted(data.get("blocks") or [], key=lambda item: (round(item["bbox"][1]), item["bbox"][0])):
        box = block["bbox"]
        if block.get("type") == 1:
            # Бет аясы да, нағыз сурет те бірдей растр блок болып келеді —
            # ажырату сенімсіз, сондықтан бұл беттердің суреті қолмен қойылады
            continue

        text = block_text(block)
        if not text or JUNK_LINE.search(re.sub(r"<[^>]+>", "", text)):
            continue

        plain = re.sub(r"<[^>]+>", "", text).strip()
        head = PARAGRAPH_HEAD.match(plain)
        if head and len(plain) < 160:
            number = number or re.sub(r"\s*", "", head.group(1))
            title = title or head.group(2).strip(" .:")
            continue
        # Параграф нөмірі бояулы шеңберде жеке тұрады: «8–9», «17»
        if NUMBER_ONLY.fullmatch(plain):
            number = number or re.sub(r"\s*", "", plain)
            continue
        sub = SUBSECTION_HEAD.match(plain)
        if sub and len(plain) < 80:
            title = title or sub.group(2).strip(" .:")
            continue
        # Нөмірден кейінгі қысқа жол — параграфтың атауы
        if number and not title and len(plain) < 120 and plain.endswith(("?", "!", ".")) is not False:
            title = plain.strip(" .:")
            continue
        body.append(text)

    if heading:
        number = heading.get("number") or number
        title = heading.get("title") or title
    return {
        "body": body,
        "boxes": [],
        "figures": figures,
        "pageKind": "content",
        "paragraphNumber": number,
        "paragraphTitle": title,
        "sectionTitle": None,
        "tables": [],
    }


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    config = json.loads(io.open(sys.argv[1], encoding="utf-8").read())
    document = fitz.open(config["pdf"])
    out_dir = config["outDir"]
    os.makedirs(out_dir, exist_ok=True)
    done = 0
    for number in config["pages"]:
        target = os.path.join(out_dir, "p%04d.json" % number)
        if os.path.exists(target) and not config.get("overwrite"):
            continue
        heading = (config.get("headings") or {}).get(str(number))
        data = page_json(document[number - 1], heading)
        io.open(target, "w", encoding="utf-8").write(json.dumps(data, ensure_ascii=False, indent=1))
        done += 1
        print("p%d: %d абзац, %d сурет%s" % (
            number, len(data["body"]), len(data["figures"]),
            ", §%s" % data["paragraphNumber"] if data["paragraphNumber"] else ""))
    document.close()
    print("дайын: %d бет" % done)


if __name__ == "__main__":
    main()
