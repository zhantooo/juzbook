# -*- coding: utf-8 -*-
"""Құрастырылған кітапты `docs/kitap-talaptary.md` талаптарына тексереді.

Қолданылуы: python scripts/check_book.py <payload.json>

Әр талап бөлек жолмен, ӨТТІ / ӨТПЕДІ деп шығады.
"""

import io
import json
import re
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_ocr_payload import is_trilingual_term_table


def strip_tags(value):
    return re.sub(r"<[^>]+>", " ", value or "")


def load(payload_path):
    data = json.loads(io.open(payload_path, encoding="utf-8").read())
    return data if isinstance(data, list) else [data]


def iter_topics(book):
    for section in book["sections"]:
        for group in section["groups"]:
            for topic in group["topics"]:
                yield section, group, topic


CHECKS = []


def check(number, title):
    def wrapper(function):
        CHECKS.append((number, title, function))
        return function

    return wrapper


@check(2, "Азат жол мен абзац сақталған")
def check_indent(book, text, topics):
    total = sum(t["content"].count("<p") for t in topics)
    indented = sum(t["content"].count('data-indent="true"') for t in topics)
    ratio = indented / max(1, total)
    return 0.35 <= ratio <= 0.98, "абзац %d, азат жол %d (%.0f%%)" % (total, indented, ratio * 100)


@check(3, "Тасымал біріктірілген")
def check_hyphen(book, text, topics):
    broken = re.findall(r"[а-яәғқңөұүіһ]- [а-яәғқңөұүіһ]", text)
    return len(broken) <= 3, "жол соңындағы үзік: %d" % len(broken)


@check(5, "Колонтитул мен су таңбасы жоқ")
def check_junk(book, text, topics):
    found = re.findall(r"(OKULYK|Все учебники|Книга предоставлена|согласно Приказа)", text, re.IGNORECASE)
    return not found, "табылды: %d" % len(found)


@check(6, "Тест, зерттеу жұмысы қалмаған")
def check_tests(book, text, topics):
    # Тесттің жауап нұсқалары бір тақырыпта кемі үшеу болып қатар тұрады
    # (A, B, C…). Жалғыз «А) H₂ + S → …; Б) …» — химиядағы реакция мысалы,
    # тест емес (қазақ әліпбиімен А, Ә, Б деп реттеледі).
    options = 0
    for topic in topics:
        letters = set(re.findall(r"<p[^>]*>\s*([A-EАВСЕ])\s*\)\s", topic["content"]))
        if len(letters) >= 3:
            options += len(letters)
    headers = re.findall(r"бөлім бойынша (?:тест|зерттеу жұмысы)", text, re.IGNORECASE)
    return not options and not headers, "жауап нұсқасы %d, айдар %d" % (options, len(headers))


@check(19, "§ ішкі тармағы бөлек тақырып болмаған")
def check_inner_points(book, text, topics):
    # Тақырып «2. …» тармағынан басталса, ол қос параграфтың ортасынан бөлінген
    bad = []
    for topic in topics:
        first = re.search(r"<p[^>]*>(.*?)</p>", topic["content"], re.DOTALL)
        if first:
            point = re.match(r"\s*<b>\s*(\d+)\.", first.group(1))
            if point and point.group(1) != "1":
                bad.append(topic["title"][:40])
    return not bad, "ортасынан басталған: %d %s" % (len(bad), bad[:3])


@check(7, "«N-тапсырма» блоктары жоқ")
def check_tasks(book, text, topics):
    found = re.findall(r"\d\s*[-–—.]?\s*тапсырма", text, re.IGNORECASE)
    return not found, "табылды: %d" % len(found)


