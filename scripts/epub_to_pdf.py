# -*- coding: utf-8 -*-
"""Бекітілген қатталымды (fixed-layout) EPUB оқулығын PDF-ке айналдырады.

Кейбір оқулық тек EPUB түрінде берілген. Олардың беті InDesign-нан шыққан
XHTML: мәтіні нағыз (танудың қажеті жоқ), суреттері жеке файл болып жатыр.
Chrome-ды басқарусыз (headless) режимде қолданып, әр бетті PDF-ке басамыз да,
бәрін бір құжатқа жинаймыз. EPUB-тің бір «беті» — қатар тұрған екі бет, сондықтан
ол сол/оң жартыға бөлінеді: содан кейін кітап қалған оқулықтармен бірдей өңделеді.

Қолдану: python scripts/epub_to_pdf.py config.json
config: {"epub": …, "workDir": …, "out": …, "chrome": …, "split": true}
"""

import io
import json
import os
import re
import shutil
import subprocess
import sys
import zipfile

import fitz

# Беттің ішіндегі блоктар transform: scale(0.05) арқылы кішірейтілген, бірақ
# басып шығару кезінде Chrome олардың кішіреймеген өлшемі бойынша бетті
# бөлшектеп жібереді. Сондықтан бет өлшемі қатаң бекітіліп, артығы қиылады.
PAGE_RULE = (
    "<style>@page{size:%(width).2fpx %(height).2fpx;margin:0}"
    "html{margin:0;padding:0;width:%(width).2fpx;height:%(height).2fpx;overflow:hidden}"
    "body{margin:0;padding:0;width:%(width).2fpx;height:%(height).2fpx;"
    "position:relative;overflow:hidden}</style>"
)
INJECTED = re.compile(r"<style>@page\{size:.*?</style>", re.DOTALL)
SIZE = re.compile(r"width:([\d.]+)px;height:([\d.]+)px", re.IGNORECASE)
CHROME_DEFAULT = "C:/Program Files/Google/Chrome/Application/chrome.exe"


def spine_order(work_dir):
    """OPF ішіндегі spine бойынша беттердің ретін қайтарады."""
    opf = None
    for root, _, files in os.walk(work_dir):
        for name in files:
            if name.lower().endswith(".opf"):
                opf = os.path.join(root, name)
                break
        if opf:
            break
    if not opf:
        raise SystemExit("OPF файлы табылмады")

    text = io.open(opf, encoding="utf-8").read()
    manifest = dict(re.findall(r'<item[^>]*id="([^"]+)"[^>]*href="([^"]+)"', text))
    manifest.update({value: key for key, value in re.findall(r'<item[^>]*href="([^"]+)"[^>]*id="([^"]+)"', text)})
    ids = re.findall(r"<itemref[^>]*idref=\"([^\"]+)\"", text)
    base = os.path.dirname(opf)
    pages = []
    for item in ids:
        href = manifest.get(item)
        if href and href.lower().endswith((".xhtml", ".html")):
            pages.append(os.path.normpath(os.path.join(base, href)))
    if not pages:
        pages = sorted(
            os.path.join(root, name)
            for root, _, files in os.walk(work_dir)
            for name in files
            if name.lower().endswith(".xhtml")
        )
    return pages


def page_size(path):
    """Беттің нақты өлшемін body стилінен алады."""
    text = io.open(path, encoding="utf-8", errors="replace").read()
    body = re.search(r"<body[^>]*style=\"([^\"]+)\"", text)
    if body:
        found = SIZE.search(body.group(1))
        if found:
            return float(found.group(1)), float(found.group(2)), text
    return 964.0, 680.0, text


def inject_rule(path, text, width, height):
    """@page ережесін қосып, бетті дәл сол өлшемде басуға мәжбүрлейміз."""
    rule = PAGE_RULE % {"width": width, "height": height}
    if rule in text:
        return
    # Бұрын қосылған ереже болса — жаңасымен алмастырылады
    updated = INJECTED.sub("", text).replace("</head>", rule + "</head>", 1)
    io.open(path, "w", encoding="utf-8").write(updated)


def content_rect(page, zoom=0.5, margin=2.0):
    """Беттегі ақ емес аймақтың қорабы (нүкте өлшемінде)."""
    import numpy as np

    pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom), colorspace=fitz.csGRAY)
    data = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width)
    mask = data < 245
    rows = np.where(mask.any(axis=1))[0]
    columns = np.where(mask.any(axis=0))[0]
    if not len(rows) or not len(columns):
        return page.rect
    rect = fitz.Rect(columns[0] / zoom - margin, rows[0] / zoom - margin,
                     (columns[-1] + 1) / zoom + margin, (rows[-1] + 1) / zoom + margin)
    return rect & page.rect


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    config = json.loads(io.open(sys.argv[1], encoding="utf-8").read())
    work_dir = config["workDir"]
    chrome = config.get("chrome") or CHROME_DEFAULT

    if not os.path.isdir(work_dir) or config.get("reextract"):
        shutil.rmtree(work_dir, ignore_errors=True)
        os.makedirs(work_dir, exist_ok=True)
        zipfile.ZipFile(config["epub"]).extractall(work_dir)
        print("EPUB ашылды:", work_dir)

    pages = spine_order(work_dir)
    print("бет саны:", len(pages))

    parts_dir = os.path.join(work_dir, "_pdf")
    os.makedirs(parts_dir, exist_ok=True)
    parts = []
    for index, path in enumerate(pages, start=1):
        target = os.path.join(parts_dir, "p%04d.pdf" % index)
        parts.append(target)
        if os.path.exists(target) and os.path.getsize(target) > 1000:
            continue
        width, height, text = page_size(path)
        inject_rule(path, text, width, height)
        subprocess.run(
            [chrome, "--headless", "--disable-gpu", "--no-sandbox", "--no-pdf-header-footer",
             "--print-to-pdf-no-header", "--print-to-pdf=" + target,
             "file:///" + path.replace("\\", "/")],
            capture_output=True,
        )
        if index % 20 == 0 or index == len(pages):
            print("  басылды %d/%d" % (index, len(pages)), flush=True)

    book = fitz.open()
    for part in parts:
        if not os.path.exists(part) or os.path.getsize(part) < 1000:
            print("  ЕСКЕРТУ: бос бет —", os.path.basename(part))
            continue
        source = fitz.open(part)
        # Chrome мазмұнды беттің сол жақ-жоғарғы бұрышына кішірейтіп басады,
        # сондықтан бетті емес, мазмұнның өз қорабын қақ бөлеміз — әйтпесе
        # бөлу сызығы мәтін бағанының ортасынан өтіп кетеді.
        rect = content_rect(source[0])
        if config.get("split", True) and rect.width > rect.height:
            middle = rect.x0 + rect.width / 2
            halves = [fitz.Rect(rect.x0, rect.y0, middle, rect.y1),
                      fitz.Rect(middle, rect.y0, rect.x1, rect.y1)]
        else:
            halves = [rect]
        for clip in halves:
            page = book.new_page(width=clip.width, height=clip.height)
            page.show_pdf_page(page.rect, source, 0, clip=clip)
        source.close()

    book.save(config["out"], deflate=True, garbage=3)
    print("дайын: %s, бет %d" % (config["out"], len(book)))
    book.close()


if __name__ == "__main__":
    main()
