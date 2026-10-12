import type { TreeStats } from "@/lib/types";

export type TreeStageStep = {
  /** Осы деңгейге өту үшін қажет жалпы сағат */
  hours: number;
  /** Бақтағы реттік нөмір (1–10) */
  level: number;
  title: string;
  emoji: string;
  description: string;
};

/**
 * Пиксель-бақтың 10 деңгейі. Реті canvas генераторындағы ағаш индексімен
 * сәйкес келеді: level N → tree index N-1 (0 — тұқым, 9 — алтын ағаш).
 */
export const stageSteps: TreeStageStep[] = [
  {
    hours: 0,
    level: 1,
    title: "Тұқым",
    emoji: "🌱",
    description: "Топыраққа тұқым себілді. Алғашқы оқу сағаттары жиналып жатыр."
  },
  {
    hours: 2,
    level: 2,
    title: "Өскін",
    emoji: "🌿",
    description: "Жерден алғашқы өскін бой көтерді — оқу ырғағы басталды."
  },
  {
    hours: 5,
    level: 3,
    title: "Көшет",
    emoji: "🪴",
    description: "Көшет тамырын жайып, алғашқы жапырақтарын ашты."
  },
  {
    hours: 10,
    level: 4,
    title: "Жас ағаш",
    emoji: "🌳",
    description: "Діңі бекіп, бұтақтары тарамдала бастады."
  },
  {
    hours: 18,
    level: 5,
    title: "Ағаш",
    emoji: "🌳",
    description: "Ағаш бой түзеп, тәжі қалыңдады. Аралдағы көлеңкесі кеңейді."
  },
  {
    hours: 28,
    level: 6,
    title: "Толық ағаш",
    emoji: "🌳",
    description: "Толыққанды ағаш — тұрақты оқудың айқын белгісі."
  },
  {
    hours: 42,
    level: 7,
    title: "Гүлдеу",
    emoji: "🌸",
    description: "Тәжі гүлге оранды, желмен бірге жапырақтары ұшады."
  },
  {
    hours: 60,
    level: 8,
    title: "Жеміс",
    emoji: "🍎",
    description: "Ағаш жеміс байлады — еңбегіңіздің нақты жемісі."
  },
  {
    hours: 85,
    level: 9,
    title: "Көк терек",
    emoji: "🌲",
    description: "Аралдағы ең биік ағаш. Тәжі аспанмен астасып тұр."
  },
  {
    hours: 120,
    level: 10,
    title: "Алтын ағаш",
    emoji: "✨",
    description: "Алтын жапырақты ағаш — бақтың ең жоғарғы деңгейі."
  }
];

export function formatHours(seconds: number) {
  return (seconds / 3600).toFixed(1);
}

/** Бір ағаштың деңгейін оған құйылған секунд бойынша есептейді */
export function getStageBySeconds(wateredSeconds: number) {
  return getTreeStage({ totalWateredSeconds: wateredSeconds, availableWaterSeconds: 0, lastWateredAt: null });
}

export function getTreeStage(stats: TreeStats) {
  const totalHours = stats.totalWateredSeconds / 3600;
  const lastWateredDays =
    stats.lastWateredAt === null
      ? 0
      : Math.floor((Date.now() - new Date(stats.lastWateredAt).getTime()) / (24 * 60 * 60 * 1000));

  let current = stageSteps[0];
  let next = stageSteps[1];

  for (let index = 0; index < stageSteps.length; index += 1) {
    if (totalHours >= stageSteps[index].hours) {
      current = stageSteps[index];
      next = stageSteps[index + 1] ?? stageSteps[index];
    }
  }

  const lower = current.hours;
  const upper = next.hours === current.hours ? current.hours : next.hours;
  const progressPercent =
    next.hours === current.hours ? 100 : Math.max(0, Math.min(100, ((totalHours - lower) / (upper - lower)) * 100));

  return {
    emoji: current.emoji,
    title: current.title,
    description: current.description,
    level: current.level,
    /** Canvas генераторындағы ағаш индексі (0–9) */
    treeIndex: current.level - 1,
    progressLabel:
      next.hours === current.hours
        ? "Бақ ең жоғары деңгейге жетті"
        : `${next.title} деңгейіне дейін ${Math.max(0, next.hours - totalHours).toFixed(1)} сағат қалды`,
    progressPercent,
    nextGoalHours: next.hours,
    lastWateredDays,
    isWilted: false
  };
}
