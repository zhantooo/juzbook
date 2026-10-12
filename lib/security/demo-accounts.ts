import { demoAccounts } from "@/lib/demo-catalog";

/**
 * Демо аккаунттардың құпиясөздері.
 *
 * Бұрын олар `lib/demo-catalog.ts` ішінде ашық жазулы тұрған. Ол файл
 * клиенттік компоненттерге де импортталатындықтан, құпиясөздер браузер
 * бандліне түсіп, репозиторий арқылы да көрінетін. Енді олар тек `.env`
 * ішінде тұрады да, осы модуль арқылы сервер жағында ғана оқылады.
 *
 * Айнымалы берілмесе, сол аккаунттың демо-логині мүлде істемейді —
 * әдепкі құпиясөз болмағаны қауіпсізірек.
 */
const PASSWORD_ENV: Record<string, string> = {
  "student@juzbook.kz": "DEMO_STUDENT_PASSWORD",
  "admin@juzbook.kz": "DEMO_ADMIN_PASSWORD",
  "superadmin@juzbook.kz": "DEMO_SUPERADMIN_PASSWORD"
};

/** Уақыты тұрақты салыстыру: құпиясөзді әріптеп табуға жол бермейді */
function matches(expected: string, given: string) {
  if (expected.length !== given.length) {
    return false;
  }

  let difference = 0;
  for (let index = 0; index < expected.length; index += 1) {
    difference |= expected.charCodeAt(index) ^ given.charCodeAt(index);
  }

  return difference === 0;
}

/**
 * Берілген пошта мен құпиясөз демо аккаунтқа сәйкес келсе, сол аккаунтты
 * қайтарады. Әйтпесе `null`.
 */
export function findDemoAccount(email: string, password: string) {
  const cleanEmail = email.trim().toLowerCase();
  const account = demoAccounts.find((item) => item.email.toLowerCase() === cleanEmail);
  if (!account) {
    return null;
  }

  const variable = PASSWORD_ENV[account.email];
  const expected = variable ? process.env[variable]?.trim() : "";
  if (!expected) {
    return null;
  }

  return matches(expected, password) ? account : null;
}
