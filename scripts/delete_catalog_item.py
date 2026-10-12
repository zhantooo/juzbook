#!/usr/bin/env python3
from __future__ import annotations

import argparse
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


def placeholders(values: list[str]) -> str:
    return ", ".join("?" for _ in values)


def delete_book(connection: sqlite3.Connection, book_id: str) -> int:
    book = connection.execute('SELECT id FROM "Book" WHERE id = ?', (book_id,)).fetchone()
    if not book:
        return 0

    chapter_rows = connection.execute('SELECT id FROM "Chapter" WHERE bookId = ?', (book_id,)).fetchall()
    chapter_ids = [str(row["id"]) for row in chapter_rows]

    if chapter_ids:
        marker = placeholders(chapter_ids)
        connection.execute(f'DELETE FROM "Highlight" WHERE chapterId IN ({marker})', chapter_ids)
        connection.execute(f'DELETE FROM "Note" WHERE chapterId IN ({marker})', chapter_ids)
        connection.execute(f'DELETE FROM "UserProgress" WHERE chapterId IN ({marker})', chapter_ids)

    connection.execute('DELETE FROM "Chapter" WHERE bookId = ?', (book_id,))
    connection.execute(
        'DELETE FROM "SectionChapter" WHERE sectionId IN (SELECT id FROM "Section" WHERE bookId = ?)',
        (book_id,)
    )
    connection.execute('DELETE FROM "Section" WHERE bookId = ?', (book_id,))
    connection.execute('DELETE FROM "Book" WHERE id = ?', (book_id,))
    return 1


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="JUZBOOK каталогынан объект өшіру.")
    parser.add_argument("--kind", choices=["book"], required=True)
    parser.add_argument("--id", required=True)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    project_root = Path(__file__).resolve().parents[1]
    database_path = resolve_database_path(project_root)

    if not database_path.exists():
        raise RuntimeError("SQLite база табылмады.")

    connection = sqlite3.connect(str(database_path))
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")

    try:
        deleted = delete_book(connection, args.id)
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()

    print(f"Өшірілді: {deleted}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        raise SystemExit(f"Қате: {error}")
