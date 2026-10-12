# -*- coding: utf-8 -*-
"""Оқулық беттерінен суреттерді дәл қиып алу.

Gemini қайтаратын шектеу тіктөртбұрышы (box) шамамен ғана дұрыс: жиі
суреттің үстіндегі мәтін жолы немесе астындағы қолтаңба қоса кетеді, ал
кейде керісінше суреттің шеті кесіліп қалады. Сондықтан ол тіктөртбұрыш
тек бастапқы бағдар ретінде алынады да, шын шекара беттің өз мазмұны
бойынша есептеледі:

1. Бастапқы тіктөртбұрыш тігінен кеңейтіліп растрға айналдырылады;
2. Жолдар сия бойынша жолақтарға бөлінеді (кітап беті — жолақтар тізбегі);
3. Биіктігі мәтін жолындай әрі түссіз жолақтар — мәтін деп танылады;
4. Суреттің жолағынан бастап, мәтінге тірелгенше жоғары-төмен кеңейеміз;
5. Соңында бос ақ жиектер қиылып, шын шекара алынады.

Бұл тәсіл суреттің үстіндегі мәтінді де, астындағы қолтаңбаны да кесіп
тастайды, ал ескі сепия суреттердің ашық фонын жоғалтып алмайды.
"""

import fitz
import os
import sys

import numpy as np
from PIL import Image, ImageFilter

# Тігінен және көлденеңінен қанша кеңейтіп талдаймыз (бет өлшемінің үлесі)
PAD_Y = 0.05
PAD_X = 0.012
# Талдау кезіндегі ұлғайту
ANALYSIS_ZOOM = 2.0
# Соңғы суреттің ұлғайтуы
OUTPUT_ZOOM = 3.0
# Векторлық PDF үшін True: сурет тазалаусыз, тікелей салынады (build баптауы vectorPdf)
DIRECT_RENDER = False
# Дәл қорап өсірілмейтін беттер (кесте ұяшықтарындағы суреттер)
EXACT_PAGES = set()
# Жиегі кесілмейтін беттер (қорабы тексерілген, айналасында жазу жоқ)
NO_STRIP_PAGES = set()
# Бүйірден кесу (ескі, жуық қорапқа арналған тәртіп)
SIDE_TRIM = False
# Дәл қорап берілгенде True: жолақ талдауы орнына тек ақ жиек тазаланады
TIGHT_CROP = False
# Қиындының шетіндегі мәтін жолын (қолтаңба, абзац) Tesseract арқылы кесу:
# {"binary": ".../tesseract.exe", "tessdata": ".../tessdata"} (build баптауы stripEdgeText)
EDGE_TEXT = None

CAPTION_LINE = None


def _ocr_lines(image):
    """Tesseract арқылы суреттегі мәтін жолдарын қайтарады: [(top, bottom, left, right, text)]."""
    import os
    import re
    import subprocess
    import tempfile

    global CAPTION_LINE
    if CAPTION_LINE is None:
        # Курсивті жазуды Tesseract кейде латынша оқиды: «32-cypem»
        CAPTION_LINE = re.compile(
            r"\d+\s*[-–—]?\s*([сcС][уyУ][рpР][еeЕ][тmТ]|[сcС][ыь]зба|схема)"
            # Сол жағынан кесілген жазу: «урет. 2 мысалдың блок сызбасы»
            r"|^\W*[уyУ][рpР][еeЕ][тmТ]\s*\.",
            re.IGNORECASE,
        )

    handle, path = tempfile.mkstemp(suffix=".png")
    os.close(handle)
    try:
        image.save(path)
        env = dict(os.environ)
        env["TESSDATA_PREFIX"] = EDGE_TEXT["tessdata"]
        result = subprocess.run(
            [EDGE_TEXT["binary"], path, "stdout", "-l", "kaz+rus+eng", "--psm", "4", "tsv"],
            capture_output=True, env=env, timeout=60,
        )
        rows = result.stdout.decode("utf-8", "ignore").splitlines()[1:]
    finally:
        os.remove(path)

    lines = {}
    for row in rows:
        parts = row.split("\t")
        if len(parts) < 12 or parts[0] != "5":
            continue
        try:
            conf = float(parts[10])
        except ValueError:
            continue
        if conf < 40 or not parts[11].strip():
            continue
        key = (parts[2], parts[3], parts[4])
        left, top, width, height = (int(parts[6]), int(parts[7]), int(parts[8]), int(parts[9]))
        entry = lines.setdefault(key, [top, top + height, left, left + width, []])
        entry[0] = min(entry[0], top)
        entry[1] = max(entry[1], top + height)
        entry[2] = min(entry[2], left)
        entry[3] = max(entry[3], left + width)
        entry[4].append(parts[11])
    return sorted((a, b, c, d, " ".join(words)) for a, b, c, d, words in lines.values())


