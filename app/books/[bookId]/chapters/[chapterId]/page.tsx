import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { ReaderWorkspace } from "@/components/reader/reader-workspace";
import { ReaderPageSkeleton } from "@/components/ui/page-skeletons";
import { getCatalogNavigationFromDatabase, getReaderTopicPayload } from "@/lib/catalog-db";
import type { SubjectRecord } from "@/lib/types";

export const revalidate = 3600;

function formatTopicUpdatedAt(value: unknown) {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
  }

  return new Date().toISOString();
}

async function ChapterPageContent({ bookId, chapterId }: { bookId: string; chapterId: string }) {
  const [subjects, readerPayload] = await Promise.all([
    getCatalogNavigationFromDatabase(),
    getReaderTopicPayload(bookId, chapterId)
  ]);

  if (!readerPayload) {
    notFound();
  }

  // Тақырып өшірілген немесе сілтеме ескірген болса, кітапты жаппай —
  // сол кітаптың бірінші тақырыбына апарамыз.
  if (!readerPayload.chapters.length) {
    const fallbackTopicId = readerPayload.sections
      .flatMap((section) => section.chapters.flatMap((chapterGroup) => chapterGroup.topics))
      .find((topic) => topic.id)?.id;

    if (fallbackTopicId) {
      redirect(`/books/${bookId}/chapters/${fallbackTopicId}`);
    }

    notFound();
  }

  const activeTopic = readerPayload.chapters[0];
  const activeTopicSavedAt = formatTopicUpdatedAt(activeTopic.updatedAt);
  const hydratedSubjects: SubjectRecord[] = subjects.map((subject) => ({
    ...subject,
    books: subject.books.map((book) =>
      book.id === bookId
        ? {
            ...book,
            coverImage: readerPayload.coverImage,
            pdfFileName: readerPayload.pdfFileName,
            hasPdf: readerPayload.hasPdf,
            chapters: book.chapters.map((topic) =>
              topic.id === activeTopic.id
                ? {
                    ...topic,
                    title: activeTopic.title,
                    excerpt: activeTopic.excerpt,
                    content: activeTopic.content,
                    pdfPage: activeTopic.pdfPage,
                    lastSavedAt: activeTopicSavedAt
                  }
                : topic
            ),
            sections: book.sections.map((section) => ({
              ...section,
              chapters: section.chapters.map((chapterGroup) => ({
                ...chapterGroup,
                topics: chapterGroup.topics.map((topic) =>
                  topic.id === activeTopic.id
                    ? {
                        ...topic,
                        title: activeTopic.title,
                        excerpt: activeTopic.excerpt,
                        content: activeTopic.content,
                        pdfPage: activeTopic.pdfPage,
                        lastSavedAt: activeTopicSavedAt
                      }
                    : topic
                )
              }))
            }))
          }
        : book
    )
  }));

  return <ReaderWorkspace bookId={bookId} chapterId={chapterId} initialSubjects={hydratedSubjects} />;
}

export default async function ChapterPage({
  params
}: {
  params: Promise<{ bookId: string; chapterId: string }>;
}) {
  const { bookId, chapterId } = await params;

  return (
    <Suspense fallback={<ReaderPageSkeleton />}>
      <ChapterPageContent bookId={bookId} chapterId={chapterId} />
    </Suspense>
  );
}
