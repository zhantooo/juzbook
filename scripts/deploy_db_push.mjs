/**
 * Орналастыру кезінде оқу бөлігінің схемасын дерекқорға шығарады.
 *
 * Неге build ішінде: Vercel-дегі қосылым жолы «Sensitive» болып сақталады —
 * оны жергілікті машинаға шығарып алу мүмкін емес, сондықтан `prisma db push`
 * серверде, деплой кезінде орындалады.
 *
 * Неге `migrate deploy` емес: репозиторийдегі ескі көші-қон (migration)
 * бұзылған, сондықтан жобада әрқашан `db push` қолданылады (AGENTS.md).
 *
 * Қауіпсіздігі: `db push` деректі жоғалтатын өзгерісті өз бетінше істемейді —
 * ондай жағдайда қатемен тоқтайды да, деплой құлайды. Бұл үнсіз жоғалтудан
 * әлдеқайда жақсы.
 *
 * Жергілікті ортада (VERCEL жоқ) ештеңе істемейді.
 */
import { spawn } from "node:child_process";

function resolveDatabaseUrl() {
  const candidates = [
    process.env.DATABASE_URL,
    process.env.POSTGRES_URL,
    process.env.POSTGRES_PRISMA_URL,
    process.env.DATABASE_URL_UNPOOLED,
    process.env.POSTGRES_URL_NON_POOLING
  ];

  for (const candidate of candidates) {
    const value = candidate?.trim();
    if (value && /^postgres(ql)?:\/\//i.test(value)) {
      return value;
    }
  }

  return null;
}

if (!process.env.VERCEL) {
  console.log("[db push] жергілікті орта — өткізілді");
  process.exit(0);
}

const url = resolveDatabaseUrl();

if (!url) {
  console.log("[db push] postgres:// мекенжайы табылмады — өткізілді");
  process.exit(0);
}

console.log("[db push] схема шығарылуда…");

const child = spawn(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["prisma", "db", "push", "--skip-generate"],
  {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: url }
  }
);

child.on("close", (code) => {
  if (code !== 0) {
    console.error("[db push] сәтсіз аяқталды");
  }
  process.exit(code ?? 1);
});
