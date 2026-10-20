/**
 * Эло рейтингі.
 *
 * Рейтинг әр пәнде бөлек есептеледі: тарихтан шебер болып, химиядан жаңа
 * бастаушы болуға болады. Сондықтан жалпы рейтинг деген жоқ.
 *
 * Модуль таза: дерекқорды да, уақытты да білмейді. Сол себепті оны
 * браузерсіз, базасыз тексеруге болады.
 */

/** Бастапқы рейтинг */
export const START_RATING = 1000;

/**
 * Өзгеріс коэффициенті.
 *
 * 24 — шахматтағы әуесқой деңгейіне жақын мән: бір матч рейтингті ±12-ге
 * жылжытады, сондықтан бір сәтсіз ойын бәрін бұзбайды, бірақ он шақты
 * матчтан кейін нақты деңгей көрінеді.
 */
export const K_FACTOR = 24;

export type MatchResult = "won" | "lost" | "drawn";

/**
 * Күтілген нәтиже: рейтингі жоғары ойыншының жеңу ықтималдығы.
 * 400 ұпай айырма ≈ 10 есе артық мүмкіндік дегенді білдіреді.
 */
export function expectedScore(mine: number, theirs: number): number {
  return 1 / (1 + 10 ** ((theirs - mine) / 400));
}

/** Нәтиженің сандық мәні: жеңіс 1, тең 0.5, жеңіліс 0 */
export function resultValue(result: MatchResult): number {
  if (result === "won") {
    return 1;
  }
  return result === "drawn" ? 0.5 : 0;
}

/**
 * Бірінші ойыншының рейтингі қанша өзгереді.
 *
 * Екінші ойыншы дәл сол шаманы қарама-қарсы бағытта алады — сондықтан
 * жүйедегі ұпайдың жалпы саны өзгермейді.
 */
export function ratingDelta(options: {
  mine: number;
  theirs: number;
  result: MatchResult;
}): number {
  const { mine, theirs, result } = options;
  return Math.round(K_FACTOR * (resultValue(result) - expectedScore(mine, theirs)));
}

/** Екі ойыншының жаңа рейтингі */
export function nextRatings(options: {
  first: number;
  second: number;
  /** Бірінші ойыншының нәтижесі */
  result: MatchResult;
}): { first: number; second: number; delta: number } {
  const delta = ratingDelta({
    mine: options.first,
    theirs: options.second,
    result: options.result
  });

  return {
    first: options.first + delta,
    second: options.second - delta,
    delta
  };
}