def _strip_edge_text(page, clip):
    """Қиындының астындағы «N-сурет …» жазуын және шетіндегі абзац жолдарын кеседі."""
    import re

    zoom = 3.0
    pix = page.get_pixmap(clip=clip, matrix=fitz.Matrix(zoom, zoom), colorspace=fitz.csRGB)
    image = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
    # Су таңбасы Tesseract-тың сенімділігін төмендетеді — алдымен ашық сұрды ағартамыз
    array = np.asarray(image).astype(np.int32)
    faint = (array.min(axis=2) >= 214) & ((array.max(axis=2) - array.min(axis=2)) < 14)
    array[faint] = 255
    image = Image.fromarray(array.astype(np.uint8))
    lines = _ocr_lines(image)
    width, height = image.size
    lum = (array[:, :, 0] * 299 + array[:, :, 1] * 587 + array[:, :, 2] * 114) // 1000
    ink_mask = (lum < 225) | ((array.max(axis=2) - array.min(axis=2)) > 40)
    filled = ink_mask.any(axis=1)
    filled_cols = ink_mask.any(axis=0)

    def sliver(side):
        """Шеттегі жіңішке, суреттен ақ жолақпен бөлінген, оқылмайтын жолақ —
        жартысы ғана кірген жазу жолы. Кесілетін шекараны қайтарады."""
        order = range(height - 1, -1, -1) if side == "bottom" else range(height)
        order = list(order)
        index = 0
        while index < len(order) and not filled[order[index]]:
            index += 1
        band = index
        # Жолақ ішіндегі шағын үзілістер (әріптің нүктесі, жіңішке сызық) — бір жолақ
        while True:
            while index < len(order) and filled[order[index]]:
                index += 1
            gap = index
            while index < len(order) and not filled[order[index]]:
                index += 1
            if index - gap >= 5 or index >= len(order):
                break
        band_rows = gap - band
        gap_rows = index - gap
        if band_rows == 0 or band_rows > 18 * zoom or gap_rows < 9 or index >= len(order) or index > height * 0.5:
            return None
        start, end = sorted((order[band], order[gap - 1]))
        if band_rows > 8 * zoom:
            # Биіктеу жолақ тек тар болса (шетте кесілген бір сөз: «рлеу») не
            # бір түсті безендіру жолағы болса кесіледі
            plain = float(array[start:end + 1].std()) < 12
            ink_cols = np.flatnonzero(ink_mask[start:end + 1].any(axis=0))
            wide = ink_cols.size and ink_cols[-1] - ink_cols[0] > width * 0.4
            # Ені бойынша созылған жолақ суреттің бөлігі болуы мүмкін, бірақ
            # оны ірі ақ аралық бөліп тұрса — бөтен жазу (тақырып жолағы)
            if wide and not plain and gap_rows < 6 * zoom:
                return None
        if any(line[0] <= end and line[1] >= start for line in lines):
            return None
        return order[gap + gap_rows // 2]

    def side_column(side):
        """Бүйірдегі көрші мәтін бағанының жұқа жолағы (әріптердің басы ғана
        кірген) — ақ аралықпен бөлінген, биіктігі бойынша созылып жатады."""
        order = list(range(width - 1, -1, -1) if side == "right" else range(width))
        index = 0
        while index < len(order) and not filled_cols[order[index]]:
            index += 1
        band = index
        while True:
            while index < len(order) and filled_cols[order[index]]:
                index += 1
            gap = index
            while index < len(order) and not filled_cols[order[index]]:
                index += 1
            if index - gap >= 5 or index >= len(order):
                break
        band_cols = gap - band
        if band_cols == 0 or band_cols > 12 * zoom or index - gap < 9 or index >= len(order) or index > width * 0.4:
            return None
        start, end = sorted((order[band], order[gap - 1]))
        # Мәтін бағаны — биіктіктің жартысынан астамына созылады
        rows = np.flatnonzero(ink_mask[:, start:end + 1].any(axis=1))
        if not rows.size or rows[-1] - rows[0] < height * 0.5:
            return None
        if any(line[2] <= end and line[3] >= start for line in lines):
            return None
        return order[gap + (index - gap) // 2]

    def side_fragments(side):
        """Бүйірдегі көрші мәтін бағанының оқылатын үзінділері: солар мен
        суреттің арасындағы ақ аралықтан кесеміз."""
        outer = [line for line in lines if (line[2] >= width * 0.7 if side == "right" else line[3] <= width * 0.3)]
        if not outer:
            return None
        # Сырттан ішке қарай алғашқы бос аралық: одан тыс қалған жазу — көрші баған
        inner = width - 1 if side == "right" else 0
        # Көрші баған түсті жақтауда тұруы мүмкін, сондықтан аралықты тек қою
        # пикселдер бойынша іздейміз
        dark_cols = (lum < 140).any(axis=0)
        gutter = int(4 * zoom)
        step = -1 if side == "right" else 1
        position, run_start = inner + step, None
        while 0 <= position < width:
            if dark_cols[position]:
                if run_start is not None and abs(position - run_start) >= gutter:
                    cut = (run_start + position - step) // 2
                    keep = cut if side == "right" else width - cut
                    return cut if keep >= width * 0.6 else None
                run_start = None
            elif run_start is None:
                run_start = position
            position += step
        return None

    cut_top, cut_bottom = sliver("top"), sliver("bottom")
    # Бүйірдегі кесу тек жуық қораппен жұмыс істегенде керек еді. Сурет аймағы
    # _figure_extent арқылы табылғандықтан, қиындыға көрші баған кірмейді —
    # бүйірден кесу суреттің өз бөлігін қиып тастауы мүмкін.
    cut_left = cut_right = None
    if SIDE_TRIM:
        cut_left = side_column("left") or side_fragments("left")
        cut_right = side_column("right") or side_fragments("right")
    scale = 1.0 / zoom
    box_x0 = clip.x0 + (cut_left or 0) * scale
    box_x1 = clip.x0 + (cut_right if cut_right is not None else width) * scale
    if not lines:
        if cut_top is None and cut_bottom is None and cut_left is None and cut_right is None:
            return clip
        return fitz.Rect(box_x0, clip.y0 + (cut_top or 0) * scale, box_x1, clip.y0 + (cut_bottom or height) * scale)

    def separated(line, side):
        """Жол суреттен ақ жолақпен бөлінген бе? Сызбаның ішкі жазуы (тірек
        сызығы, жақша, жебе) суретпен тұтасып тұрады, ал абзац қалдығы — жоқ."""
        top, bottom = line[0], line[1]
        rows = filled[bottom + 2:min(height, bottom + 60)] if side == "top" else filled[max(0, top - 60):max(0, top - 2)][::-1]
        run = 0
        for value in rows:
            run = 0 if value else run + 1
            if run >= 5:
                return True
        # Жолдың арғы жағы бос болса (қиындының соңы) — бөлінген
        return len(rows) < 5

    def prose(line, side=None, edge=None):
        top, bottom, left, right, text = line
        words = re.findall(r"[А-Яа-яӘәҒғҚқҢңӨөҰұҮүҺһІі]{2,}", text)
        if side:
            gap = top - (edge or 0) if side == "top" else (height if edge is None else edge) - bottom
            # Шекарадан алыс жол — суреттің өз жазуы (мысалы, ашық түсті
            # жақтаудағы «3 Алгоритмді … жазу»), абзац қалдығы емес
            if gap > 14:
                return False
            # Қиындының екі шетіне дейін созылған жол — кесілген абзац жолы
            # (сызбаның жазуы жақтауының ішінде тұрады, шетке жетпейді)
            spans = left <= width * 0.015 and right >= width * 0.985
            if gap <= 14 and spans and bottom - top <= 60 and sum(1 for word in words if len(word) >= 3) >= 2:
                return True
            # Жоғарғы шетте тек әріптердің төменгі жартысы қалған жол
            if side == "top" and gap <= 3 and bottom - top <= 20 and (right - left) >= width * 0.4:
                return True
        if side and not separated(line, side):
            return False
        # Шетке тіреліп, кесіліп тұрған жол — абзацтың қалдығы («суреттер).»).
        # Шет — алдыңғы жол кесілгеннен кейінгі жаңа шекара
        if side == "top":
            at_edge = top - (edge or 0) <= 14
        elif side == "bottom":
            at_edge = (height if edge is None else edge) - bottom <= 14
        else:
            at_edge = top <= 14 or bottom >= height - 14
        if at_edge and any(len(word) >= 4 for word in words) and (right - left) >= width * 0.25 and bottom - top <= 50:
            return True
        # Бүйір шетінде кесілген сөз («2. Алгоритмді әзірлеу» → «рлеу»)
        if at_edge and side and bottom - top <= 50 and (left <= width * 0.015 or right >= width * 0.985) and re.search(r"[А-Яа-яӘәҒғҚқҢңӨөҰұҮүҺһІі]{3,}", text):
            return True
        # Курсивті «суреттер).» кейде латынша оқылады: «Cypemmep }.»
        if at_edge and side and bottom - top <= 50 and re.search(r"[A-Za-zА-Яа-яӘәҒғҚқҢңӨөҰұҮүҺһІі]{3,}\s*[)}\]]\s*[.,;:]?\s*$", text):
            return True
        return (right - left) >= width * 0.7 and len(words) >= 4

    # Үштілді сөздік («Ұяшық – Ячейка – Cell») — тірек сөздер, сурет емес
    # Ағылшын бөлігі келесі жолға ауысуы мүмкін: «Дискреттілік — Дискретность —»
    # Сызықша екі жағынан бос орынмен бөлінеді (тасымал «форматын-» емес),
    # үшінші бөлігі — ағылшын сөзі
    trilingual = re.compile(r"^.{2,40}?(?:\s[–—-]\s?|[–—-]\s).{2,40}?(?:\s[–—-]|[–—-]\s)\s*[A-Za-z]{3,}")
    glossary = [line for line in lines if trilingual.match(line[4].strip())]
    # Әр бөлігі бөлек жолда: «Пішімдеу – Форматирование –» / «Formatting»
    english = sum(1 for line in lines if re.fullmatch(r"[A-Za-z][A-Za-z ,()'.-]*", line[4].strip()))
    dashed = sum(1 for line in lines if re.search(r"[–—-]\s*$", line[4].strip()))
    split_glossary = english >= 2 and dashed >= 2 and english + dashed >= len(lines) * 0.5

    # Мәтін жолдарынан тыс сызық, жақтау, сурет — қиындыда графика бар
    ink = (lum < 200) | ((array.max(axis=2) - array.min(axis=2)) > 60)
    for top, bottom, left, right, _ in lines:
        ink[max(0, top - 4):bottom + 4, max(0, left - 4):right + 4] = False
    has_graphics = ink.mean() >= 0.004

    if len(glossary) >= 3 or len(glossary) >= max(1, len(lines) * 0.4) or split_glossary:
        # Тірек сөздер тізбегі: суреті болмаса — мүлде сурет емес, болса —
        # сөздік жолағы шетінен кесіледі
        if not has_graphics:
            return None
        if split_glossary:
            glossary = list(lines)

    # Тек жазудан тұратын қиынды («3-сызба. Компьютер жадының түрлері») — сурет емес
    if all(CAPTION_LINE.search(line[4]) or prose(line) for line in lines):
        covered = sum(line[1] - line[0] for line in lines)
        if covered >= height * 0.45 and not has_graphics:
            return None

    new_top, new_bottom = cut_top or 0, cut_bottom or height
    # Беттің негізгі мәтіні мен қолтаңбалары қиындының шетінен кесіледі.
    # Суреттің өз жазуы (жақтаудағы «Стили таблиц») бұл тізімде жоқ.
    for box in _edge_barriers(page):
        if not box.intersects(clip):
            continue
        top_px = (box.y0 - clip.y0) * zoom
        bottom_px = (box.y1 - clip.y0) * zoom
        if bottom_px <= height * 0.45 and top_px <= 16 * zoom:
            new_top = max(new_top, min(height, int(bottom_px) + 4))
        elif top_px >= height * 0.55 and bottom_px >= height - 16 * zoom:
            new_bottom = min(new_bottom, max(0, int(top_px) - 4))

    # Тірек сөздер жолағы (үштілді сөздік) — суреттің шетінен кесіледі
    for line in glossary:
        if line[1] <= height * 0.45:
            new_top = max(new_top, line[1] + 4)
        elif line[0] >= height * 0.55:
            new_bottom = min(new_bottom, line[0] - 4)

    if new_bottom - new_top < height * 0.3:
        # Жазуды кескен соң жіңішке жолақ қана қалды — бұл сурет емес
        return None if (new_top > 0 or new_bottom < height) else clip
    return fitz.Rect(box_x0, clip.y0 + new_top * scale, box_x1, clip.y0 + new_bottom * scale)


def _dilate(mask, radius):
    """Логикалық маска: әр пикселді radius пиксельге жаяды (жылдам, numpy)."""
    result = mask
    for _ in range(radius):
        grown = result.copy()
        grown[1:, :] |= result[:-1, :]
        grown[:-1, :] |= result[1:, :]
        grown[:, 1:] |= result[:, :-1]
        grown[:, :-1] |= result[:, 1:]
        result = grown
    return result


_PAGE_LINES = {}


def _page_text_lines(page, zoom=1.5):
    """Беттің барлық мәтін жолын (пункт өлшемінде) қайтарады, кэштеледі."""
    key = (id(page.parent), page.number)
    if key in _PAGE_LINES:
        return _PAGE_LINES[key]
    lines = []
    if EDGE_TEXT:
        pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom), colorspace=fitz.csRGB)
        rgb = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, 3).astype(np.int32)
        faint = (rgb.min(axis=2) >= 214) & ((rgb.max(axis=2) - rgb.min(axis=2)) < 14)
        rgb[faint] = 255
        try:
            raw = _ocr_lines(Image.fromarray(rgb.astype(np.uint8)))
        except Exception:
            raw = []
        for top, bottom, left, right, text in raw:
            lines.append((
                page.rect.y0 + top / zoom, page.rect.y0 + bottom / zoom,
                page.rect.x0 + left / zoom, page.rect.x0 + right / zoom, text,
            ))
    _PAGE_LINES[key] = lines
    return lines


