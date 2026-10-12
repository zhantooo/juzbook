# -*- coding: utf-8 -*-
"""Скан суреттеріндегі ашық сұр су таңбасын («АРМАН-ПВ баспасы») кетіреді.

Су таңбасы ақ фонда өте ашық, түссіз сұр болып басылған (жарықтығы ~225–245).
Тек түссіз (R≈G≈B) әрі өте ашық пикселдер ақ түске айналады: түсті бөліктер,
мәтін, сызықтар мен қою сұр элементтер өзгермейді. Шекарада сатылы өтпеу үшін
жұмсақ ауысу (ramp) қолданылады.

Қолдану: python scripts/whiten_watermark.py <суреттер қалтасы> [--deep]
Өңделген файлдар `.whitened.json` ішінде белгіленеді — екінші рет өңделмейді.
"""

import hashlib
import io
import json
import os
import sys

import numpy as np
from PIL import Image

# Осыдан ашық түссіз пиксель — толық ақ; LOW–HIGH аралығы жұмсақ ауысады
HIGH = 232
LOW = 214
# Түссіздік шегі: арналар арасындағы ең үлкен айырма
NEUTRAL = 14


def whiten(image):
    array = np.asarray(image.convert("RGB")).astype(np.float32)
    low = array.min(axis=2)
    spread = array.max(axis=2) - low
    neutral = spread < NEUTRAL
    # 0 (өзгеріссіз) … 1 (толық ақ)
    weight = np.clip((low - LOW) / float(HIGH - LOW), 0.0, 1.0) * neutral
    result = array + (255.0 - array) * weight[..., None]
    return Image.fromarray(np.clip(result, 0, 255).astype(np.uint8))


# Қою су таңбасы (OKULYK сканында ~195–205) тек сызбалы суретте ағартылады:
# фотода бұл деңгей суреттің өз реңкі болуы мүмкін
DEEP_HIGH = 202
DEEP_LOW = 180
# Сызба деп саналу шарты: ақ аясы көп әрі түсті пикселі аз
LINE_ART_WHITE = 0.55
LINE_ART_COLOUR = 0.15


def is_line_art(image):
    array = np.asarray(image.convert("RGB")).astype(np.int16)
    low = array.min(axis=2)
    spread = array.max(axis=2) - low
    return float((low > 246).mean()) >= LINE_ART_WHITE and float((spread >= 25).mean()) < LINE_ART_COLOUR


def file_hash(path):
    with open(path, "rb") as handle:
        return hashlib.md5(handle.read()).hexdigest()


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    folder = sys.argv[1]
    deep = "--deep" in sys.argv
    deep_done = 0
    marker_path = os.path.join(folder, ".whitened.json")
    marker = json.loads(io.open(marker_path, encoding="utf-8").read()) if os.path.exists(marker_path) else {}
    done = 0
    for name in sorted(os.listdir(folder)):
        if not name.lower().endswith(".jpg"):
            continue
        path = os.path.join(folder, name)
        if marker.get(name) == file_hash(path):
            continue
        image = Image.open(path)
        result = whiten(image)
        # Сызбада су таңбасының қою бөлігі де кетеді
        if deep and is_line_art(image):
            global HIGH, LOW
            HIGH, LOW = DEEP_HIGH, DEEP_LOW
            try:
                result = whiten(result)
            finally:
                HIGH, LOW = 232, 214
            deep_done += 1
        result.save(path, format="JPEG", quality=92, optimize=True)
        marker[name] = file_hash(path)
        done += 1
    io.open(marker_path, "w", encoding="utf-8").write(json.dumps(marker, indent=1))
    print("%s: өңделді %d (терең: %d)" % (os.path.basename(folder), done, deep_done))


if __name__ == "__main__":
    main()
