import type { Metadata } from "next";
import { ArenaHome } from "@/components/arena/arena-home";
import { listArenaSubjects } from "@/lib/arena/subjects";

export const metadata: Metadata = {
  title: "Арена | JUZBOOK",
  description: "Бір пән бойынша қарсыласпен тікелей жекпе-жек: 10 сұрақ, кім жылдам әрі дәл."
};

// Сұрақ банкі толып жатқандықтан пәндердің қолжетімділігі өзгеріп тұрады,
// сондықтан бет әр сұранымда жаңадан құрылады.
export const dynamic = "force-dynamic";

export default async function ArenaPage() {
  const subjects = await listArenaSubjects();
  return <ArenaHome subjects={subjects} />;
}