def _body_text_lines(page):
    """Негізгі мәтіннің жолдары: бет бағанының сол не оң шетіне тураланған,
    ені кең, бірнеше сөзден тұратын, ақ фондағы жолдар. Әр жол үшін
    (жоғары, төмен, сол, оң, бағанның сол шеті, бағанның оң шеті) қайтарылады.
    Сурет ішіндегі жазу (түсті фонда тұрған) бұл тізімге кірмейді."""
    import re
    from collections import Counter

    key = (id(page.parent), page.number, "body")
    if key in _PAGE_LINES:
        return _PAGE_LINES[key]

    lines = _page_text_lines(page)
    if not lines:
        _PAGE_LINES[key] = []
        return []
    width = page.rect.width
    wide = [line for line in lines if (line[3] - line[2]) >= width * 0.2 and (line[1] - line[0]) <= 16]
    lefts = Counter(round(line[2] / 2.0) * 2 for line in wide)
    rights = Counter(round(line[3] / 2.0) * 2 for line in wide)
    common_left = [value for value, count in lefts.items() if count >= 3]
    common_right = [value for value, count in rights.items() if count >= 3]

    # Түсті фон — жол суреттің ішінде тұр
    zoom = 1.0
    pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom), colorspace=fitz.csRGB)
    rgb = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, 3).astype(np.int32)
    colour = (rgb.max(axis=2) - rgb.min(axis=2)) > 40

    body = []
    for top, bottom, left, right, text in wide:
        words = re.findall(r"[A-Za-zА-Яа-яӘәҒғҚқҢңӨөҰұҮүҺһІі]{2,}", text)
        if len(words) < 3:
            continue
        left_hits = [value for value in common_left if abs(left - value) <= 4]
        right_hits = [value for value in common_right if abs(right - value) <= 4]
        if not left_hits and not right_hits:
            continue
        band = colour[
            max(0, int((top - page.rect.y0) * zoom) - 3):int((bottom - page.rect.y0) * zoom) + 4,
            max(0, int((left - page.rect.x0) * zoom)):int((right - page.rect.x0) * zoom) + 1,
        ]
        if band.size and band.mean() > 0.08:
            continue
        column_left = min(left_hits) if left_hits else left
        column_right = max(right_hits) if right_hits else right
        if common_left and not left_hits:
            column_left = min(common_left)
        if common_right and not right_hits:
            column_right = max(common_right)
        body.append((top, bottom, left, right, column_left, column_right))
    _PAGE_LINES[key] = body
    return body


