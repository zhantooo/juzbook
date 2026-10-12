# -*- coding: utf-8 -*-
"""Сканерленген оқулық беттерін Tesseract арқылы таниды.

Gemini-дің тәуліктік шектеуі болғандықтан, тану жергілікті қозғалтқышпен
жүреді (pdf24.org сайтындағы OCR де осы Tesseract-ты қолданады, бірақ
жергілікті нұсқада шектеу жоқ әрі кітапты сыртқа жүктеу қажет емес).

Нәтиже — бет сайын бір JSON, Gemini құбырындағы схемамен бірдей:

    pageKind, sectionTitle, paragraphNumber, paragraphTitle,
    body[], bodyIndent[], boxes[{label,text}], figures[{caption,box}], tables[]

Сондықтан `build_ocr_payload.py` өзгеріссіз жұмыс істей береді.
"""

import io
import json
import os
import re
import subprocess
import sys

import fitz
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Танудың дәлдігі үшін бет 300 dpi-ге жуық ұлғайтылады
OCR_ZOOM = 4.0
# Талдау (сурет аймақтарын табу) үшін жеңілірек масштаб
ANALYSIS_ZOOM = 1.5

# Беттің жоғарғы/төменгі жиегі — колонтитул мен бет нөмірі сол жерде
HEADER_RATIO = 0.055
FOOTER_RATIO = 0.945

# Су таңбасы мен қызметтік жазулар
JUNK_LINE = re.compile(
    r"(OKULYK|okulyk|Все учебники|Книга предоставлена|согласно Приказа|"
    r"образовательных целях|Министра образования)",
    re.IGNORECASE,
)

# Параграф белгісі: § 12. немесе §12–13
PARAGRAPH_MARK = re.compile(
    r"^\s*[§$85SsЅ]\s*(\d{1,2}(?:\s*[–—-]\s*\d{1,2})?)\s*[.．]?\s*(.*)$"
)

# Бөлім/тарау атауы (бас әріппен жазылады)
SECTION_MARK = re.compile(r"(бөлім|тарау|БӨЛІМ|ТАРАУ)", re.IGNORECASE)

# Танудың сенімділігі осыдан төмен сөздер тасталады
MIN_WORD_CONF = 30.0


def tesseract_tsv(image_path, tessdata_dir, languages, binary):
    """Бетті танып, TSV жолдарын қайтарады."""
    command = [
        binary,
        image_path,
        "stdout",
        "-l",
        languages,
        "--psm",
        "3",
        "--oem",
        "1",
        "tsv",
    ]

    environment = dict(os.environ)
    if tessdata_dir:
        environment["TESSDATA_PREFIX"] = tessdata_dir

    result = subprocess.run(
        command,
        capture_output=True,
        env=environment,
        check=True,
    )

    return result.stdout.decode("utf-8", errors="replace")


def parse_lines(tsv):
    """TSV-ден мәтін жолдарын жинайды."""
    rows = tsv.splitlines()
    if not rows:
        return []

    header = rows[0].split("\t")
    index = {name: position for position, name in enumerate(header)}

    grouped = {}
    for row in rows[1:]:
        cells = row.split("\t")
        if len(cells) < len(header):
            continue
        if cells[index["level"]] != "5":
            continue

        text = cells[index["text"]]
        if not text.strip():
            continue

        try:
            confidence = float(cells[index["conf"]])
        except ValueError:
            continue
        if confidence < MIN_WORD_CONF:
            continue

        key = (
            int(cells[index["block_num"]]),
            int(cells[index["par_num"]]),
            int(cells[index["line_num"]]),
        )
        left = int(cells[index["left"]])
        top = int(cells[index["top"]])
        width = int(cells[index["width"]])
        height = int(cells[index["height"]])

        entry = grouped.setdefault(
            key,
            {"words": [], "left": left, "top": top, "right": left + width, "bottom": top + height},
        )
        entry["words"].append({"text": text, "left": left, "right": left + width})
        entry["left"] = min(entry["left"], left)
        entry["top"] = min(entry["top"], top)
        entry["right"] = max(entry["right"], left + width)
        entry["bottom"] = max(entry["bottom"], top + height)

    lines = []
    for key in sorted(grouped):
        entry = grouped[key]
        text = " ".join(word["text"] for word in entry["words"]).strip()
        if not text:
            continue
        lines.append(
            {
                "block": key[0],
                "paragraph": key[1],
                "text": text,
                "words": entry["words"],
                "left": entry["left"],
                "top": entry["top"],
                "right": entry["right"],
                "bottom": entry["bottom"],
                "height": entry["bottom"] - entry["top"],
            }
        )

    return lines


