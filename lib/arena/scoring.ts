/**
 * Жекпе-жектегі ұпай санау.
 *
 * Дұрыс жауап үшін тұрақты ұпай беріледі, үстіне жылдамдық бонусы қосылады:
 * ерте жауап берген көбірек алады. Бонус сызықты азаяды — уақыт біткенде нөл.
 * Қате жауап пен үлгермеу ұпай әкелмейді.
 *
 * Функция таза: сервер де, мок қызмет те бірдей нәтиже береді.
 */

/** Сұраққа берілетін уақыт */
export const QUESTION_MS = 15_000;
/** Дұрыс жауаптың өзі қанша тұрады */
export const CORRECT_POINTS = 100;
/** Жылдамдық үшін қосылатын ең көп ұпай */
export const SPEED_BONUS = 50;

export type AnswerOutcome = {
  isCorrect: boolean;
  /** Сұрақ ашылғаннан бері өткен уақыт (мс) */
  elapsedMs: number;
};

/** Жауаптың ұпайы */
export function scoreAnswer({ isCorrect, elapsedMs }: AnswerOutcome): number {
  if (!isCorrect) {
    return 0;
  }

  // Уақыты біткен соң келген жауап дұрыс болса да ұпай әкелмейді
  if (elapsedMs >= QUESTION_MS) {
    return 0;
  }

  const remaining = Math.max(0, QUESTION_MS - Math.max(0, elapsedMs));
  const bonus = Math.round((remaining / QUESTION_MS) * SPEED_BONUS);
  return CORRECT_POINTS + bonus;
}

/** Жауап уақытында келді ме */
export function isInTime(elapsedMs: number): boolean {
  return elapsedMs >= 0 && elapsedMs < QUESTION_MS;
}

/** Матчтың қорытындысы: ұпайы көп ойыншы жеңеді, тең болса — тең */
export function decideWinner(first: number, second: number): "first" | "second" | "draw" {
  if (first > second) {
    return "first";
  }
  if (second > first) {
    return "second";
  }
  return "draw";
}