def _edge_barriers(page):
    """Қиындының шетінен кесілуге тиіс жолдар: беттің негізгі мәтіні және
    «N-сурет …» қолтаңбалары (бет координатасында)."""
    key = (id(page.parent), page.number, "barriers")
    if key in _PAGE_LINES:
        return _PAGE_LINES[key]
    boxes = []
    for top, bottom, left, right, _cl, _cr in _body_text_lines(page):
        boxes.append(fitz.Rect(left, top, right, bottom))
    for top, bottom, left, right, text in _page_text_lines(page):
        if CAPTION_LINE is not None and CAPTION_LINE.search(text):
            boxes.append(fitz.Rect(left, top, right, bottom))
    _PAGE_LINES[key] = boxes
    return boxes



def _figure_extent(page, seed, bridge_pt=6.0, margin=0.45):
    """Суреттің бетте алып жатқан ТОЛЫҚ аймағын қайтарады.

    Модельдің қорабы жуық болғандықтан (кейде суреттің жартысы ғана),
    қорап тек «тұқым» ретінде алынады: беттің сия маскасынан негізгі мәтін
    жолдары өшіріліп, тұқымнан бастап байланысты аймақ өсіріледі
    (морфологиялық реконструкция). Нәтиже — суреттің барлық бөлігі:
    жақтауы, жебесі, жазулары.
    """
    prect = page.rect
    zoom = 1.5
    roi = fitz.Rect(
        max(prect.x0, seed.x0 - prect.width * margin),
        max(prect.y0, seed.y0 - prect.height * margin),
        min(prect.x1, seed.x1 + prect.width * margin),
        min(prect.y1, seed.y1 + prect.height * margin),
    )
    pix = page.get_pixmap(clip=roi, matrix=fitz.Matrix(zoom, zoom), colorspace=fitz.csRGB)
    if pix.width < 4 or pix.height < 4:
        return None
    rgb = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, 3).astype(np.int32)
    faint = (rgb.min(axis=2) >= 214) & ((rgb.max(axis=2) - rgb.min(axis=2)) < 14)
    rgb[faint] = 255
    lum = (rgb[:, :, 0] * 299 + rgb[:, :, 1] * 587 + rgb[:, :, 2] * 114) // 1000
    mask = (lum < 225) | ((rgb.max(axis=2) - rgb.min(axis=2)) > 40)

    # Негізгі мәтін жолдарын маскадан өшіреміз — өсу оларға өтіп кетпейді
    inner = fitz.Rect(seed.x0 - 2, seed.y0 - 2, seed.x1 + 2, seed.y1 + 2)
    _page_text_lines(page)
    barriers = []
    for top, bottom, left, right, column_left, column_right in _body_text_lines(page):
        # Мәтін жолы бүкіл баған бойынша кедергі — өсу оны айналып өте алмайды
        barriers.append(fitz.Rect(min(left, column_left) - 3, top - 2, max(right, column_right) + 3, bottom + 2))
    for top, bottom, left, right, text in _page_text_lines(page):
        if CAPTION_LINE is not None and CAPTION_LINE.search(text):
            barriers.append(fitz.Rect(left - 2, top - 2, right + 2, bottom + 2))
    for box in barriers:
        common = fitz.Rect(box) & inner
        area = max(1.0, box.width * box.height)
        # Жолдың жартысынан көбі суреттің ішінде болса — ол суреттің өз жазуы
        if common.width > 0 and common.height > 0 and common.width * common.height >= area * 0.5:
            continue
        y0 = min(max(0, int((box.y0 - roi.y0) * zoom)), mask.shape[0])
        y1 = min(max(0, int((box.y1 - roi.y0) * zoom) + 1), mask.shape[0])
        x0 = min(max(0, int((box.x0 - roi.x0) * zoom)), mask.shape[1])
        x1 = min(max(0, int((box.x1 - roi.x0) * zoom) + 1), mask.shape[1])
        if y1 > y0 and x1 > x0:
            mask[y0:y1, x0:x1] = False

    bridge = max(1, int(bridge_pt * zoom))
    joined = _dilate(mask, bridge)

    region = np.zeros_like(mask)
    sy0 = max(0, int((seed.y0 - roi.y0) * zoom))
    sy1 = min(mask.shape[0], int((seed.y1 - roi.y0) * zoom))
    sx0 = max(0, int((seed.x0 - roi.x0) * zoom))
    sx1 = min(mask.shape[1], int((seed.x1 - roi.x0) * zoom))
    region[sy0:sy1, sx0:sx1] = joined[sy0:sy1, sx0:sx1]
    if not region.any():
        return None

    # Морфологиялық реконструкция: тұқымнан бастап байланысты аймақты аламыз
    for _ in range(400):
        grown = _dilate(region, 4) & joined
        if grown.sum() == region.sum():
            break
        region = grown

    rows = np.flatnonzero(region.any(axis=1))
    cols = np.flatnonzero(region.any(axis=0))
    if not rows.size or not cols.size:
        return None

    # Тұқымнан сыртқа қарай алғашқы ақ аралық — шекара. Көрші мәтін бағаны
    # суретпен ақ аралықпен бөлінгендіктен, аймақ оған өтіп кетпейді.
    top_i, bottom_i = int(rows[0]), int(rows[-1])
    left_i, right_i = int(cols[0]), int(cols[-1])
    sy0 = min(max(0, sy0), mask.shape[0] - 1)
    sy1 = min(max(sy0 + 1, sy1), mask.shape[0])
    sx0 = min(max(0, sx0), mask.shape[1] - 1)
    sx1 = min(max(sx0 + 1, sx1), mask.shape[1])
    gutter_x = max(2, int(4.0 * zoom))
    gutter_y = max(2, int(10.0 * zoom))

    def blank_columns(index):
        return not mask[max(0, sy0):sy1, index].any()

    def blank_rows(index):
        return not mask[index, max(0, sx0):sx1].any()

    run = 0
    for x in range(sx0, left_i - 1, -1):
        run = run + 1 if blank_columns(x) else 0
        if run >= gutter_x:
            left_i = x + run
            break
    run = 0
    for x in range(sx1 - 1, right_i + 1):
        run = run + 1 if blank_columns(x) else 0
        if run >= gutter_x:
            right_i = x - run
            break
    run = 0
    for y in range(sy0, top_i - 1, -1):
        run = run + 1 if blank_rows(y) else 0
        if run >= gutter_y:
            top_i = y + run
            break
    run = 0
    for y in range(sy1 - 1, bottom_i + 1):
        run = run + 1 if blank_rows(y) else 0
        if run >= gutter_y:
            bottom_i = y - run
            break
    rows = np.array([top_i, bottom_i])
    cols = np.array([left_i, right_i])
    scale = 1.0 / zoom
    box = fitz.Rect(
        roi.x0 + (cols[0] - bridge) * scale,
        roi.y0 + (rows[0] - bridge) * scale,
        roi.x0 + (cols[-1] + 1 + bridge) * scale,
        roi.y0 + (rows[-1] + 1 + bridge) * scale,
    )
    return box & prect