@check(8, "Бұйрық райдағы тапсырмалар жоқ")
def check_imperative(book, text, topics):
    # Бөлім қорытындысы өткенді еске түсіреді («…таныстыңдар») — тапсырма емес
    text = "\n".join(
        topic["content"] for topic in topics
        if not re.search(
            r"(бөлімге|бөлім\s+бойынша)\s+қорытынды|бөлімн[іи]ң\s+қорытындысы",
            topic["title"],
            re.IGNORECASE,
        )
    )
    # Талап: тапсырма — бұйрық райдағы ҚЫСҚА сөйлем («Эссе жазыңдар») не
    # нөмірленген тармақ («1. …атаңдар»). Ал оқулықтың өз мәтініндегі кеңес
    # («…назар аударыңдар. Өкпе артериясымен…», «Абай болыңдар! Дәрі-дәрмекті…»)
    # ұзын абзацтың ішінде тұрады — ол тапсырма емес, эталон мәтін (1-талап).
    found = []
    for paragraph in re.findall(r"<(?:p|li)[^>]*>(.*?)</(?:p|li)>", text, re.DOTALL):
        plain = re.sub(r"\s+", " ", strip_tags(paragraph)).strip()
        if not plain:
            continue

        words = [
            word
            for word in re.findall(r"\b(\w+(?:ыңдар|іңдер|ңдар|ңдер))\s*[.!]", plain, re.IGNORECASE)
            # Өткен шақ («қарастырдыңдар»), осы шақ («көресіңдер») және күй
            # етістігі («міндеттісіңдер») — бұйрық емес
            if not re.search(r"(д[ыі]ң(дар|дер)|[а-яёәғқңөұүһі]с[ыі]ң(дар|дер))$", word, re.IGNORECASE)
            and word.lower() not in ("заңдар", "өлеңдер", "аңдар", "теңдер", "таңдар", "таныстыңдар")
        ]
        if not words:
            continue

        numbered = bool(re.match(r"^\d+[.)]\s", plain))
        single_short = len(plain) <= 120 and len(re.split(r"(?<=[.!?])\s+", plain)) == 1
        if numbered or single_short:
            found.extend(words)

    return len(found) <= 2, "табылды: %d %s" % (len(found), found[:3])


@check(9, "Сұрақ тізімдері жоқ")
def check_questions(book, text, topics):
    count = 0
    for topic in topics:
        for part in re.findall(r"<p[^>]*>(.*?)</p>", topic["content"], re.DOTALL):
            plain = strip_tags(part).strip()
            if len(plain) < 300 and plain.endswith("?"):
                count += 1
    return count <= 2, "қысқа сұрақ абзац: %d" % count


@check(10, "Оқу мақсаттары жоқ")
def check_objectives(book, text, topics):
    found = re.findall(r"(Бүгінгі сабақта|Оқу мақсаты)", text, re.IGNORECASE)
    # «…жасаймыз.», «…талдаймыз.» — тек қысқа абзацта мақсат; ұзын түсіндірмеде
    # («input.txt атауымен кіру файлын жасаймыз.», «деректерді талдау арқылы
    # түсіндіреміз.») бұл мәтіннің өзі
    for paragraph in re.findall(r"<p[^>]*>(.*?)</p>", text, re.DOTALL):
        plain = strip_tags(paragraph).strip()
        if len(plain) < 200 and re.search(r"(баға береміз|жасаймыз|талдаймыз)\.?$", plain, re.IGNORECASE):
            found.append(plain[:40])
        elif len(plain) < 200 and "талдау арқылы" in plain.lower():
            found.append(plain[:40])
    return not found, "табылды: %d" % len(found)


@check(11, "Тірек сөздер мен тілдер кестесі жоқ")
def check_glossary(book, text, topics):
    # «Ағылшынша» сөзі кәдімгі сөйлемде де кездеседі («ADSL аббревиатурасы
    # ағылшынша …»), сондықтан ол тек үштілді кестенің бағаны ретінде —
    # қасында «Қазақша»/«Орысша» тұрғанда ғана — қате саналады.
    found = re.findall(r"Тірек сөздер", text, re.IGNORECASE)
    # Тірек сөздердің басқа атаулары блоктың тақырыбы ретінде тұрады
    found += re.findall(r"Тірек ұғымдар|Кілт түсініктер", text, re.IGNORECASE)
    for match in re.finditer(r"Ағылшынша", text, re.IGNORECASE):
        window = text[max(0, match.start() - 120):match.end() + 120]
        if re.search(r"Қазақша|Орысша", window, re.IGNORECASE):
            found.append("Ағылшынша")
    # Тақырып жолы жоқ үштілді термин кестесі («Галогендер | Галогены | Halogens»)
    for table in re.findall(r"<table>(.*?)</table>", text, re.DOTALL):
        rows = [
            [strip_tags(cell).strip() for cell in re.findall(r"<t[hd][^>]*>(.*?)</t[hd]>", row, re.DOTALL)]
            for row in re.findall(r"<tr>(.*?)</tr>", table, re.DOTALL)
        ]
        if is_trilingual_term_table(rows):
            found.append("үштілді кесте")
    return not found, "табылды: %d" % len(found)


@check(13, "Суреттердің қолтаңбасы бар")
def check_figures(book, text, topics):
    figures = sum(t["content"].count("<figure") for t in topics)
    captions = sum(t["content"].count("<figcaption") for t in topics)
    return figures == captions, "сурет %d, қолтаңба %d" % (figures, captions)


