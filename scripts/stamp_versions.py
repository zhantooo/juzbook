# -*- coding: utf-8 -*-
"""Кітап мазмұнындағы сурет сілтемелеріне нұсқа белгісін қояды.

Сурет файлының атауы өзгермесе, браузер (не туннель) ескі нұсқаны кэштен
көрсете береді. Сондықтан әр сілтемеге файлдың хэшінен алынған `?v=…`
белгісі қосылады: сурет өзгерген сайын сілтеме де өзгереді.

Қолдану: python scripts/stamp_versions.py <payload.json> <public түбірі>
"""

import hashlib
import io
import json
import os
import re
import sys

SRC = re.compile(r'src="(/books/[^"?]+\.jpg)(?:\?v=[0-9a-f]+)?"')


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    payload_path, public_root = sys.argv[1], sys.argv[2]
    data = json.loads(io.open(payload_path, encoding="utf-8").read())
    books = data if isinstance(data, list) else [data]
    cache = {}
    stamped = 0

    def replace(match):
        nonlocal stamped
        url = match.group(1)
        if url not in cache:
            path = os.path.join(public_root, url[len("/books/"):].replace("/", os.sep))
            if not os.path.exists(path):
                return match.group(0)
            with open(path, "rb") as handle:
                cache[url] = hashlib.md5(handle.read()).hexdigest()[:8]
        stamped += 1
        return 'src="%s?v=%s"' % (url, cache[url])

    for book in books:
        for section in book["sections"]:
            for group in section["groups"]:
                for topic in group["topics"]:
                    topic["content"] = SRC.sub(replace, topic["content"])

    io.open(payload_path, "w", encoding="utf-8").write(json.dumps(data, ensure_ascii=False, indent=1))
    print("белгі қойылды: %d сілтеме, %d сурет" % (stamped, len(cache)))


if __name__ == "__main__":
    main()