def _grow_to_gutter(page, seed, limit=0.15, gutter_pt=5.0, limit_y=0.02, step_limit=0.10):
    """Сурет қораптан шығып тұрса (блок-сызбаның жебесі, кодтың соңы), қиындыны
    ақ аралыққа (гуттерге) жеткенше сыртқа кеңейтеді. Жанындағы мәтін суреттен
    ақ аралықпен бөлінгендіктен, оған өтпейді."""
    prect = page.rect
    zoom = ANALYSIS_ZOOM
    outer = fitz.Rect(
        max(prect.x0, seed.x0 - prect.width * limit),
        # Тігінен аз ғана: жоғары-төмендегі абзац пен жазу суретке жақын тұрады
        max(prect.y0, seed.y0 - prect.height * limit_y),
        min(prect.x1, seed.x1 + prect.width * limit),
        min(prect.y1, seed.y1 + prect.height * limit_y),
    )
    pix = page.get_pixmap(clip=outer, matrix=fitz.Matrix(zoom, zoom), colorspace=fitz.csRGB)
    rgb = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, 3).astype(np.int32)
    lum = (rgb[:, :, 0] * 299 + rgb[:, :, 1] * 587 + rgb[:, :, 2] * 114) // 1000
    sat = rgb.max(axis=2) - rgb.min(axis=2)
    content = (lum < 225) | (sat > 40)
    height, width = content.shape
    top = int((seed.y0 - outer.y0) * zoom)
    bottom = int((seed.y1 - outer.y0) * zoom)
    left = int((seed.x0 - outer.x0) * zoom)
    right = int((seed.x1 - outer.x0) * zoom)
    top, left = max(0, top), max(0, left)
    bottom, right = min(height - 1, bottom), min(width - 1, right)
    gutter = max(2, int(gutter_pt * zoom))

    def blank_rows(y0, y1, x0, x1):
        return not content[max(0, y0):max(0, y1), x0:x1 + 1].any()

    def blank_cols(x0, x1, y0, y1):
        return not content[y0:y1 + 1, max(0, x0):max(0, x1)].any()

    # Әр жақты гутер табылғанша кеңейтеміз (бір пиксельден). Шекке дейін гутер
    # табылмаса (жанында мәтін бағаны не түсті фон) — сол жақ орнына қайтады.
    # Алдымен көлденеңінен (қораптың өз биіктігімен), содан соң тігінен: жоғары
    # өсіп абзац жолын қамтыса, ол жол көлденең өсуге кедергі болмауы керек
    # (абзацтың өзі кейін _strip_edge_text арқылы кесіледі).
    start = {"top": top, "bottom": bottom, "left": left, "right": right}
    max_x = int(prect.width * step_limit * zoom)
    max_y = int(prect.height * limit_y * zoom)
    stuck = set()
    for phase in ("x", "y"):
        changed = True
        while changed:
            changed = False
            if phase == "y":
                if "top" not in stuck and top > 0 and not blank_rows(top - gutter, top, left, right):
                    top -= 1
                    changed = True
                    if start["top"] - top > max_y:
                        top, _ = start["top"], stuck.add("top")
                if "bottom" not in stuck and bottom < height - 1 and not blank_rows(bottom + 1, bottom + 1 + gutter, left, right):
                    bottom += 1
                    changed = True
                    if bottom - start["bottom"] > max_y:
                        bottom, _ = start["bottom"], stuck.add("bottom")
                continue
            # Қораптың жоғарғы/төменгі шетінде абзац жолы тұруы мүмкін — көлденең
            # өсу тек ішкі жолдар бойынша тексеріледі
            inner = (bottom - top) // 10
            if "left" not in stuck and left > 0 and not blank_cols(left - gutter, left, top + inner, bottom - inner):
                left -= 1
                changed = True
                if start["left"] - left > max_x:
                    left, _ = start["left"], stuck.add("left")
            if "right" not in stuck and right < width - 1 and not blank_cols(right + 1, right + 1 + gutter, top + inner, bottom - inner):
                right += 1
                changed = True
                if right - start["right"] > max_x:
                    right, _ = start["right"], stuck.add("right")
    scale = 1.0 / zoom
    return fitz.Rect(outer.x0 + left * scale, outer.y0 + top * scale, outer.x0 + (right + 1) * scale, outer.y0 + (bottom + 1) * scale)


