"""Сканерленген PDF беттерін сурет файлдарына айналдырады.

Мәтін қабаты жоқ оқулықтарды тану (OCR) алдында әр бет JPEG болып сақталады.
"""

import io
import json
import os
import sys

import fitz


def render(pdf_path, out_dir, first_page, last_page, zoom, quality):
    os.makedirs(out_dir, exist_ok=True)
    doc = fitz.open(pdf_path)
    last = min(last_page, doc.page_count)

    written = []
    for pno in range(first_page - 1, last):
        target = os.path.join(out_dir, "p%04d.jpg" % (pno + 1))
        if not os.path.exists(target):
            pix = doc[pno].get_pixmap(matrix=fitz.Matrix(zoom, zoom))
            pix.pil_save(target, format="JPEG", quality=quality, optimize=True)
        written.append(target)

    doc.close()
    return written


def main():
    config = json.loads(io.open(sys.argv[1], encoding="utf-8").read())
    files = render(
        config["pdf"],
        config["outDir"],
        config.get("firstPage", 1),
        config.get("lastPage", 10000),
        config.get("zoom", 2.0),
        config.get("quality", 82),
    )
    print("rendered", len(files))


if __name__ == "__main__":
    main()