def _masks(page, zoom):
    pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom), colorspace=fitz.csRGB)
    rgb = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, 3).astype(np.int32)
    lum = (rgb[:, :, 0] * 299 + rgb[:, :, 1] * 587 + rgb[:, :, 2] * 114) // 1000
    sat = rgb.max(axis=2) - rgb.min(axis=2)
    background = float(np.percentile(lum, 90))
    ink = lum < background - 45
    pictish = (sat > 60) | ((lum < background - 50) & (lum > background - 185))
    return ink, pictish, pix.width, pix.height


def _erode(mask, radius):
    result = mask
    for axis in (0, 1):
        current = result
        for offset in range(1, radius + 1):
            current = current & np.roll(result, offset, axis=axis)
            current = current & np.roll(result, -offset, axis=axis)
        result = current
    return result


def _dilate(mask, radius):
    result = mask
    for axis in (0, 1):
        current = result
        for offset in range(1, radius + 1):
            current = current | np.roll(result, offset, axis=axis)
            current = current | np.roll(result, -offset, axis=axis)
        result = current
    return result


def _components(grid, min_cells):
    """Торкөз матрицасындағы байланысты аймақтардың шекараларын қайтарады."""
    height, width = grid.shape
    seen = np.zeros((height, width), dtype=bool)
    boxes = []

    for start_y in range(height):
        for start_x in range(width):
            if not grid[start_y, start_x] or seen[start_y, start_x]:
                continue

            stack = [(start_y, start_x)]
            seen[start_y, start_x] = True
            top = bottom = start_y
            left = right = start_x
            size = 0

            while stack:
                y, x = stack.pop()
                size += 1
                top = min(top, y)
                bottom = max(bottom, y)
                left = min(left, x)
                right = max(right, x)

                for dy in (-1, 0, 1):
                    for dx in (-1, 0, 1):
                        ny, nx = y + dy, x + dx
                        if 0 <= ny < height and 0 <= nx < width and grid[ny, nx] and not seen[ny, nx]:
                            seen[ny, nx] = True
                            stack.append((ny, nx))

            if size >= min_cells:
                boxes.append((top, left, bottom, right))

    return boxes


def _split_gutters(mask, top, left, bottom, right, min_gap):
    """Қатар тұрған суреттерді аралығындағы бос жолақ бойынша бөледі."""
    strip = mask[top:bottom + 1, left:right + 1]
    if strip.size == 0:
        return [(top, left, bottom, right)]

    columns = strip.mean(axis=0) > 0.01
    parts = []
    start = None
    gap = 0

    for index, value in enumerate(columns):
        if value:
            if start is None:
                start = index
            gap = 0
        elif start is not None:
            gap += 1
            if gap >= min_gap:
                parts.append((start, index - gap))
                start = None
                gap = 0

    if start is not None:
        parts.append((start, len(columns) - 1))

    if len(parts) <= 1:
        return [(top, left, bottom, right)]

    result = []
    for part_left, part_right in parts:
        if part_right - part_left < min_gap:
            continue
        result.append((top, left + part_left, bottom, left + part_right))

    return result or [(top, left, bottom, right)]


