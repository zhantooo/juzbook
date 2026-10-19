import { notFound } from "next/navigation";
import { ArenaMatchPage } from "@/components/arena/arena-match-page";
import { listArenaSubjects } from "@/lib/arena/subjects";

export const dynamic = "force-dynamic";

export default async function ArenaSubjectPage({ params }: { params: Promise<{ subjectId: string }> }) {
  const { subjectId } = await params;
  const subject = (await listArenaSubjects()).find((item) => item.id === subjectId);

  if (!subject || !subject.playable) {
    notFound();
  }

  return <ArenaMatchPage subjectId={subject.id} subjectName={subject.name} />;
}
