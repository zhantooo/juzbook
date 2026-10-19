/**
 * Turso кілттерін `.env` файлына жазады.
 *
 * Файлды қолмен өңдеудің орнына бір команда: мәндерді аргумент ретінде
 * береміз де, скрипт оларды тексеріп, дұрыс жолға қояды. Бұрыннан тұрған
 * мән болса, ауыстырылады.
 *
 * node scripts/set_turso_env.mjs "libsql://…" "eyJ…"
 */
import fs from "node:fs";
import path from "node:path";

const ENV_PATH = path.join(process.cwd(), ".env");
const [url, token] = process.argv.slice(2);

if (!url || !token) {
  console.error('қолдану: node scripts/set_turso_env.mjs "libsql://…" "eyJ…"');
  process.exit(1);
}

if (!url.startsWith("libsql://") && !url.startsWith("https://")) {
  console.error("URL libsql:// немесе https:// деп басталуы керек. Turso бетіндегі Database URL-ді көшіріңіз.");
  process.exit(1);
}

if (token.length < 20) {
  console.error("Токен тым қысқа — Turso бетіндегі толық токенді көшіріңіз.");
  process.exit(1);
}

let env = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, "utf8") : "";

function setValue(name, value) {
  const line = `${name}="${value}"`;
  const pattern = new RegExp(`^${name}=.*$`, "m");
  env = pattern.test(env) ? env.replace(pattern, line) : `${env.replace(/\s*$/, "")}\n${line}`;
}

if (!env.includes("# Turso")) {
  env = `${env.replace(/\s*$/, "")}\n\n# Turso — Arena-ның орналастырылған SQLite базасы`;
}
setValue("TURSO_DATABASE_URL", url.trim());
setValue("TURSO_AUTH_TOKEN", token.trim());

fs.writeFileSync(ENV_PATH, `${env.replace(/\s*$/, "")}\n`, "utf8");
console.log("Turso кілттері .env файлына жазылды.");
console.log("Келесі қадам: npm run arena:push && npm run arena:turso");
