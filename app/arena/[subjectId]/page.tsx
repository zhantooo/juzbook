import { notFound } from "next/navigation";
import { ArenaLobby } from "@/components/arena/arena-lobby";
import { listArenaSubjects } from "@/lib/arena/subjects";

export const dynamic = "force-dynamic";

/**
 * Пәннің бөлмесі: қарсыласты осы жерде таңдайды (кездейсоқ, дос, код).
 * Матч басталған соң ғана `/arena/match/<id>` бетіне өтеді.
 */
export default async function ArenaSubjectPage({ params }: { params: Promise<{ subjectId: string }> }) {
  const { subjectId } = await params;
  const subject = (await listArenaSubjects()).find((item) => item.id === subjectId);

  if (!subject || !subject.playable) {
    notFound();
  }

  return <ArenaLobby subjectId={subject.id} subjectName={subject.name} />;
}