def detect_panels(page):
    """Түсті/реңкті блоктарды (Анықта!, Есте сақта!) табады."""
    pix = page.get_pixmap(matrix=fitz.Matrix(ANALYSIS_ZOOM, ANALYSIS_ZOOM), colorspace=fitz.csRGB)
    rgb = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, 3).astype(np.int32)
    lum = (rgb[:, :, 0] * 299 + rgb[:, :, 1] * 587 + rgb[:, :, 2] * 114) // 1000
    sat = rgb.max(axis=2) - rgb.min(axis=2)
    background = float(np.percentile(lum, 90))

    # Ашық реңкті тұтас фон: қағаздан сәл ғана қара, бірақ түсі бар
    tint = (sat > 12) & (lum > background - 60) & (lum < background - 4)
    tint = _erode(tint, 3)
    # Карта мен фото да реңкті, бірақ олардың жарықтығы құбылмалы.
    # Блок — тегіс бояу, сондықтан жергілікті ауытқуы аз болуы керек.
    smooth = np.abs(lum - np.roll(lum, 1, axis=1)) <= 6
    tint = tint & _erode(smooth, 2)

    height, width = tint.shape
    cell = 8
    rows = (height // cell) * cell
    cols = (width // cell) * cell
    if rows < cell * 4 or cols < cell * 4:
        return []

    grid = tint[:rows, :cols].reshape(rows // cell, cell, cols // cell, cell).mean(axis=(1, 3)) > 0.5
    grid = _dilate(grid, 1)

    panels = []
    for top, left, bottom, right in _components(grid, min_cells=30):
        y0 = top * cell / rows
        y1 = (bottom + 1) * cell / rows
        x0 = left * cell / cols
        x1 = (right + 1) * cell / cols

        # Блок кең әрі жалпақ болады. Биік аймақ — бұл блок емес, карта.
        if (x1 - x0) < 0.35 or (y1 - y0) < 0.02 or (y1 - y0) > 0.25:
            continue

        panels.append([
            int(round(y0 * 1000)), int(round(x0 * 1000)),
            int(round(y1 * 1000)), int(round(x1 * 1000)),
        ])

    return panels


def detect_figures(page, panels):
    """Беттегі сурет аймақтарын [ymin,xmin,ymax,xmax] (0-1000) түрінде табады."""
    ink, pictish, width, height = _masks(page, ANALYSIS_ZOOM)

    # Жіңішке мәтін штрихтары эрозиядан кейін жоғалады, сурет аймағы қалады
    solid = _erode(pictish, 2)

    cell = 8
    rows = (height // cell) * cell
    cols = (width // cell) * cell
    if rows < cell * 4 or cols < cell * 4:
        return []

    raw = solid[:rows, :cols].reshape(rows // cell, cell, cols // cell, cell).mean(axis=(1, 3)) > 0.18
    grid = _dilate(raw, 1)

    # Қатар тұрған суреттерді бөлу үшін бос бағандардың ені (торкөзбен).
    # Бөлу кеңейтілмеген тор бойынша жүреді — әйтпесе аралық жабылып қалады.
    min_gap = 2

    result = []
    for box in _components(grid, min_cells=40):
        for top, left, bottom, right in _split_gutters(raw, *box, min_gap=min_gap):
            y0 = top * cell / rows
            y1 = (bottom + 1) * cell / rows
            x0 = left * cell / cols
            x1 = (right + 1) * cell / cols

            if (y1 - y0) < 0.06 or (x1 - x0) < 0.10:
                continue

            candidate = [
                int(round(y0 * 1000)), int(round(x0 * 1000)),
                int(round(y1 * 1000)), int(round(x1 * 1000)),
            ]

            # Түсті блоктың ішіндегі аймақ сурет емес
            inside_panel = False
            for panel in panels:
                overlap_y = min(candidate[2], panel[2]) - max(candidate[0], panel[0])
                overlap_x = min(candidate[3], panel[3]) - max(candidate[1], panel[1])
                if overlap_y > 0 and overlap_x > 0:
                    area = (candidate[2] - candidate[0]) * (candidate[3] - candidate[1])
                    if overlap_y * overlap_x > area * 0.6:
                        inside_panel = True
                        break

            if not inside_panel:
                result.append(candidate)

    return result


def _norm(value, total):
    return int(round(1000.0 * value / max(1, total)))


def build_page(lines, figure_boxes, panels, width, height):
    """Танылған жолдардан беттің құрылымын жинайды."""
    useful = []
    for line in lines:
        text = line["text"].strip()
        if not text or JUNK_LINE.search(text):
            continue

        top_ratio = line["top"] / float(height)
        bottom_ratio = line["bottom"] / float(height)

        # Колонтитул мен бет нөмірі
        if bottom_ratio < HEADER_RATIO or top_ratio > FOOTER_RATIO:
            continue
        if re.fullmatch(r"[\d\s.,|—–-]+", text):
            continue

        useful.append(line)

    if not useful:
        return {
            "pageKind": "other",
            "sectionTitle": None,
            "paragraphNumber": None,
            "paragraphTitle": None,
            "body": [],
            "bodyIndent": [],
            "boxes": [],
            "figures": [],
            "tables": [],
        }

    # Негізгі мәтіннің қаріп биіктігі — ұзын жолдар бойынша
    long_lines = [line for line in useful if (line["right"] - line["left"]) > width * 0.25]
    heights = sorted(line["height"] for line in (long_lines or useful))
    body_height = heights[len(heights) // 2]

    section_title = None
    paragraph_number = None
    paragraph_title = None

    body_lines = []
    caption_lines = []
    panel_lines = {}

    for line in useful:
        text = line["text"].strip()

        match = PARAGRAPH_MARK.match(text)
        if match and paragraph_number is None and line["height"] >= body_height * 0.8:
            paragraph_number = match.group(1).replace(" ", "")
            rest = match.group(2).strip(" .")
            if rest:
                paragraph_title = rest
            continue

        if section_title is None and SECTION_MARK.search(text) and len(text) < 90:
            letters = [ch for ch in text if ch.isalpha()]
            if letters and sum(1 for ch in letters if ch.isupper()) / len(letters) > 0.6:
                section_title = text
                continue

        # Сурет асты жазуы кіші қаріппен жазылады
        if line["height"] < body_height * 0.82:
            caption_lines.append(line)
            continue

        # Түсті блоктың ішіндегі мәтін негізгі мәтінге қосылмайды
        panel_index = panel_of(line, panels, width, height)
        if panel_index is not None:
            panel_lines.setdefault(panel_index, []).append(line)
            continue

        body_lines.append(line)

    # Параграф атауы — нөмірден кейінгі бірінші жуан жол
    if paragraph_number is not None and paragraph_title is None and body_lines:
        first = body_lines[0]
        if (first["right"] - first["left"]) < width * 0.85:
            paragraph_title = first["text"].strip()
            body_lines = body_lines[1:]

    body, indents = group_paragraphs(body_lines, width)

    boxes = []
    for index in sorted(panel_lines):
        texts = [line["text"].strip() for line in panel_lines[index] if line["text"].strip()]
        if not texts:
            continue

        label = ""
        first = texts[0]
        # «Анықта!», «Есте сақта!» сияқты атау бірінші жолда тұрады
        marker = re.match(r"^([А-ЯЁӘҒҚҢӨҰҮІҺ][^.!?:]{2,24}[!?:])\s*(.*)$", first)
        if marker:
            label = marker.group(1).strip(" !?:")
            rest = marker.group(2).strip()
            texts = ([rest] if rest else []) + texts[1:]

        body_text = " ".join(texts).strip()
        if len(body_text) < 15:
            continue

        # Бет жиегіндегі тарау атауы (бас әріппен, тік жазылған) блок емес
        letters = [ch for ch in body_text if ch.isalpha()]
        if letters and sum(1 for ch in letters if ch.isupper()) / len(letters) > 0.55:
            continue

        boxes.append({"label": label, "text": body_text})

    figures = []
    for box in figure_boxes:
        # Мәтін жолдарымен қатты қабысатын аймақ сурет емес
        overlap = 0
        for line in body_lines:
            ly0 = _norm(line["top"], height)
            ly1 = _norm(line["bottom"], height)
            lx0 = _norm(line["left"], width)
            lx1 = _norm(line["right"], width)
            if min(ly1, box[2]) - max(ly0, box[0]) > 0 and min(lx1, box[3]) - max(lx0, box[1]) > 0:
                overlap += 1

        if overlap > 2:
            continue

        figures.append({"caption": nearest_caption(box, caption_lines, width, height), "box": box})

    return {
        "pageKind": "content",
        "sectionTitle": section_title,
        "paragraphNumber": paragraph_number,
        "paragraphTitle": paragraph_title,
        "body": body,
        "bodyIndent": indents,
        "boxes": boxes,
        "figures": figures,
        "tables": [],
    }


def join_lines(parts):
    """Жолдарды біріктіреді; жол соңындағы тасымал жойылады."""
    result = ""
    for part in parts:
        piece = part.strip()
        if not piece:
            continue
        if not result:
            result = piece
            continue
        if result.endswith("-") and piece[:1].islower():
            result = result[:-1] + piece
        else:
            result = result + " " + piece
    return result


def panel_of(line, panels, width, height):
    """Жол қай түсті блоктың ішінде тұрғанын қайтарады."""
    center_y = _norm((line["top"] + line["bottom"]) // 2, height)
    center_x = _norm((line["left"] + line["right"]) // 2, width)

    for index, panel in enumerate(panels):
        if panel[0] <= center_y <= panel[2] and panel[1] <= center_x <= panel[3]:
            return index

    return None


def group_paragraphs(lines, width):
    """Жолдарды азат жол бойынша абзацтарға жинайды."""
    if not lines:
        return [], []

    counts = {}
    for line in lines:
        key = round(line["left"] / (width * 0.01)) * (width * 0.01)
        counts[key] = counts.get(key, 0) + 1
    margin = min(key for key in counts if counts[key] == max(counts.values()))

    threshold = margin + width * 0.018

    # Қорғаныс: егер жолдардың басым бөлігі «азат жол» болып шықса, шет қате
    # табылған (мысалы, мәтін суреттің жанындағы тар бағанда тұр). Ондайда
    # ешқайсысын азат жол деп есептемейміз — әйтпесе әр жол бөлек абзац болады.
    marked = sum(1 for line in lines if line["left"] > threshold)
    if len(lines) >= 3 and marked > len(lines) * 0.55:
        threshold = float("inf")

    paragraphs = []

    for line in lines:
        starts_new = line["left"] > threshold
        if starts_new or not paragraphs:
            paragraphs.append({"lines": [line["text"]], "indent": starts_new})
        else:
            paragraphs[-1]["lines"].append(line["text"])

    body = [join_lines(item["lines"]) for item in paragraphs]
    indents = [item["indent"] for item in paragraphs]
    return body, indents


def caption_segments(line, width):
    """Бір жолда бірнеше суреттің қолтаңбасы тұруы мүмкін — бөліп аламыз."""
    words = line.get("words") or []
    if len(words) < 2:
        return [(line["left"], line["right"], line["text"].strip())]

    gap_limit = width * 0.035
    segments = []
    current = [words[0]]

    for word in words[1:]:
        if word["left"] - current[-1]["right"] > gap_limit:
            segments.append(current)
            current = [word]
        else:
            current.append(word)
    segments.append(current)

    result = []
    for segment in segments:
        text = " ".join(item["text"] for item in segment).strip()
        if text:
            result.append((segment[0]["left"], segment[-1]["right"], text))

    return result


def nearest_caption(box, caption_lines, width, height):
    """Суреттің астындағы ең жақын кіші қаріпті жазуды қайтарады."""
    best = None
    best_distance = None

    for line in caption_lines:
        ly0 = _norm(line["top"], height)

        # Тік бағытта суреттің астында тұруы керек
        if ly0 < box[2] - 5:
            continue
        distance = ly0 - box[2]
        if distance > 60:
            continue

        for left, right, text in caption_segments(line, width):
            lx0 = _norm(left, width)
            lx1 = _norm(right, width)
            overlap = min(lx1, box[3]) - max(lx0, box[1])
            if overlap <= 0:
                continue

            if best_distance is None or distance < best_distance:
                best_distance = distance
                best = text

    return best or ""


def find_binary():
    """Tesseract орындалатын файлын табады."""
    candidates = [
        os.environ.get("TESSERACT_EXE"),
        os.path.join("C:\\", "Program Files", "Tesseract-OCR", "tesseract.exe"),
        os.path.join(os.environ.get("LOCALAPPDATA", ""), "Programs", "Tesseract-OCR", "tesseract.exe"),
        "tesseract",
    ]

    for candidate in candidates:
        if not candidate:
            continue
        if candidate == "tesseract":
            try:
                subprocess.run([candidate, "--version"], capture_output=True, check=True)
                return candidate
            except Exception:
                continue
        if os.path.exists(candidate):
            return candidate

    return None


def main():
    config = json.loads(io.open(sys.argv[1], encoding="utf-8").read())

    binary = config.get("tesseract") or find_binary()
    if not binary:
        print("tesseract tabylmady")
        return 1

    tessdata = config.get("tessdata")
    languages = config.get("languages", "kaz+rus")
    out_dir = config["outDir"]
    os.makedirs(out_dir, exist_ok=True)

    work_dir = config.get("workDir") or os.path.join(out_dir, "_work")
    os.makedirs(work_dir, exist_ok=True)

    document = fitz.open(config["pdf"])
    first = config["firstPage"]
    last = min(config["lastPage"], document.page_count)

    done = 0
    for number in range(first, last + 1):
        target = os.path.join(out_dir, "p%04d.json" % number)
        if os.path.exists(target):
            continue

        page = document[number - 1]

        image_path = os.path.join(work_dir, "page.png")
        pixmap = page.get_pixmap(matrix=fitz.Matrix(OCR_ZOOM, OCR_ZOOM), colorspace=fitz.csGRAY)
        pixmap.save(image_path)

        try:
            tsv = tesseract_tsv(image_path, tessdata, languages, binary)
        except subprocess.CalledProcessError as error:
            print("bet %d qate: %s" % (number, error.stderr.decode("utf-8", "replace")[:200]))
            continue

        lines = parse_lines(tsv)
        panels = detect_panels(page)
        figures = detect_figures(page, panels)
        result = build_page(lines, figures, panels, pixmap.width, pixmap.height)
        result["page"] = number

        io.open(target, "w", encoding="utf-8").write(
            json.dumps(result, ensure_ascii=False, indent=1)
        )

        done += 1
        if done % 20 == 0:
            print("  %d bet" % done, flush=True)

    document.close()
    print("dayin: %d bet" % done)
    return 0


if __name__ == "__main__":
    sys.exit(main())
