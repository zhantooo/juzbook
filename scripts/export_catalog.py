#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import sqlite3
from pathlib import Path


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


def resolve_database_path(project_root: Path) -> Path:
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        for env_name in (".env.local", ".env"):
            database_url = load_env_file(project_root / env_name).get("DATABASE_URL")
            if database_url:
                break

    if not database_url:
        database_url = "file:./dev.db"

    if not database_url.startswith("file:"):
        raise RuntimeError("Тек SQLite `file:` DATABASE_URL қолданылады.")

    return (project_root / database_url.replace("file:", "", 1).strip()).resolve()


def rows(connection: sqlite3.Connection, query: str, params: tuple = ()) -> list[sqlite3.Row]:
    return list(connection.execute(query, params).fetchall())


def text(value: object) -> str:
    if value is None:
        return ""

    raw = str(value)
    try:
        fixed = raw.encode("cp1252").decode("utf-8")
        mojibake_marks = ("Ð", "Ñ", "Ò", "Ó", "â", "�")
        if any(mark in raw for mark in mojibake_marks) or fixed.count("�") <= raw.count("�"):
            return fixed
    except UnicodeError:
        pass

    return raw


def export_catalog(project_root: Path) -> dict:
    db_path = resolve_database_path(project_root)
    if not db_path.exists():
        return {"subjects": []}

    connection = sqlite3.connect(str(db_path))
    connection.row_factory = sqlite3.Row

    try:
        subjects = []
        for subject in rows(connection, 'SELECT * FROM "Subject" ORDER BY name ASC'):
            subject_id = subject["id"]
            books = []

            for book in rows(connection, 'SELECT * FROM "Book" WHERE subjectId = ? ORDER BY createdAt DESC', (subject_id,)):
                book_id = book["id"]
                sections = []

                for section in rows(connection, 'SELECT * FROM "Section" WHERE bookId = ? ORDER BY "order" ASC', (book_id,)):
                    section_id = section["id"]
                    chapter_groups = []

                    for chapter_group in rows(
                        connection,
                        'SELECT * FROM "SectionChapter" WHERE sectionId = ? ORDER BY "order" ASC',
                        (section_id,)
                    ):
                        chapter_group_id = chapter_group["id"]
                        topics = []

                        for topic in rows(
                            connection,
                            'SELECT * FROM "Chapter" WHERE sectionChapterId = ? ORDER BY "order" ASC',
                            (chapter_group_id,)
                        ):
                            topics.append(
                                {
                                    "id": topic["id"],
                                    "title": text(topic["title"]),
                                    "order": topic["order"],
                                    "content": text(topic["content"]),
                                    "excerpt": text(topic["excerpt"]),
                                    "bookId": book_id,
                                    "sectionId": section_id,
                                    "chapterGroupId": chapter_group_id,
                                    "originalTitle": text(topic["title"]),
                                    "originalExcerpt": text(topic["excerpt"]),
                                    "originalContent": text(topic["content"]),
                                    "lastSavedAt": topic["updatedAt"]
                                }
                            )

                        chapter_groups.append(
                            {
                                "id": chapter_group_id,
                                "title": text(chapter_group["title"]),
                                "order": chapter_group["order"],
                                "bookId": book_id,
                                "sectionId": section_id,
                                "topics": topics
                            }
                        )

                    sections.append(
                        {
                            "id": section_id,
                            "title": text(section["title"]),
                            "order": section["order"],
                            "bookId": book_id,
                            "chapters": chapter_groups
                        }
                    )

                chapters = [
                    topic
                    for section in sections
                    for chapter_group in section["chapters"]
                    for topic in chapter_group["topics"]
                ]

                books.append(
                    {
                        "id": book_id,
                        "title": text(book["title"]),
                        "subjectId": subject_id,
                        "coverImage": book["coverImage"],
                        "sections": sections,
                        "chapters": chapters
                    }
                )

            subjects.append(
                {
                    "id": subject_id,
                    "name": text(subject["name"]),
                    "description": text(subject["description"]),
                    "books": books
                }
            )

        return {"subjects": subjects}
    finally:
        connection.close()


if __name__ == "__main__":
    root = Path(__file__).resolve().parents[1]
    print(json.dumps(export_catalog(root), ensure_ascii=False))
