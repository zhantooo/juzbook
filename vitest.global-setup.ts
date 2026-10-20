import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

/**
 * Тест дерекқорын дайындайды.
 *
 * Жергілікті `prisma/arena.db` файлына тимейміз: онда әзірлеу деректері мен
 * ондаған мың сұрақ жатыр. Тесттер өз файлында (`prisma/arena-test.db`)
 * жұмыс істейді де, әр жүгірісте нөлден басталады — сондықтан нәтиже
 * алдыңғы жүгірістен тәуелсіз.
 */
const TEST_DB = path.join(process.cwd(), "prisma", "arena-test.db");

export async function setup() {
  delete process.env.TURSO_DATABASE_URL;
  delete process.env.TURSO_AUTH_TOKEN;
  process.env.ARENA_DATABASE_URL = "file:./arena-test.db";

  // Таза бастаймыз
  for (const suffix of ["", "-journal"]) {
    const file = TEST_DB + suffix;
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
    }
  }

  execSync("npx prisma db push --schema=prisma/arena.prisma --skip-generate --accept-data-loss", {
    stdio: "pipe",
    env: { ...process.env, ARENA_DATABASE_URL: "file:./arena-test.db" }
  });
}

export async function teardown() {
  // Файлды қалдырамыз: сәтсіз тесттен кейін ішін қарауға жарайды.
  // Келесі жүгіріс оны бәрібір жойып, қайта құрады.
}
