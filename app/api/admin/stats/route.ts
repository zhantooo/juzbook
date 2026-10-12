import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/security/auth";

export const runtime = "nodejs";

type SubjectStatsItem = {
  subjectId: string;
  subjectName: string;
  totalSeconds: number;
  readerCount: number;
  books: Array<{
    bookId: string;
    title: string;
    totalSeconds: number;
    readerCount: number;
  }>;
};

function formatTitle(value: string) {
  return value || "Атаусыз";
}

export async function GET(request: Request) {
  const authResult = await requireAdminUser(request);
  if ("response" in authResult) {
    return authResult.response;
  }

  const subjects = await prisma.subject.findMany({
    orderBy: {
      name: "asc"
    },
    select: {
      id: true,
      name: true,
      books: {
        orderBy: {
          title: "asc"
        },
        select: {
          id: true,
          title: true,
          readingStats: {
            select: {
              userId: true,
              totalSeconds: true
            }
          }
        }
      }
    }
  });

  const items: SubjectStatsItem[] = subjects.map((subject) => {
    const books = subject.books.map((book) => {
      const totalSeconds = book.readingStats.reduce((sum, item) => sum + item.totalSeconds, 0);
      const readerCount = new Set(book.readingStats.map((item) => item.userId)).size;

      return {
        bookId: book.id,
        title: formatTitle(book.title),
        totalSeconds,
        readerCount
      };
    });

    return {
      subjectId: subject.id,
      subjectName: formatTitle(subject.name),
      totalSeconds: books.reduce((sum, item) => sum + item.totalSeconds, 0),
      readerCount: new Set(
        subject.books.flatMap((book) => book.readingStats.map((item) => item.userId))
      ).size,
      books
    };
  });

  return NextResponse.json({ items });
}
