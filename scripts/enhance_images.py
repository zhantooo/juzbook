# -*- coding: utf-8 -*-
"""Кітап суреттерінің жиегін анықтайды (топтамалы, GPU арқылы).

`figure_crop.render_clip` суретті тазалап, тегіс ұлғайтады — бірақ ол сәл
жұмсақ болып қалады. Бұл скрипт Real-ESRGAN нәтижесін тек 35% үлеспен
араластырады: жиектер анықталады, ал нейрожеліге толық сенбегендіктен
бет-әлпет пен детальдар бұрмаланбайды.

Қолдану: python scripts/enhance_images.py <суреттер қалтасы> [<қалта> ...]

Өңделген файлдар `.enhanced.json` ішінде белгіленеді — қайта іске
қосқанда екінші рет өңделмейді (суреттер қайта құрылса, белгі өшеді).
"""

import hashlib
import io
import json
import os
import shutil
import subprocess
import sys
import tempfile

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
EXE = os.environ.get(
    "ESRGAN_EXE",
    os.path.join(
        "C:\\", "Users", "user", "AppData", "Local", "Temp", "claude",
        "C--Users-user-Documents-JUZBOOKS", "1a27b6a4-6ea2-49b9-9ed7-82a574e36637",
        "scratchpad", "esrgan", "realesrgan-ncnn-vulkan.exe",
    ),
)
# Сурет ~3 есе ұлғайтылған — нейрожеліге түпнұсқа өлшеміне жуық нұсқасын береміз
SOURCE_SCALE = 3
BLEND = 0.35


def file_hash(path):
    with open(path, "rb") as handle:
        return hashlib.md5(handle.read()).hexdigest()


def enhance_folder(folder):
    marker_path = os.path.join(folder, ".enhanced.json")
    marker = {}
    if os.path.exists(marker_path):
        marker = json.loads(io.open(marker_path, encoding="utf-8").read())

    names = sorted(name for name in os.listdir(folder) if name.lower().endswith(".jpg"))
    # Суреттің хэші белгідегімен бірдей болса — бұрын өңделген
    pending = [name for name in names if marker.get(name) != file_hash(os.path.join(folder, name))]
    if not pending:
        print("%s: барлығы өңделген" % os.path.basename(folder))
        return

    work = tempfile.mkdtemp(prefix="enhance-")
    source_dir = os.path.join(work, "in")
    output_dir = os.path.join(work, "out")
    os.makedirs(source_dir)
    os.makedirs(output_dir)

    try:
        for name in pending:
            image = Image.open(os.path.join(folder, name)).convert("RGB")
            small = image.resize(
                (max(8, image.width // SOURCE_SCALE), max(8, image.height // SOURCE_SCALE)),
                Image.LANCZOS,
            )
            small.save(os.path.join(source_dir, name.replace(".jpg", ".png")))

        subprocess.run(
            [EXE, "-i", source_dir, "-o", output_dir, "-n", "realesrgan-x4plus", "-s", "4", "-f", "png"],
            capture_output=True,
            check=False,
        )

        done = 0
        for name in pending:
            produced = os.path.join(output_dir, name.replace(".jpg", ".png"))
            if not os.path.exists(produced):
                continue
            target = os.path.join(folder, name)
            base = Image.open(target).convert("RGB")
            sharp = Image.open(produced).convert("RGB").resize(base.size, Image.LANCZOS)
            Image.blend(base, sharp, BLEND).save(target, format="JPEG", quality=90, optimize=True)
            marker[name] = file_hash(target)
            done += 1

        io.open(marker_path, "w", encoding="utf-8").write(json.dumps(marker, indent=1))
        print("%s: өңделді %d / %d" % (os.path.basename(folder), done, len(pending)))
    finally:
        shutil.rmtree(work, ignore_errors=True)


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    if not os.path.exists(EXE):
        print("Real-ESRGAN табылмады: %s" % EXE)
        return 1
    for folder in sys.argv[1:]:
        enhance_folder(folder)
    return 0


if __name__ == "__main__":
    sys.exit(main())
