"""Беттің ортасындағы суретті (формула, сызба) өз абзацынан кейін қою үшін
әр суреттің қай абзацтан кейін тұратынын анықтайды.

OCR нәтижесінде абзацтардың бетте қай жерде тұрғаны белгісіз, ал суреттің
қорабы белгілі. Абзацтың алғашқы сөздерін беттің мәтін қабатынан (векторлық
PDF) не Tesseract нәтижесінен тауып, оның биіктігін аламыз. Сурет — өзінен
жоғары басталған соңғы абзацтан кейін.

Қолданылуы:
    python scripts/figure_positions.py build-config.json out.json

Шығыс: {"figureAfter": {"бет": {"сурет нөмірі": абзац нөмірі}}} — build_ocr_payload
баптауына қосылады (қолмен берілгені басым).
"""

import difflib
import io
import json
import os
import re
import subprocess
import sys
import tempfile

import fitz

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_ocr_payload as builder  # noqa: E402

WORD = re.compile(r"[0-9a-zа-яёәғқңөұүһі]+", re.IGNORECASE)
# Абзацтың басын тану үшін алынатын сөз саны
PROBE_WORDS = 5
# Сәйкестік осыдан төмен болса, абзацтың орны белгісіз деп саналады
MIN_RATIO = 0.62


def words_of(text):
    return [word.lower() for word in WORD.findall(builder.strip_tags(text or "")) if len(word) >= 2]


def pdf_words(page):
    """Векторлық беттің сөздері: (сөз, жоғарғы шеті 0-1000)."""
    height = page.rect.height or 1
    result = []
    for x0, y0, x1, y1, text, block, line, number in page.get_text("words", sort=True):
        for word in words_of(text):
            result.append((word, y0 / height * 1000.0))
    return result


def tesseract_words(image_path, tess):
    """Сканерленген беттің сөздері Tesseract арқылы."""
    environment = dict(os.environ)
    environment["TESSDATA_PREFIX"] = tess["tessdata"]
    output = subprocess.run(
        [tess["binary"], image_path, "stdout", "-l", "kaz+rus", "--psm", "3", "--oem", "1", "tsv"],
        capture_output=True,
        env=environment,
        check=True,
    ).stdout.decode("utf-8", errors="replace")
    rows = output.splitlines()
    header = rows[0].split("\t") if rows else []
    index = {name: position for position, name in enumerate(header)}
    height = None
    result = []
    for row in rows[1:]:
        cells = row.split("\t")
        if len(cells) < len(header):
            continue
        if cells[index["level"]] == "1":
            height = float(cells[index["height"]]) or 1.0
            continue
        if cells[index["level"]] != "5" or not cells[index["text"]].strip():
            continue
        for word in words_of(cells[index["text"]]):
            result.append((word, float(cells[index["top"]]) / (height or 1.0) * 1000.0))
    return result


def locate(probe, words, start):
    """Сөздер тізбегінен probe-ке ең ұқсас терезені табады: (нөмір, ұқсастық)."""
    if not probe or not words:
        return None, 0.0
    target = " ".join(probe)
    best, best_ratio = None, 0.0
    size = len(probe)
    for offset in range(0, max(1, len(words) - size + 1)):
        window = " ".join(word for word, _ in words[offset: offset + size])
        ratio = difflib.SequenceMatcher(None, target, window).ratio()
        # Реті сақталсын: алдыңғы абзацтан кейінгі сәйкестікке басымдық
        if offset < start:
            ratio -= 0.08
        if ratio > best_ratio:
            best, best_ratio = offset, ratio
    return best, best_ratio


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    config_path, out_path = sys.argv[1], sys.argv[2]
    config = json.loads(io.open(config_path, encoding="utf-8").read())
    for key in ("convertLatex", "dropImagePlaceholders"):
        builder.OPTIONS[key] = bool(config.get(key))
    for key in ("textReplace", "pageKinds", "figureAfter", "extraFigures", "tableFigures", "dropFigures"):
        builder.OPTIONS[key] = config.get(key) or {}

    tess = config.get("stripEdgeText") or {}
    pages = builder.load_pages(config["jsonDir"], config["firstPage"], config["lastPage"])
    document = fitz.open(config["pdf"])
    image_dir = os.path.join(os.path.dirname(config["jsonDir"]), "img")
    only = set(int(value) for value in sys.argv[3].split(",")) if len(sys.argv) > 3 else None

    result = {}
    for page in pages:
        number = page["page"]
        if only and number not in only:
            continue
        kind = (page.get("pageKind") or "content").strip().lower()
        if kind not in ("content", "tasks", "other"):
            continue
        body = builder.group_body_blocks(page.get("body") or [])
        figures = [
            (index, figure)
            for index, figure in enumerate(page.get("figures") or [])
            if builder.valid_figure_box(figure.get("box"))
            and index not in set((builder.OPTIONS["dropFigures"].get(str(number)) or []))
        ]
        if len(body) < 2 or not figures:
            continue
        # Қолмен берілген орындар қайта есептелмейді
        manual = builder.OPTIONS["figureAfter"].get(str(number)) or {}

        if config.get("vectorPdf"):
            words = pdf_words(document[number - 1])
        else:
            image = os.path.join(image_dir, "p%04d.jpg" % number)
            if not os.path.exists(image) or not tess.get("binary"):
                continue
            words = tesseract_words(image, tess)
        if len(words) < 10:
            continue

        # Әр абзацтың басталған биіктігі
        starts = []
        cursor = 0
        for paragraph in body:
            probe = words_of(paragraph)[:PROBE_WORDS]
            if builder.is_markdown_table((paragraph or "").strip()) or len(probe) < 2:
                starts.append(None)
                continue
            offset, ratio = locate(probe, words, cursor)
            if offset is None or ratio < MIN_RATIO:
                starts.append(None)
                continue
            starts.append(words[offset][1])
            cursor = offset + len(probe)

        if os.environ.get("FIGPOS_DEBUG"):
            print(number, "starts:", [None if y is None else round(y) for y in starts], "figures:", [(i, f["box"][0]) for i, f in figures])
        known = [(position, y) for position, y in enumerate(starts) if y is not None]
        if len(known) < 2:
            continue
        # Биіктігі реттен шығып кеткен (басқа жерден табылған) абзацтар алынып
        # тасталады: биіктігі өсетін ең ұзын тізбек қалады
        best = [1] * len(known)
        previous = [-1] * len(known)
        for right in range(len(known)):
            for left in range(right):
                if known[left][1] <= known[right][1] + 5 and best[left] + 1 > best[right]:
                    best[right], previous[right] = best[left] + 1, left
        tail = max(range(len(known)), key=lambda position: best[position])
        ordered = []
        while tail != -1:
            ordered.append(known[tail])
            tail = previous[tail]
        ordered.reverse()

        for index, figure in figures:
            if str(index) in manual:
                continue
            top = figure["box"][0]
            above = [position for position, y in ordered if y < top - 3]
            below = [position for position, y in ordered if y >= top - 3]
            if not below:
                # Сурет беттің соңында — әдеттегі орны
                continue
            after = above[-1] if above else -1
            # Суреттен кейінгі алғашқы белгілі абзацқа дейінгі белгісіз абзацтар
            # суреттің қай жағында екені анық емес — ең соңғы жоғарғысынан кейін
            result.setdefault(str(number), {})[str(index)] = after

    io.open(out_path, "w", encoding="utf-8").write(json.dumps({"figureAfter": result}, ensure_ascii=False, indent=1))
    print("pages: %d, figures: %d" % (len(result), sum(len(value) for value in result.values())))


if __name__ == "__main__":
    main()
