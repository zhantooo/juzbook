#!/usr/bin/env python3
from __future__ import annotations

import argparse
import html
import json
import os
import re
import sqlite3
import statistics
import time
import urllib.error
import urllib.request
import uuid
from dataclasses import asdict, dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Iterable

try:
    import fitz
except ImportError as error:
    raise SystemExit("PyMuPDF табылмады. Осы Python үшін `pip install pymupdf pdfplumber` орындаңыз.") from error

try:
    import pdfplumber
except ImportError as error:
    raise SystemExit("pdfplumber табылмады. Осы Python үшін `pip install pymupdf pdfplumber` орындаңыз.") from error


GEMINI_MODEL = "gemini-2.5-flash"
GEMINI_SYSTEM_INSTRUCTION = (
    "Берілген шикі мәтінді ешбір фактіні өзгертпей, таза HTML форматына келтіріп бер. "
    "Тақырыптарды <h3 class='text-xl font-bold text-gray-800 mt-6 mb-2'>, "
    "абзацтарды <p class='text-gray-600 leading-relaxed mb-4'> қыл. "
    "Анықтамаларды <div class='bg-blue-50 border-l-4 border-blue-500 p-4 my-4 rounded-r font-medium text-blue-900'> блогына сал. "
    "Кестелерді Tailwind-тің әдемі responsive стильдері бар <table> тегіне айналдыр (p-3, border, дефолт стильдерімен). "
    "Жауапта тек HTML болсын, ```html белгісін қоспа."
)


@dataclass
class BookMetadata:
    pdf_path: Path
    subject: str
    title: str
    author: str
    grade: str
    skip_first_pages: int
    skip_last_pages: int


@dataclass
class TextLine:
    page_number: int
    y: float
    text: str
    font_size: float
    is_bold: bool
    is_upper: bool


@dataclass
class PageItem:
    kind: str
    page_number: int
    y: float
    text: str
    font_size: float = 0.0
    is_bold: bool = False
    is_upper: bool = False


@dataclass
class TopicChunk:
    title: str
    content: str
    excerpt: str
    order: int


@dataclass
class ChapterChunk:
    title: str
    order: int
    topics: list[TopicChunk] = field(default_factory=list)


@dataclass
class SectionChunk:
    title: str
    order: int
    chapters: list[ChapterChunk] = field(default_factory=list)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="PDF оқулықтарды JUZBOOK SQLite базасына импорттау.")
    parser.add_argument("pdfs", nargs="+")
    parser.add_argument("--database-url", default=None)
    parser.add_argument("--skip-first", type=int, default=2)
    parser.add_argument("--skip-last", type=int, default=1)
    parser.add_argument("--subject", default="")
    parser.add_argument("--title", default="")
    parser.add_argument("--author", default="")
    parser.add_argument("--grade", default="")
    parser.add_argument("--replace-existing", action="store_true")
    parser.add_argument("--use-gemini-formatting", action="store_true")
    parser.add_argument("--json-output", action="store_true")
    parser.add_argument("--non-interactive", action="store_true")
    return parser.parse_args()


def now_iso() -> str:
    return datetime.utcnow().replace(microsecond=0).isoformat() + "Z"


def generate_id() -> str:
    return uuid.uuid4().hex


def load_env_file(path: Path) -> dict[str, str]:
    if not path.exists():
        return {}

    values: dict[str, str] = {}
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def resolve_database_path(project_root: Path, explicit_url: str | None) -> Path:
    database_url = explicit_url or os.getenv("DATABASE_URL")
    if not database_url:
        for env_name in (".env.local", ".env"):
            database_url = load_env_file(project_root / env_name).get("DATABASE_URL")
            if database_url:
                break

    if not database_url:
        database_url = "file:./dev.db"

    if not database_url.startswith("file:"):
        raise RuntimeError("Импорт тек SQLite `file:` DATABASE_URL арқылы жұмыс істейді.")

    relative_path = database_url.replace("file:", "", 1).strip()
    return (project_root / relative_path).resolve()


