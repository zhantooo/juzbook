/**
 * Сандарды пішімдеу.
 *
 * `toLocaleString` серверде (Node) мен браузерде әртүрлі бөлгіш қоятындықтан
 * React гидратациясы бұзылады: сервер «22 024», браузер «22,024» береді.
 * Сондықтан пішімдеу қолмен жасалады — екі жағында да нәтиже бірдей.
 */

/** Мыңдықты бөліп жазады: 22024 → "22 024" */
export function formatCount(value: number): string {
  const whole = Math.trunc(Math.abs(value)).toString();
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, "\u00a0");
  return value < 0 ? `-${grouped}` : grouped;
}
