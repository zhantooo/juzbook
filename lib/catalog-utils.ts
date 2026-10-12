import type { BookRecord, ChapterRecord, SubjectRecord } from "@/lib/types";

export function findSubjectById(subjects: SubjectRecord[], subjectId: string) {
  return subjects.find((subject) => subject.id === subjectId) ?? null;
}

export function findBookById(subjects: SubjectRecord[], bookId: string) {
  for (const subject of subjects) {
    const book = subject.books.find((item) => item.id === bookId);
    if (book) {
      return { subject, book };
    }
  }

  return null;
}

export function getFirstChapter(book: BookRecord): ChapterRecord | null {
  // Тізім оқу ретімен жиналған (бөлім → тарау → тақырып). `order` бойынша
  // сұрыптауға болмайды: ол нөмір әр тарау ішінде 1-ден басталады.
  return book.chapters[0] ?? null;
}

/// Навигация каталогы кітаптың жалпақ `chapters` тізімін жібермейді: ол бөлімдердегі
/// тақырыптардың көшірмесі болғандықтан жауапты екі есе ауырлататын. Каталог контексі
/// дайын болғанша сервер берген деректі осы жерде толықтырып аламыз.
export function withFlatChapters<T extends SubjectRecord>(subjects: T[]): T[] {
  return subjects.map((subject) => ({
    ...subject,
    books: subject.books.map(fillBookChapters)
  }));
}

export function fillBookChapters(book: BookRecord): BookRecord {
  if (book.chapters.length || !book.sections.length) {
    return book;
  }

  return {
    ...book,
    // Аралап шығу реті (бөлім → тарау → тақырып) дұрыс рет болып табылады.
    // `order` бойынша қайта сұрыптаса, тараулардың тақырыптары араласады.
    chapters: book.sections.flatMap((section) =>
      section.chapters.flatMap((chapterGroup) => chapterGroup.topics)
    )
  };
}