def ensure_database_schema(connection: sqlite3.Connection) -> None:
    connection.executescript(
        """
        PRAGMA foreign_keys = ON;

        CREATE TABLE IF NOT EXISTS "User" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "email" TEXT NOT NULL UNIQUE,
          "password" TEXT NOT NULL,
          "name" TEXT NOT NULL,
          "schoolName" TEXT,
          "grade" TEXT,
          "direction" TEXT,
          "role" TEXT NOT NULL,
          "currentStreak" INTEGER NOT NULL DEFAULT 1,
          "lastLoginDate" DATETIME,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" DATETIME NOT NULL
        );

        CREATE TABLE IF NOT EXISTS "Subject" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "name" TEXT NOT NULL UNIQUE,
          "description" TEXT NOT NULL,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" DATETIME NOT NULL
        );

        CREATE TABLE IF NOT EXISTS "Book" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "title" TEXT NOT NULL,
          "coverImage" TEXT,
          "subjectId" TEXT NOT NULL,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" DATETIME NOT NULL,
          CONSTRAINT "Book_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject" ("id") ON DELETE CASCADE ON UPDATE CASCADE
        );

        CREATE TABLE IF NOT EXISTS "Section" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "title" TEXT NOT NULL,
          "order" INTEGER NOT NULL,
          "bookId" TEXT NOT NULL,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" DATETIME NOT NULL,
          CONSTRAINT "Section_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book" ("id") ON DELETE CASCADE ON UPDATE CASCADE
        );

        CREATE TABLE IF NOT EXISTS "SectionChapter" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "title" TEXT NOT NULL,
          "order" INTEGER NOT NULL,
          "sectionId" TEXT NOT NULL,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" DATETIME NOT NULL,
          CONSTRAINT "SectionChapter_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section" ("id") ON DELETE CASCADE ON UPDATE CASCADE
        );

        CREATE TABLE IF NOT EXISTS "Chapter" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "title" TEXT NOT NULL,
          "content" TEXT NOT NULL,
          "excerpt" TEXT NOT NULL,
          "order" INTEGER NOT NULL,
          "bookId" TEXT NOT NULL,
          "sectionId" TEXT,
          "sectionChapterId" TEXT,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" DATETIME NOT NULL,
          CONSTRAINT "Chapter_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
          CONSTRAINT "Chapter_sectionChapterId_fkey" FOREIGN KEY ("sectionChapterId") REFERENCES "SectionChapter" ("id") ON DELETE CASCADE ON UPDATE CASCADE
        );

        CREATE TABLE IF NOT EXISTS "UserProgress" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "userId" TEXT NOT NULL,
          "chapterId" TEXT NOT NULL,
          "isCompleted" BOOLEAN NOT NULL DEFAULT false,
          "updatedAt" DATETIME NOT NULL,
          CONSTRAINT "UserProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
          CONSTRAINT "UserProgress_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter" ("id") ON DELETE CASCADE ON UPDATE CASCADE
        );

        CREATE UNIQUE INDEX IF NOT EXISTS "UserProgress_userId_chapterId_key" ON "UserProgress"("userId", "chapterId");

        CREATE TABLE IF NOT EXISTS "Highlight" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "userId" TEXT NOT NULL,
          "chapterId" TEXT NOT NULL,
          "selectedText" TEXT NOT NULL,
          "paragraphId" TEXT,
          "color" TEXT NOT NULL,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "Highlight_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
          CONSTRAINT "Highlight_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter" ("id") ON DELETE CASCADE ON UPDATE CASCADE
        );

        CREATE TABLE IF NOT EXISTS "Note" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "userId" TEXT NOT NULL,
          "chapterId" TEXT NOT NULL,
          "selectedText" TEXT,
          "paragraphId" TEXT,
          "noteText" TEXT NOT NULL,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "Note_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
          CONSTRAINT "Note_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter" ("id") ON DELETE CASCADE ON UPDATE CASCADE
        );
        """
    )
    connection.commit()


def connect_database(db_path: Path) -> sqlite3.Connection:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(str(db_path))
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    ensure_database_schema(connection)
    return connection


def infer_metadata_from_filename(pdf_path: Path) -> dict[str, str]:
    stem = pdf_path.stem
    normalized = stem.replace("_", " ").replace("-", " ")
    grade_match = re.search(r"(\d+)\s*сынып", normalized, re.IGNORECASE)
    grade = f"{grade_match.group(1)}-сынып" if grade_match else ""

    publisher = ""
    if re.search(r"алматыкітап", normalized, re.IGNORECASE):
        publisher = "Алматыкітап"
    elif re.search(r"арман\s*пв|арманпв", normalized, re.IGNORECASE):
        publisher = "Арман-ПВ"

    title = re.sub(r"\(\d+\)$", "", normalized).strip()
    return {"grade": grade, "publisher": publisher, "title": title}


