# -*- coding: utf-8 -*-
"""Суреттегі мәтіннің бағытын анықтап, қисық тұрғанын түзетеді.

Кітапта карта аңызы немесе кесте бүйіріне қарай (90°) басылып қалатыны бар.
Мұндай блок суретке айналғанда оқылмайтын күйде қалады. Бұл модуль сондай
суреттерді тауып, тік қалпына келтіреді.

Бағыт екі жолмен анықталады:

1. PDF-те мәтін қабаты болса — жол бағыты (`dir`) дәл көрсетеді;
2. Болмаса — суреттің өзінен: мәтін жолдары арасында бос жолақтар болады,
   сондықтан жолдар қай бағытта тұрғанын сия профилінен көруге болады.
"""

import numpy as np
from PIL import Image

# Мәтін бар деп саналатын ең аз сия үлесі
MIN_INK = 0.01
# Сурет (фото) деп саналатын жарты реңк үлесі — ондайды бұрмаймыз
MAX_PICTISH = 0.10
# Жол аралығы бос деп саналатын шек
BLANK_LINE = 0.01
# Бір бағыт екіншісінен қаншалық артық болса, шешім қабылданады
DECISION_MARGIN = 0.12


def _profiles(ink):
    """Жол және баған бойынша бос жолақтардың үлесін қайтарады."""
    rows = ink.mean(axis=1)
    cols = ink.mean(axis=0)
    horizontal = float((rows < BLANK_LINE).mean())
    vertical = float((cols < BLANK_LINE).mean())
    return horizontal, vertical


def _masks(image):
    rgb = np.asarray(image.convert("RGB"), dtype=np.int32)
    lum = (rgb[:, :, 0] * 299 + rgb[:, :, 1] * 587 + rgb[:, :, 2] * 114) // 1000
    sat = rgb.max(axis=2) - rgb.min(axis=2)
    background = float(np.percentile(lum, 90))
    ink = lum < background - 45
    pictish = (sat > 60) | ((lum < background - 50) & (lum > background - 185))
    return ink, pictish


def _line_centroid_score(ink):
    """Мәтін жолдарындағы сияның жоғарыға ығысуы.

    Кириллицада бас әріптер мен x-биіктік жолдың жоғарғы жартысында,
    сондықтан дұрыс бағыттағы мәтінде сия ортадан жоғары тұрады.
    """
    rows = ink.mean(axis=1)
    lines = []
    start = None
    for index, value in enumerate(rows >= BLANK_LINE):
        if value and start is None:
            start = index
        elif not value and start is not None:
            if index - start >= 4:
                lines.append((start, index - 1))
            start = None
    if start is not None and len(rows) - start >= 4:
        lines.append((start, len(rows) - 1))

    if not lines:
        return 0.5

    scores = []
    for top, bottom in lines:
        band = rows[top:bottom + 1]
        total = float(band.sum())
        if total <= 0:
            continue
        positions = np.arange(band.size, dtype=np.float64)
        scores.append(float((band * positions).sum() / total) / max(1.0, band.size - 1))

    return float(np.mean(scores)) if scores else 0.5


def detect_from_image(image):
    """"none" | "cw" | "ccw" — суретті қай жаққа бұру керек."""
    ink, pictish = _masks(image)

    if float(ink.mean()) < MIN_INK:
        return "none"

    horizontal, vertical = _profiles(ink)

    # Мәтін жолдарының арасы бос болады. Егер бос жолақтар тек тік бағытта
    # көрінсе — мәтін бүйіріне қарай тұр. Фотода бос жолақтар екі бағытта
    # да көп болады, сондықтан «көлденеңінен бос жолақ жоқ» шарты маңызды.
    strong = vertical >= 0.12 and horizontal <= 0.06 and vertical - horizontal >= DECISION_MARGIN
    if not strong:
        return "none"

    # Әлсіз жағдайда нағыз фотоны бұрып алмау үшін қосымша тексеру
    if vertical - horizontal < 0.2 and float(pictish.mean()) > MAX_PICTISH:
        return "none"

    # Мәтін тік тұр. Енді қай жаққа бұру керегін анықтаймыз.
    clockwise = np.asarray(image.transpose(Image.ROTATE_270).convert("L"), dtype=np.int32)
    counter = np.asarray(image.transpose(Image.ROTATE_90).convert("L"), dtype=np.int32)

    def ink_of(gray):
        background = float(np.percentile(gray, 90))
        return gray < background - 45

    clockwise_score = _line_centroid_score(ink_of(clockwise))
    counter_score = _line_centroid_score(ink_of(counter))

    # Сия ортадан жоғары тұрған нұсқаны таңдаймыз
    return "cw" if clockwise_score <= counter_score else "ccw"


def direction_from_pdf(page, rect):
    """PDF мәтін қабаты бойынша бағыт: "none" | "cw" | "ccw"."""
    counts = {"none": 0, "cw": 0, "ccw": 0}

    for block in page.get_text("dict")["blocks"]:
        for line in block.get("lines", []):
            bbox = line.get("bbox")
            if not bbox:
                continue
            # Жол қиындының ішінде ме
            if bbox[2] < rect.x0 or bbox[0] > rect.x1 or bbox[3] < rect.y0 or bbox[1] > rect.y1:
                continue

            dx, dy = line.get("dir", (1.0, 0.0))
            length = max(1, len(line.get("spans", [])))

            if abs(dx) >= 0.5:
                counts["none"] += length
            elif dy < 0:
                # Мәтін төменнен жоғары оқылады — сағат тілімен бұрамыз
                counts["cw"] += length
            else:
                counts["ccw"] += length

    best = max(counts, key=lambda key: counts[key])
    return best if counts[best] > 0 else "none"


def rotate(image, direction):
    if direction == "cw":
        return image.transpose(Image.ROTATE_270)
    if direction == "ccw":
        return image.transpose(Image.ROTATE_90)
    return image


def direction_from_placement(page, rect):
    """PDF-ке салынған растр суреттің бұрылысы бойынша бағыт.

    Кітапта карта бетке бүйірінен салынуы мүмкін — ондайда PDF-тегі сурет
    орналасу матрицасы бұрылысты дәл көрсетеді (a≈0, b және c нөл емес).
    """
    counts = {"none": 0, "cw": 0, "ccw": 0}

    try:
        placements = page.get_image_info(xrefs=True)
    except Exception:
        return "none"

    for info in placements:
        bbox = info.get("bbox")
        if not bbox:
            continue
        if bbox[2] < rect.x0 or bbox[0] > rect.x1 or bbox[3] < rect.y0 or bbox[1] > rect.y1:
            continue

        matrix = info.get("transform") or (1, 0, 0, 1, 0, 0)
        a, b, c, d = matrix[0], matrix[1], matrix[2], matrix[3]
        area = max(1.0, (bbox[2] - bbox[0]) * (bbox[3] - bbox[1]))

        if abs(a) >= abs(b) * 0.5 and abs(d) >= abs(c) * 0.5:
            counts["none"] += area
        elif b < 0:
            counts["cw"] += area
        else:
            counts["ccw"] += area

    best = max(counts, key=lambda key: counts[key])
    return best if counts[best] > 0 else "none"