@check(25, "Кестелер толық (атауы жоқ жол жоқ)")
def check_tables(book, text, topics):
    tables = re.findall(r"<table>(.*?)</table>", text, re.DOTALL)
    orphan = 0
    for table in tables:
        rows = re.findall(r"<tr>(.*?)</tr>", table, re.DOTALL)
        for index, row in enumerate(rows[1:], 1):
            cells = re.findall(r"<t[hd]>(.*?)</t[hd]>", row, re.DOTALL)
            if len(cells) > 1 and not strip_tags(cells[0]).strip() and any(strip_tags(c).strip() for c in cells[1:]):
                # Екі қатарлы тақырып: кітапта бірінші баған ұяшығы екі жолға
                # біріктірілген («Жазба» + астында бос, қалған бағандар аталған).
                # Бұл — OCR жоғалтқан жол емес, сондықтан қате саналмайды.
                # Ішкі атауы жоқ баған бос қалады («Ағза типі | ♀ | ♂ | —»),
                # сондықтан қалған ұяшықтардың кемі біреуі толы болса жеткілікті.
                two_row_header = (
                    index == 1
                    and "<th" in rows[0]
                    and any(strip_tags(cell).strip() for cell in cells[1:])
                )
                if not two_row_header:
                    orphan += 1
    return orphan == 0, "кесте %d, иесіз жол %d" % (len(tables), orphan)


@check(14, "Абзац сурет не блокпен үзілмеген")
def check_split_words(book, text, topics):
    found = re.findall(r"[а-яәғқңөұүіһ]-</p>\s*(?:\[danger|<figure|<table)", text)
    return not found, "үзілген абзац: %d" % len(found)


@check(16, "Суреттің орналасуы белгіленген")
def check_align(book, text, topics):
    counts = {"left": 0, "right": 0, "center": 0}
    for topic in topics:
        for value in re.findall(r'<figure[^>]*data-align="(\w+)"', topic["content"]):
            counts[value] = counts.get(value, 0) + 1
    total = sum(counts.values())
    return total == 0 or counts["left"] + counts["right"] > 0, "сол %d, оң %d, орта %d" % (
        counts["left"],
        counts["right"],
        counts["center"],
    )


@check(20, "Тақырып мәтіні ортасынан басталмайды")
def check_topic_start(book, text, topics):
    bad = []
    for topic in topics:
        first = re.search(r"<p[^>]*>(.*?)</p>", topic["content"], re.DOTALL)
        if not first:
            continue
        plain = strip_tags(first.group(1)).strip()
        if plain and plain[0].islower():
            bad.append(topic["title"][:40])
    return len(bad) <= 1, "кіші әріптен басталады: %d %s" % (len(bad), bad[:3])


@check(21, "Тақырып атаулары дұрыс")
def check_titles(book, text, topics):
    # Бір сөзден тұратын қысқа атау («Хлор», «Ядро») — кітаптағы нағыз § атауы;
    # ал «12-тақырып» — атау табылмағанда құбыр қоятын уақытша белгі
    single_word = re.compile(r"[A-ZА-ЯЁӘҒҚҢӨҰҮҺІ][A-Za-zА-Яа-яЁёӘәҒғҚқҢңӨөҰұҮүҺһІі]{2,}")
    bad = [
        t["title"]
        for t in topics
        if not t["title"]
        or t["title"][0] in "-–—,;:)"
        or t["title"][0].islower()
        or (len(t["title"]) < 8 and not single_word.fullmatch(t["title"]))
        or re.fullmatch(r"\d+-тақырып", t["title"])
    ]
    return not bad, "бүлінген атау: %d %s" % (len(bad), bad[:3])


@check(23, "Кітап атауы бар")
def check_book_title(book, text, topics):
    return bool(book.get("title")), book.get("title", "")


@check(26, "Ескертпе блоктарының атауы дұрыс")
def check_callouts(book, text, topics):
    titles = re.findall(r'\[danger title="([^"]+)"', text)
    unknown = [t for t in set(titles) if len(t) > 40]
    return not unknown, "блок %d, түрі %d" % (len(titles), len(set(titles)))


def main():
    sys.stdout.reconfigure(encoding="utf-8")

    for book in load(sys.argv[1]):
        topics = [topic for _, _, topic in iter_topics(book)]
        text = "\n".join(topic["content"] for topic in topics)

        print("=" * 62)
        print(book["title"])
        print("бөлім %d, тақырып %d, таңба %d" % (len(book["sections"]), len(topics), len(text)))
        print("-" * 62)

        failed = 0
        for number, title, function in sorted(CHECKS):
            try:
                ok, detail = function(book, text, topics)
            except Exception as error:
                ok, detail = False, "қате: %s" % error
            if not ok:
                failed += 1
            print("%2d. %-42s %s  %s" % (number, title, "OTTI  " if ok else "OTPEDI", detail))

        print("-" * 62)
        print("ӨТПЕГЕН ТАЛАП: %d" % failed)


if __name__ == "__main__":
    main()
