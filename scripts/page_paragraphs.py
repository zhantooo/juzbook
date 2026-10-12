# -*- coding: utf-8 -*-
"""Сканерленген беттен азат жолдарды (абзац шегіністерін) өлшейді.

Танылған мәтінде абзацтар бөлек жол болып келеді, бірақ олардың қайсысы
кітапта шегініспен басталғаны белгісіз. Мұны беттің өз кескінінен көруге
болады: абзацтың бірінші жолы басқа жолдардан оңға жылжып тұрады.
"""

import fitz
import numpy as np

ZOOM = 2.0
# Жолда сия бар деп саналатын үлес
INK_ROW = 0.015
# Бағанда сия бар деп саналатын үлес
INK_COL = 0.02
# Шегініс бет енінің осыншама үлесінен асса — азат жол
INDENT_RATIO = 0.018
# Тым қысқа жолдар (қолтаңба, нөмір) есепке алынбайды
MIN_LINE_RATIO = 0.25
# Бет жиегі
MARGIN_RATIO = 0.06


def _lines(page):
    """Беттегі мәтін жолдарының (сол шеті, оң шеті) тізімін қайтарады."""
    rect = page.rect
    area = fitz.Rect(
        rect.x0 + rect.width * MARGIN_RATIO,
        rect.y0 + rect.height * MARGIN_RATIO,
        rect.x1 - rect.width * MARGIN_RATIO,
        rect.y1 - rect.height * MARGIN_RATIO,
    )

    pix = page.get_pixmap(clip=area, matrix=fitz.Matrix(ZOOM, ZOOM), colorspace=fitz.csGRAY)
    gray = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width).astype(np.int32)
    if gray.size == 0:
        return [], 0

    background = float(np.percentile(gray, 90))
    ink = gray < background - 45

    rows = ink.mean(axis=1)
    bands = []
    start = None
    for index, value in enumerate(rows > INK_ROW):
        if value and start is None:
            start = index
        elif not value and start is not None:
            bands.append((start, index - 1))
            start = None
    if start is not None:
        bands.append((start, len(rows) - 1))

    width = ink.shape[1]
    result = []
    for top, bottom in bands:
        if bottom - top < 4:
            continue
        columns = np.where(ink[top:bottom + 1].mean(axis=0) > INK_COL)[0]
        if columns.size == 0:
            continue
        result.append((int(columns[0]), int(columns[-1])))

    return result, width


def indent_flags(page, paragraph_count):
    """Беттегі әр абзац азат жолмен басталды ма — солардың тізімі.

    Өлшеу нәтижесі абзац санымен сәйкес келмесе, кітаптағы әдеттегі
    жағдайға сүйенеміз: беттің бірінші абзацы алдыңғы беттің жалғасы
    болуы мүмкін, қалғандары азат жолмен басталады.
    """
    if paragraph_count <= 0:
        return []

    try:
        lines, width = _lines(page)
    except Exception:
        lines, width = [], 0

    if not lines or width <= 0:
        return [True] * paragraph_count

    # Тым қысқа жолдарды (қолтаңба, бет нөмірі) есепке алмаймыз
    body = [line for line in lines if (line[1] - line[0]) > width * MIN_LINE_RATIO]
    if len(body) < 3:
        return [True] * paragraph_count

    counts = {}
    for left, _ in body:
        key = round(left / 6.0) * 6.0
        counts[key] = counts.get(key, 0) + 1
    margin = min(key for key in counts if counts[key] == max(counts.values()))

    threshold = margin + width * INDENT_RATIO
    starts = [index for index, (left, _) in enumerate(body) if left > threshold]

    # Жолдардың басым бөлігі «азат жол» болса, өлшем қате — сенбейміз
    if len(starts) > len(body) * 0.55:
        return [True] * paragraph_count

    first_is_continuation = bool(starts) and starts[0] > 0 or not starts

    if len(starts) == paragraph_count:
        # Барлық абзац осы беттен басталған
        return [True] * paragraph_count

    if len(starts) == paragraph_count - 1:
        # Бірінші абзац — алдыңғы беттің жалғасы
        return [False] + [True] * (paragraph_count - 1)

    flags = [True] * paragraph_count
    if first_is_continuation and paragraph_count > 1:
        flags[0] = False
    return flags
