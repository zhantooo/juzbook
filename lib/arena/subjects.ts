import { arenaPrisma } from "@/lib/arena/db";
import { prisma } from "@/lib/prisma";

/**
 * Arena-да қай пәнде ойнауға болатынын анықтайды.
 *
 * Бір матчта 10 сұрақ беріледі (6 орташа, 2 жеңіл, 2 күрделі). Қайталанбауы
 * үшін банкте одан әлдеқайда көп сұрақ болуы керек, әйтпесе екі матчта бір
 * сұрақ шығады. Сондықтан пән әр деңгей бойынша ең аз мөлшерден өткенде ғана
 * ұсынылады.
 *
 * Пән атаулары оқу бөлігінің дерекқорынан алынады — ол тек бет ашылғанда
 * ғана, матч кезінде емес.
 */

/** Бір матчтағы сұрақ саны және деңгей бойынша бөлінісі */
export const MATCH_QUESTIONS = 10;
export const MATCH_MIX = { medium: 6, easy: 2, hard: 2 } as const;

/** Пән ұсынылуы үшін әр деңгейде болуы керек ең аз сұрақ саны */
const MINIMUM = { medium: 30, easy: 10, hard: 10 } as const;

export type ArenaSubject = {
  id: string;
  name: string;
  description: string;
  total: number;
  counts: { easy: number; medium: number; hard: number };
  playable: boolean;
  /** Ойналмайтын болса — себебі (пайдаланушыға көрсетіледі) */
  reason?: string;
};

/** Пәндердің Arena банкіндегі сұрақ санын деңгей бойынша санайды */
async function countBySubject() {
  const rows = await arenaPrisma.arenaQuestionBank.groupBy({
    by: ["subjectId", "difficulty"],
    _count: { _all: true }
  });

  const counts = new Map<string, { easy: number; medium: number; hard: number }>();
  for (const row of rows) {
    const entry = counts.get(row.subjectId) ?? { easy: 0, medium: 0, hard: 0 };
    if (row.difficulty === "easy" || row.difficulty === "medium" || row.difficulty === "hard") {
      entry[row.difficulty] += row._count._all;
    }
    counts.set(row.subjectId, entry);
  }
  return counts;
}

/** Arena-дағы пәндердің тізімі: ойналатыны да, әзірге дайын еместері де */
export async function listArenaSubjects(): Promise<ArenaSubject[]> {
  const [counts, subjects] = await Promise.all([
    countBySubject(),
    prisma.subject.findMany({
      where: { isHidden: false },
      orderBy: { name: "asc" },
      select: { id: true, name: true, description: true }
    })
  ]);

  return subjects.map((subject) => {
    const entry = counts.get(subject.id) ?? { easy: 0, medium: 0, hard: 0 };
    const total = entry.easy + entry.medium + entry.hard;

    const missing: string[] = [];
    if (entry.medium < MINIMUM.medium) missing.push("орташа");
    if (entry.easy < MINIMUM.easy) missing.push("жеңіл");
    if (entry.hard < MINIMUM.hard) missing.push("күрделі");

    return {
      id: subject.id,
      name: subject.name,
      description: subject.description,
      total,
      counts: entry,
      playable: missing.length === 0,
      reason: missing.length
        ? total === 0
          ? "Бұл пәннің сұрақтары әзірге дайындалып жатыр."
          : `Әзірге жеткіліксіз: ${missing.join(", ")} деңгейдегі сұрақтар аз.`
        : undefined
    };
  });
}

/** Бір пәнде ойнауға бола ма */
export async function isSubjectPlayable(subjectId: string): Promise<boolean> {
  const counts = await countBySubject();
  const entry = counts.get(subjectId);
  if (!entry) {
    return false;
  }
  return entry.medium >= MINIMUM.medium && entry.easy >= MINIMUM.easy && entry.hard >= MINIMUM.hard;
}