def prompt_value(label: str, default: str = "", required: bool = True) -> str:
    while True:
        suffix = f" [{default}]" if default else ""
        value = input(f"{label}{suffix}: ").strip()
        result = value or default
        if result or not required:
            return result
        print(f"{label} бос болмауы керек.")


def resolve_metadata(pdf_path: Path, args: argparse.Namespace, index: int, total: int) -> BookMetadata:
    inferred = infer_metadata_from_filename(pdf_path)
    subject = (args.subject or "").strip()
    title = (args.title or inferred["title"] or pdf_path.stem).strip()
    author = (args.author or inferred["publisher"] or "Автор көрсетілмеген").strip()
    grade = (args.grade or inferred["grade"] or "Сынып көрсетілмеген").strip()

    if not args.non_interactive:
        print("\n" + "=" * 72)
        print(f"{index}/{total} кітап: {pdf_path.name}")
        print("=" * 72)
        subject = subject or prompt_value("Пән", "")
        title = prompt_value("Кітап атауы", title)
        author = prompt_value("Автор", author)
        grade = prompt_value("Сынып", grade)
        skip_first = int(prompt_value("Алғашқы өткізілетін бет саны", str(args.skip_first)))
        skip_last = int(prompt_value("Соңғы өткізілетін бет саны", str(args.skip_last)))
    else:
        if not subject:
            raise RuntimeError("Пән таңдалмаған.")
        skip_first = args.skip_first
        skip_last = args.skip_last

    return BookMetadata(
        pdf_path=pdf_path,
        subject=subject,
        title=title,
        author=author,
        grade=grade,
        skip_first_pages=max(skip_first, 0),
        skip_last_pages=max(skip_last, 0)
    )


def clean_cell(value: object) -> str:
    if value is None:
        return ""
    text = str(value)
    text = re.sub(r"\s+", " ", text.replace("\n", " ")).strip()
    return text


def table_to_html(rows: list[list[object]]) -> str:
    cleaned_rows = [[clean_cell(cell) for cell in row] for row in rows if any(clean_cell(cell) for cell in row)]
    if not cleaned_rows:
        return ""

    width = max(len(row) for row in cleaned_rows)
    normalized_rows = [row + [""] * (width - len(row)) for row in cleaned_rows]
    header_cells = "".join(
        f"<th class='border border-slate-300 bg-slate-100 p-3 text-left font-semibold text-slate-800'>{html.escape(cell)}</th>"
        for cell in normalized_rows[0]
    )
    body_rows = normalized_rows[1:] or [[""] * width]
    body_html = "\n".join(
        "<tr>"
        + "".join(
            f"<td class='border border-slate-200 p-3 text-slate-700'>{html.escape(cell)}</td>"
            for cell in row
        )
        + "</tr>"
        for row in body_rows
    )

    return (
        "<div class='my-5 overflow-x-auto rounded-2xl border border-slate-200'>"
        "<table class='min-w-full border-collapse text-sm'>"
        f"<thead><tr>{header_cells}</tr></thead>"
        f"<tbody>{body_html}</tbody>"
        "</table>"
        "</div>"
    )


def normalize_line_text(text: str) -> str:
    return re.sub(r"\s+", " ", text.replace("\xa0", " ")).strip()


def is_bold_span(span: dict) -> bool:
    font_name = str(span.get("font", "")).lower()
    flags = int(span.get("flags", 0))
    return "bold" in font_name or "black" in font_name or bool(flags & 16)