def _trim_white(page, seed):
    """Қораптың ішіндегі ақ жиекті алып тастайды (мазмұнға тимейді)."""
    # Қорап кеңейтілмейді: жанындағы мәтін жолы кіріп кетпеуі керек
    area = fitz.Rect(seed) & page.rect
    pix = page.get_pixmap(clip=area, matrix=fitz.Matrix(ANALYSIS_ZOOM, ANALYSIS_ZOOM), colorspace=fitz.csRGB)
    rgb = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, 3).astype(np.int32)
    lum = (rgb[:, :, 0] * 299 + rgb[:, :, 1] * 587 + rgb[:, :, 2] * 114) // 1000
    sat = rgb.max(axis=2) - rgb.min(axis=2)
    content = (lum < 228) | (sat > 35)
    rows = np.where(content.mean(axis=1) > 0.004)[0]
    cols = np.where(content.mean(axis=0) > 0.004)[0]
    if rows.size == 0 or cols.size == 0:
        return None
    pad = 3
    top, bottom = max(0, rows[0] - pad), min(rgb.shape[0] - 1, rows[-1] + pad)
    left, right = max(0, cols[0] - pad), min(rgb.shape[1] - 1, cols[-1] + pad)
    if bottom - top < 20 or right - left < 20:
        return None
    scale = 1.0 / ANALYSIS_ZOOM
    return fitz.Rect(area.x0 + left * scale, area.y0 + top * scale, area.x0 + (right + 1) * scale, area.y0 + (bottom + 1) * scale)
# Мәтін жолының шамамен биіктігі (бет биіктігінің үлесі)
TEXT_LINE_RATIO = 0.021
# Жолақ мәтін емес деп саналуы үшін керекті «суретке тән» пиксель үлесі
PICTURE_FRACTION = 0.10
# Жолда сия бар деп саналатын ең аз үлес
INK_ROW_FRACTION = 0.02
# Бағанда мазмұн бар деп саналатын ең аз үлес
INK_COL_FRACTION = 0.008
# Соңғы қиындыға қосылатын жиек (бет биіктігінің үлесі)
EDGE_PAD = 0.004


def seed_rect(page, box):
    """0-1000 аралығындағы box-ты бет координатасына айналдырады."""
    rect = page.rect
    ymin, xmin, ymax, xmax = box
    return fitz.Rect(
        rect.x0 + rect.width * (xmin / 1000.0),
        rect.y0 + rect.height * (ymin / 1000.0),
        rect.x0 + rect.width * (xmax / 1000.0),
        rect.y0 + rect.height * (ymax / 1000.0),
    )


def _shrink(mask, radius):
    """Эрозия: жіңішке мәтін штрихтарын жояды, тұтас аймақтарды қалдырады."""
    result = mask
    for axis in (0, 1):
        current = result
        for offset in range(1, radius + 1):
            current = current & np.roll(result, offset, axis=axis)
            current = current & np.roll(result, -offset, axis=axis)
        result = current
    return result


def _bands(mask, max_gap):
    """Ақ аралықтары max_gap-тан аспайтын үздіксіз жолақтарды қайтарады."""
    result = []
    start = None
    gap = 0

    for index, value in enumerate(mask):
        if value:
            if start is None:
                start = index
            gap = 0
        elif start is not None:
            gap += 1
            if gap > max_gap:
                result.append((start, index - gap))
                start = None
                gap = 0

    if start is not None:
        result.append((start, len(mask) - 1))

    return [(a, b) for a, b in result if b >= a]


