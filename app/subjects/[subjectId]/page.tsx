import { Suspense } from "react";
import { notFound } from "next/navigation";
import { SubjectPageClient } from "@/components/subjects/subject-page-client";
import { SubjectPageSkeleton } from "@/components/ui/page-skeletons";
import { getCatalogNavigationFromDatabase } from "@/lib/catalog-db";

export const revalidate = 3600;

async function SubjectPageContent({ subjectId }: { subjectId: string }) {
  const subjects = await getCatalogNavigationFromDatabase();
  const subject = subjects.find((item) => item.id === subjectId) ?? null;

  if (!subject) {
    notFound();
  }

  return <SubjectPageClient subjectId={subjectId} initialSubject={subject} />;
}

export default async function SubjectPage({
  params
}: {
  params: Promise<{ subjectId: string }>;
}) {
  const { subjectId } = await params;

  return (
    <Suspense fallback={<SubjectPageSkeleton />}>
      <SubjectPageContent subjectId={subjectId} />
    </Suspense>
  );
}