def extract_page_items(metadata: BookMetadata) -> tuple[list[PageItem], list[TextLine]]:
    items: list[PageItem] = []
    lines_for_stats: list[TextLine] = []

    with fitz.open(metadata.pdf_path) as fitz_doc, pdfplumber.open(str(metadata.pdf_path)) as plumber_doc:
        total_pages = len(fitz_doc)
        start_index = min(metadata.skip_first_pages, total_pages)
        end_index = max(start_index, total_pages - metadata.skip_last_pages)

        for page_index in range(start_index, end_index):
            fitz_page = fitz_doc[page_index]
            plumber_page = plumber_doc.pages[page_index]
            table_objects = plumber_page.find_tables()
            table_bboxes = [table.bbox for table in table_objects]

            for table in table_objects:
                table_html = table_to_html(table.extract())
                if table_html:
                    items.append(PageItem(kind="table", page_number=page_index + 1, y=float(table.bbox[1]), text=table_html))

            text_dict = fitz_page.get_text("dict")
            for block in text_dict.get("blocks", []):
                if block.get("type") != 0:
                    continue
                for line in block.get("lines", []):
                    spans = [span for span in line.get("spans", []) if normalize_line_text(str(span.get("text", "")))]
                    if not spans:
                        continue

                    y = min(float(span["bbox"][1]) for span in spans)
                    if any(float(bbox[1]) - 2 <= y <= float(bbox[3]) + 2 for bbox in table_bboxes):
                        continue

                    text = normalize_line_text(" ".join(str(span.get("text", "")).strip() for span in spans))
                    if not text:
                        continue

                    font_size = max(float(span.get("size", 0.0)) for span in spans)
                    bold = any(is_bold_span(span) for span in spans)
                    upper = text == text.upper() and bool(re.search(r"[A-ZА-ЯӘІҢҒҮҰҚӨҺ]", text))
                    line_info = TextLine(page_index + 1, y, text, font_size, bold, upper)
                    lines_for_stats.append(line_info)
                    items.append(PageItem("text", line_info.page_number, line_info.y, line_info.text, line_info.font_size, line_info.is_bold, line_info.is_upper))

    items.sort(key=lambda item: (item.page_number, item.y, 0 if item.kind == "text" else 1))
    return items, lines_for_stats


def heading_candidate(text: str) -> bool:
    words = text.split()
    return 1 <= len(words) <= 16 and len(text) <= 160 and not text.endswith((".", ";", ":", "!", "?"))


def is_upper_heading(text: str) -> bool:
    letters = re.findall(r"[A-Za-zА-Яа-яӘәІіҢңҒғҮүҰұҚқӨөҺһ]", text)
    if len(letters) < 4:
        return False

    upper_letters = [letter for letter in letters if letter.upper() == letter]
    return len(upper_letters) / len(letters) >= 0.85


def is_section_heading(text: str) -> bool:
    normalized = text.strip()
    if not heading_candidate(normalized):
        return False

    return bool(
        re.search(r"\b[IVXLCDM]+\s*[-–.]?\s*БӨЛІМ\b", normalized, re.IGNORECASE)
        or re.search(r"\b\d+\s*[-–.]?\s*БӨЛІМ\b", normalized, re.IGNORECASE)
        or re.search(r"\bБӨЛІМ\b", normalized, re.IGNORECASE)
        or re.search(r"\b(UNIT|MODULE)\b", normalized, re.IGNORECASE)
    )


def is_chapter_heading(text: str) -> bool:
    normalized = text.strip()
    if not heading_candidate(normalized):
        return False

    return bool(
        re.match(r"^§\s*\d+", normalized)
        or re.search(r"\b[IVXLCDM]+\s*[-–.]?\s*ТАРАУ\b", normalized, re.IGNORECASE)
        or re.search(r"\b\d+\s*[-–.]?\s*ТАРАУ\b", normalized, re.IGNORECASE)
        or re.search(r"\bТАРАУ\b", normalized, re.IGNORECASE)
        or (is_upper_heading(normalized) and len(normalized) <= 120)
    )


def is_topic_heading(item: PageItem, body_size: float) -> bool:
    text = item.text.strip()
    if not heading_candidate(text):
        return False
    if is_section_heading(text) or is_chapter_heading(text):
        return False

    return bool(
        re.match(r"^\d+\.\d+(\.\d+)?\s+", text)
        or re.match(r"^\d+[.)]\s+[A-ZА-ЯӘІҢҒҮҰҚӨҺ]", text)
        or re.search(r"\b(тақырып|сабақ|практикалық жұмыс|зертханалық жұмыс)\b", text, re.IGNORECASE)
        or (item.is_bold and item.font_size >= body_size + 0.4)
    )


def classify_heading(item: PageItem, body_size: float) -> str | None:
    text = item.text.strip()
    if not heading_candidate(text):
        return None
    if is_section_heading(text):
        return "section"
    if is_chapter_heading(text):
        return "chapter"
    if is_topic_heading(item, body_size):
        return "topic"
    return None


def plain_excerpt(content: str, limit: int = 220) -> str:
    text = re.sub(r"<[^>]+>", " ", content)
    text = re.sub(r"\s+", " ", text).strip()
    return text[:limit].strip()