def _analyse(page, seed):
    """Мазмұн бойынша нақтыланған тіктөртбұрышты қайтарады (немесе None)."""
    prect = page.rect
    area = fitz.Rect(
        max(prect.x0, seed.x0 - prect.width * PAD_X),
        max(prect.y0, seed.y0 - prect.height * PAD_Y),
        min(prect.x1, seed.x1 + prect.width * PAD_X),
        min(prect.y1, seed.y1 + prect.height * PAD_Y),
    )

    if area.width < 8 or area.height < 8:
        return None

    pix = page.get_pixmap(
        clip=area, matrix=fitz.Matrix(ANALYSIS_ZOOM, ANALYSIS_ZOOM), colorspace=fitz.csRGB
    )
    rgb = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, 3).astype(np.int32)

    height, width = rgb.shape[0], rgb.shape[1]
    if height < 32 or width < 32:
        return None

    lum = (rgb[:, :, 0] * 299 + rgb[:, :, 1] * 587 + rgb[:, :, 2] * 114) // 1000
    sat = rgb.max(axis=2) - rgb.min(axis=2)

    # Қағаз фоны — ең жарық 90-пайыздық шама
    background = float(np.percentile(lum, 90))
    ink = lum < background - 45
    # Түсті немесе жарты реңкті пиксель суретке тән; таза қара мәтін мұнда аз
    pictish = (sat > 60) | ((lum < background - 50) & (lum > background - 185))

    # Скан дақтарын жойып барып жол профилін аламыз
    ink_rows = _shrink(ink, 1).mean(axis=1)
    # Жіктеу үшін эрозияланған масканы аламыз: сканда мәтін де жарты реңкті
    # болып шығады, ал эрозиядан кейін жіңішке штрихтар жоғалып, тек тұтас
    # сурет аймақтары қалады.
    pic_rows = _shrink(pictish, 2).mean(axis=1)

    line_px = max(6.0, prect.height * ANALYSIS_ZOOM * TEXT_LINE_RATIO)
    # Аралық кішкентай болуы керек: әйтпесе мәтін жолдары бір-біріне және
    # суретке жабысып, бәрі бір жолақ болып кетеді
    bands = _bands(ink_rows > INK_ROW_FRACTION, int(max(1, line_px * 0.08)))
    if not bands:
        return None

    def is_text(band):
        top, bottom = band
        if bottom - top + 1 > line_px * 1.5:
            return False
        if float(pic_rows[top:bottom + 1].mean()) >= PICTURE_FRACTION:
            return False
        return True

    # Бастапқы тіктөртбұрышқа тиетін жолақтарды аламыз
    seed_top = (seed.y0 - area.y0) * ANALYSIS_ZOOM
    seed_bottom = (seed.y1 - area.y0) * ANALYSIS_ZOOM

    inside = [
        index
        for index, band in enumerate(bands)
        if min(band[1] + 1, seed_bottom) - max(band[0], seed_top) > 0
    ]
    if not inside:
        return None

    # Шеттеріндегі мәтін жолақтарын (үстіндегі мәтін, астындағы қолтаңба) кесеміз
    first, last = inside[0], inside[-1]
    while first <= last and is_text(bands[first]):
        first += 1
    while last >= first and is_text(bands[last]):
        last -= 1

    if first > last:
        return None

    # Суреттің бастапқы тіктөртбұрыштан асып тұрған бөлігін қайтарамыз
    def is_picture(band):
        top, bottom = band
        if bottom - top + 1 > line_px * 2:
            return True
        return float(pic_rows[top:bottom + 1].mean()) >= PICTURE_FRACTION

    index = first - 1
    while index >= 0 and is_picture(bands[index]) and bands[first][0] - bands[index][1] <= line_px * 1.6:
        first = index
        index -= 1

    index = last + 1
    while index < len(bands) and is_picture(bands[index]) and bands[index][0] - bands[last][1] <= line_px * 1.6:
        last = index
        index += 1

    top, bottom = bands[first][0], bands[last][1]

    strip = ink[top:bottom + 1] | pictish[top:bottom + 1]
    columns = np.where(strip.mean(axis=0) > INK_COL_FRACTION)[0]
    if columns.size == 0:
        return None

    left, right = int(columns[0]), int(columns[-1])

    pad = max(2.0, prect.height * ANALYSIS_ZOOM * EDGE_PAD)
    top = max(0.0, top - pad)
    bottom = min(height - 1.0, bottom + pad)
    left = max(0.0, left - pad)
    right = min(width - 1.0, right + pad)

    if bottom - top < 24 or right - left < 40:
        return None

    scale = 1.0 / ANALYSIS_ZOOM
    return fitz.Rect(
        area.x0 + left * scale,
        area.y0 + top * scale,
        area.x0 + (right + 1) * scale,
        area.y0 + (bottom + 1) * scale,
    )


def native_zoom(page):
    """Бетке салынған скан растрдың өз ажыратымдылығы (пиксель/пункт)."""
    try:
        infos = page.get_image_info()
    except Exception:
        return 0.0
    if not infos:
        return 0.0
    largest = max(infos, key=lambda item: item["width"] * item["height"])
    width_pt = max(1.0, largest["bbox"][2] - largest["bbox"][0])
    return largest["width"] / width_pt


def render_clip(page, clip, target_zoom):
    """Суретті пикселденбей, тегіс ұлғайтып алады.

    Скан төмен ажыратымдылықта (70–100 dpi) болса, MuPDF-тің өзі ұлғайтқанда
    сурет шаршы блоктарға бөлініп кетеді. Сондықтан алдымен сканның өз
    пикселімен аламыз да, Lanczos арқылы тегіс ұлғайтып, жұмсақ өткірлейміз.
    Нейрожелілік ұлғайту (Real-ESRGAN) бұл сканерлерде бет-әлпетті бұрмалап,
    жоқ деталь қосатындықтан қолданылмайды.
    """
    native = native_zoom(page)

    # Векторлық PDF (мәтін мен сызба вектормен салынған) — MuPDF-тің өзі кез
    # келген өлшемде анық салады, сканға арналған тазалау керек емес
    if DIRECT_RENDER or native <= 0 or native >= target_zoom * 0.9:
        pix = page.get_pixmap(clip=clip, matrix=fitz.Matrix(target_zoom, target_zoom), colorspace=fitz.csRGB)
        return Image.frombytes("RGB", (pix.width, pix.height), pix.samples)

    pix = page.get_pixmap(clip=clip, matrix=fitz.Matrix(native, native), colorspace=fitz.csRGB)
    base = deblock(Image.frombytes("RGB", (pix.width, pix.height), pix.samples))

    width = max(1, int(round(clip.width * target_zoom)))
    height = max(1, int(round(clip.height * target_zoom)))
    upscaled = base.resize((width, height), Image.LANCZOS)
    return upscaled.filter(ImageFilter.UnsharpMask(radius=1.4, percent=55, threshold=2))