def strip_code_fence(value: str) -> str:
    cleaned = value.strip()
    cleaned = re.sub(r"^```(?:html)?\s*", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\s*```$", "", cleaned)
    return cleaned.strip()


def local_html_normalize(raw_text: str) -> str:
    blocks = [block.strip() for block in re.split(r"\n{2,}", raw_text) if block.strip()]
    html_blocks: list[str] = []

    for block in blocks:
        if block.startswith("<div") or block.startswith("<table"):
            html_blocks.append(block)
            continue

        escaped = html.escape(block).replace("\n", "<br />")
        if heading_candidate(block) and (is_upper_heading(block) or len(block.split()) <= 8):
            html_blocks.append(f"<h3 class='text-xl font-bold text-gray-800 mt-6 mb-2'>{escaped}</h3>")
        elif re.search(r"\b(анықтама|есте сақта|маңызды)\b", block, re.IGNORECASE):
            html_blocks.append(
                "<div class='bg-blue-50 border-l-4 border-blue-500 p-4 my-4 rounded-r font-medium text-blue-900'>"
                f"{escaped}"
                "</div>"
            )
        else:
            html_blocks.append(f"<p class='text-gray-600 leading-relaxed mb-4'>{escaped}</p>")

    return "\n".join(html_blocks)


def read_gemini_api_key(project_root: Path) -> str:
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if api_key:
        return api_key

    for env_name in (".env.local", ".env"):
        api_key = load_env_file(project_root / env_name).get("GEMINI_API_KEY", "").strip()
        if api_key:
            return api_key

    return ""


def normalize_topic_content(raw_text: str, project_root: Path, use_gemini_formatting: bool) -> str:
    if not use_gemini_formatting:
        return local_html_normalize(raw_text)

    api_key = read_gemini_api_key(project_root)
    if not api_key:
        return local_html_normalize(raw_text)

    endpoint = (
        f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"
        f"?key={api_key}"
    )
    payload = {
        "system_instruction": {
            "parts": [{"text": GEMINI_SYSTEM_INSTRUCTION}]
        },
        "contents": [
            {
                "role": "user",
                "parts": [{"text": raw_text[:28000]}]
            }
        ],
        "generationConfig": {
            "temperature": 0.1,
            "responseMimeType": "text/plain"
        }
    }

    last_error = ""
    for attempt in range(1, 4):
        try:
            request = urllib.request.Request(
                endpoint,
                data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
                headers={"Content-Type": "application/json; charset=utf-8"},
                method="POST"
            )
            with urllib.request.urlopen(request, timeout=90) as response:
                body = json.loads(response.read().decode("utf-8"))

            parts = body.get("candidates", [{}])[0].get("content", {}).get("parts", [])
            html_output = "".join(str(part.get("text", "")) for part in parts).strip()
            if html_output:
                return strip_code_fence(html_output)
            last_error = "Gemini бос жауап қайтарды."
        except urllib.error.HTTPError as error:
            last_error = f"Gemini HTTP {error.code}"
            if error.code in {429, 500, 502, 503, 504} and attempt < 3:
                time.sleep(2)
                continue
            break
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as error:
            last_error = str(error)
            if attempt < 3:
                time.sleep(2)
                continue
            break

    print(f"Gemini өңдеу орындалмады, жергілікті HTML қолданылды: {last_error}")
    return local_html_normalize(raw_text)


def build_structure(metadata: BookMetadata, project_root: Path, use_gemini_formatting: bool) -> list[SectionChunk]:
    items, lines_for_stats = extract_page_items(metadata)
    if not items:
        raise RuntimeError(f"{metadata.pdf_path.name} ішінен импорттайтын мәтін табылмады.")

    body_size = statistics.median([line.font_size for line in lines_for_stats]) if lines_for_stats else 11.0
    sections: list[SectionChunk] = []
    current_section: SectionChunk | None = None
    current_chapter: ChapterChunk | None = None
    current_topic_title: str | None = None
    current_topic_parts: list[str] = []
    section_order = 0
    chapter_order = 0

    def ensure_section() -> SectionChunk:
        nonlocal current_section, section_order, chapter_order
        if current_section is None:
            section_order += 1
            chapter_order = 0
            current_section = SectionChunk(f"{section_order}-Бөлім: Жалпы бөлім", section_order)
            sections.append(current_section)
        return current_section

    def ensure_chapter() -> ChapterChunk:
        nonlocal current_chapter, chapter_order
        section = ensure_section()
        if current_chapter is None:
            chapter_order += 1
            current_chapter = ChapterChunk(f"{chapter_order}-Тарау: Жалпы тарау", chapter_order)
            section.chapters.append(current_chapter)
        return current_chapter

    def flush_topic() -> None:
        nonlocal current_topic_title, current_topic_parts
        raw_content = "\n\n".join(part.strip() for part in current_topic_parts if part.strip()).strip()
        if not raw_content:
            current_topic_title = None
            current_topic_parts = []
            return

        chapter = ensure_chapter()
        title = current_topic_title or f"{len(chapter.topics) + 1}-Тақырып"
        content = normalize_topic_content(raw_content, project_root, use_gemini_formatting)
        chapter.topics.append(TopicChunk(title, content, plain_excerpt(content), len(chapter.topics) + 1))
        current_topic_title = None
        current_topic_parts = []

    for item in items:
        if item.kind == "text":
            heading_type = classify_heading(item, body_size)
            if heading_type == "section":
                flush_topic()
                section_order += 1
                chapter_order = 0
                current_section = SectionChunk(item.text, section_order)
                sections.append(current_section)
                current_chapter = None
                continue
            if heading_type == "chapter":
                flush_topic()
                section = ensure_section()
                chapter_order += 1
                current_chapter = ChapterChunk(item.text, chapter_order)
                section.chapters.append(current_chapter)
                continue
            if heading_type == "topic":
                flush_topic()
                ensure_chapter()
                current_topic_title = item.text
                continue

            if current_topic_title is None and not current_topic_parts:
                current_topic_title = f"{len(ensure_chapter().topics) + 1}-Тақырып"
            current_topic_parts.append(item.text)
        else:
            if current_topic_title is None and not current_topic_parts:
                current_topic_title = f"{len(ensure_chapter().topics) + 1}-Тақырып"
            current_topic_parts.append(item.text)

    flush_topic()
    return [section for section in sections if section.chapters]


def compose_book_title(title: str, author: str, grade: str) -> str:
    base = title.strip()
    if author and author.lower() not in base.lower():
        base = f"{base} - {author}"
    if grade and grade.lower() not in base.lower():
        base = f"{base} ({grade})"
    return base


def get_or_create_subject(connection: sqlite3.Connection, metadata: BookMetadata) -> str:
    row = connection.execute('SELECT id, description FROM "Subject" WHERE lower(name) = lower(?)', (metadata.subject,)).fetchone()
    timestamp = now_iso()
    addition = f"{metadata.title} - {metadata.author} ({metadata.grade})"
    if row:
        description = row["description"] or f"{metadata.subject} пәні."
        if addition not in description:
            description = description.rstrip(". ") + f" | {addition}."
        connection.execute('UPDATE "Subject" SET description = ?, updatedAt = ? WHERE id = ?', (description, timestamp, row["id"]))
        return str(row["id"])

    subject_id = generate_id()
    description = f"{metadata.subject} пәні. Қосылған оқулық: {addition}."
    connection.execute(
        'INSERT INTO "Subject" (id, name, description, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)',
        (subject_id, metadata.subject, description, timestamp, timestamp)
    )
    return subject_id


def delete_existing_book_if_needed(connection: sqlite3.Connection, subject_id: str, book_title: str, replace_existing: bool) -> None:
    existing = connection.execute(
        'SELECT id FROM "Book" WHERE subjectId = ? AND lower(title) = lower(?)',
        (subject_id, book_title)
    ).fetchone()
    if not existing:
        return
    if not replace_existing:
        raise RuntimeError(f'"{book_title}" кітабы базада бар. Қайта жазу үшін "Бар кітапты қайта жазу" қосыңыз.')
    connection.execute('DELETE FROM "Book" WHERE id = ?', (existing["id"],))


def insert_book_tree(connection: sqlite3.Connection, metadata: BookMetadata, sections: list[SectionChunk], replace_existing: bool) -> None:
    subject_id = get_or_create_subject(connection, metadata)
    book_title = compose_book_title(metadata.title, metadata.author, metadata.grade)
    delete_existing_book_if_needed(connection, subject_id, book_title, replace_existing)
    timestamp = now_iso()
    book_id = generate_id()

    connection.execute(
        'INSERT INTO "Book" (id, title, coverImage, subjectId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
        (book_id, book_title, None, subject_id, timestamp, timestamp)
    )

    for section in sections:
        section_id = generate_id()
        connection.execute(
            'INSERT INTO "Section" (id, title, "order", bookId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
            (section_id, section.title, section.order, book_id, timestamp, timestamp)
        )
        for chapter in section.chapters:
            chapter_group_id = generate_id()
            connection.execute(
                'INSERT INTO "SectionChapter" (id, title, "order", sectionId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
                (chapter_group_id, chapter.title, chapter.order, section_id, timestamp, timestamp)
            )
            for topic in chapter.topics:
                connection.execute(
                    'INSERT INTO "Chapter" (id, title, content, excerpt, "order", bookId, sectionId, sectionChapterId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                    (
                        generate_id(),
                        topic.title,
                        topic.content,
                        topic.excerpt,
                        topic.order,
                        book_id,
                        section_id,
                        chapter_group_id,
                        timestamp,
                        timestamp
                    )
                )


def expand_pdf_paths(raw_paths: Iterable[str]) -> list[Path]:
    pdfs: list[Path] = []
    for raw in raw_paths:
        path = Path(raw).expanduser()
        if path.is_dir():
            pdfs.extend(sorted(path.glob("*.pdf")))
        else:
            pdfs.append(path)
    return [pdf.resolve() for pdf in pdfs]


def serialize_sections(sections: list[SectionChunk]) -> list[dict]:
    return [asdict(section) for section in sections]


def main(args: argparse.Namespace) -> int:
    project_root = Path(__file__).resolve().parents[1]
    pdf_paths = expand_pdf_paths(args.pdfs)
    if not pdf_paths:
        raise RuntimeError("Импорттайтын PDF табылмады.")

    if args.json_output:
        books_payload: list[dict] = []
        for index, pdf_path in enumerate(pdf_paths, start=1):
            if not pdf_path.exists():
                raise RuntimeError(f"PDF табылмады: {pdf_path}")

            metadata = resolve_metadata(pdf_path, args, index, len(pdf_paths))
            sections = build_structure(metadata, project_root, args.use_gemini_formatting)
            if not sections:
                raise RuntimeError(f"{pdf_path.name} ішінен бөлім/тарау құрылымы жасалмады.")

            books_payload.append(
                {
                    "subject": metadata.subject,
                    "title": metadata.title,
                    "author": metadata.author,
                    "grade": metadata.grade,
                    "bookTitle": compose_book_title(metadata.title, metadata.author, metadata.grade),
                    "sections": serialize_sections(sections)
                }
            )

        print(json.dumps({"books": books_payload}, ensure_ascii=False))
        return 0

    database_path = resolve_database_path(project_root, args.database_url)
    connection = connect_database(database_path)
    print(f"SQLite база: {database_path}")
    print(
        "Мәтін дизайны: "
        + ("Gemini арқылы өңдеу қосулы." if args.use_gemini_formatting else "жылдам жергілікті HTML форматтау қосулы.")
    )

    try:
        for index, pdf_path in enumerate(pdf_paths, start=1):
            if not pdf_path.exists():
                raise RuntimeError(f"PDF табылмады: {pdf_path}")
            metadata = resolve_metadata(pdf_path, args, index, len(pdf_paths))
            print(f'Өңделіп жатыр: "{metadata.title}"')
            sections = build_structure(metadata, project_root, args.use_gemini_formatting)
            if not sections:
                raise RuntimeError(f"{pdf_path.name} ішінен бөлім/тарау құрылымы жасалмады.")
            insert_book_tree(connection, metadata, sections, args.replace_existing)
            chapter_count = sum(len(section.chapters) for section in sections)
            topic_count = sum(len(chapter.topics) for section in sections for chapter in section.chapters)
            print(f'Дайын: "{metadata.title}" | Пән: {metadata.subject} | Бөлім: {len(sections)} | Тарау: {chapter_count} | Тақырып: {topic_count}')
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()

    print("Барлық кітап сәтті импортталды.")
    return 0


if __name__ == "__main__":
    args = parse_args()
    try:
        raise SystemExit(main(args))
    except KeyboardInterrupt:
        raise SystemExit("Импорт тоқтатылды.")
    except Exception as error:
        raise SystemExit(f"Қате: {error}")