def deblock(image, strength=7):
    """Сканерден қалған JPEG шаршыларын және шуды тазалайды.

    Төмен ажыратымдылықтағы сканда 8×8 шаршылар мен «шахмат» дақтары бар;
    ұлғайтқанда олар пиксель болып көрінеді. Жергілікті ұқсастық бойынша
    тазалау (non-local means) бөлшекті сақтап, тек сол дақтарды кетіреді.
    """
    try:
        import cv2
    except ImportError:
        return image

    array = cv2.cvtColor(np.asarray(image.convert("RGB")), cv2.COLOR_RGB2BGR)
    clean = cv2.fastNlMeansDenoisingColored(array, None, strength, strength, 5, 15)
    return Image.fromarray(cv2.cvtColor(clean, cv2.COLOR_BGR2RGB))


def crop_figure(pdf_path, page_number, box, target_path, doc=None, exact=False):
    """Беттен суретті қиып алады. box — 0-1000 аралығындағы [ymin,xmin,ymax,xmax].

    exact=True — қорапты қолмен берілген қиынды (мысалы, сызбалы кесте): тек ақ
    жиегі тазаланады, шетіндегі жазу кесілмейді."""
    own = doc is None
    if own:
        doc = fitz.open(pdf_path)

    try:
        page = doc[page_number - 1]
        seed = seed_rect(page, box)

        try:
            # Дәл қорап (figure_boxes.mjs) болса — сурет ақ аралыққа дейін
            # кеңейтіліп, тек ақ жиегі тазаланады
            if exact or page_number in EXACT_PAGES:
                # Қорап дәл қолданылады: көршілес бағанға не ұяшыққа өсіп кетпейді
                refined = _trim_white(page, seed)
            else:
                # Модельдің қорабы жуық — суреттің толық аймағы пиксель бойынша
                # қалпына келтіріледі
                extent = _figure_extent(page, seed)
                if extent is None:
                    extent = _grow_to_gutter(page, seed) if TIGHT_CROP else _analyse(page, seed)
                refined = _trim_white(page, extent)
        except Exception:
            refined = None

        clip = refined if refined is not None else seed
        # Бір жол кесілгенде, одан кейінгі жол ғана жаңа шетке шығады (оны
        # бірінші өтуде Tesseract оқымауы мүмкін) — сондықтан бірнеше рет өтеміз.
        # Қорабы дәл деп белгіленген бетте жиегі кесілмейді.
        for _ in range(4 if EDGE_TEXT and page_number not in NO_STRIP_PAGES and not exact else 0):
            try:
                stripped = _strip_edge_text(page, clip)
            except Exception:
                stripped = clip
            if stripped is None:
                # Қиындыда тек жазу бар — сурет жоқ
                if os.environ.get("JUZ_CROP_DEBUG"):
                    print("crop dropped: page %d pass %d %s" % (page_number, _, [round(v) for v in clip]), file=sys.stderr)
                return None
            if stripped == clip:
                break
            # Кесілген соң ақ жиекті қайта тазалаймыз
            clip = _trim_white(page, stripped) or stripped
        if os.environ.get("JUZ_CROP_DEBUG"):
            print("crop %s: page %d" % (os.path.basename(target_path), page_number), file=sys.stderr)
        log_path = os.environ.get("JUZ_CROP_LOG")
        if log_path:
            with open(log_path, "a", encoding="utf-8") as log:
                log.write("\t".join([
                    os.path.basename(target_path), str(page_number),
                    "%.2f" % clip.x0, "%.2f" % clip.y0, "%.2f" % clip.x1, "%.2f" % clip.y1,
                ]) + "\n")
        render_clip(page, clip, OUTPUT_ZOOM).save(target_path, format="JPEG", quality=90, optimize=True)
        return clip
    finally:
        if own:
            doc.close()


def detect_alignment(page, clip):
    """Суретті кітаптағыдай орналастыру: жанында мәтін болса — сол/оң жақ.

    Қиынды тұрған жолдарда, оның сыртында мәтін бар-жоғын тексереміз.
    Мәтін тек бір жағында тұрса, сурет сол жақтан тыс қалады да, «float»
    күйіне қойылады. Әйтпесе — ортада, толық ені бойынша.
    """
    prect = page.rect
    if clip.width >= prect.width * 0.6:
        return "center"

    def side_is_text(x0, x1):
        """Қиындының бір жағында шынымен мәтін тұр ма?"""
        if x1 - x0 < prect.width * 0.06:
            return False

        strip = fitz.Rect(x0, clip.y0, x1, clip.y1)
        pix = page.get_pixmap(clip=strip, matrix=fitz.Matrix(1.5, 1.5), colorspace=fitz.csRGB)
        rgb = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, 3).astype(np.int32)
        if rgb.size == 0:
            return False

        lum = (rgb[:, :, 0] * 299 + rgb[:, :, 1] * 587 + rgb[:, :, 2] * 114) // 1000
        sat = rgb.max(axis=2) - rgb.min(axis=2)
        background = float(np.percentile(lum, 90))

        ink = float((lum < background - 45).mean())
        if ink <= 0.02:
            return False

        # Көрші тұрған сурет мәтін болып саналмауы керек
        pictish = (sat > 60) | ((lum < background - 50) & (lum > background - 185))
        return float(_shrink(pictish, 2).mean()) < 0.05

    # Бет жиегін есепке алмаймыз — тек мәтін бағанының аймағы
    margin = prect.width * 0.08
    left = side_is_text(prect.x0 + margin, clip.x0)
    right = side_is_text(clip.x1, prect.x1 - margin)

    if left and not right:
        return "right"
    if right and not left:
        return "left"

    return "center"
