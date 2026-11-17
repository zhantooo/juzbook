/**
 * Қай ортада жұмыс істеп тұрғанымызды анықтайды.
 *
 * Неге керек болды: `.env` файлында `DATABASE_URL` жергілікті Postgres-ке
 * бағытталған, ал `.env.production.local` ішінде нағыз өндірістік база
 * тұр. Екеуінде де дерек бірдей көрінеді (2300-дей тақырып), сондықтан
 * қай базамен жұмыс істеп отырғаныңды байқамай қалу оңай. Бір рет сол
 * себептен бүтін бір топтама түзету жергілікті базада қалып қойған.
 *
 * Сондықтан орта енді БІР жерден анықталады да, әкімші бетінде көрініп
 * тұрады, ал қауіпті скрипттер оны тексеріп барып жұмыс істейді.
 */

export type RuntimeEnvironment = "development" | "preview" | "production";

export type EnvironmentInfo = {
  environment: RuntimeEnvironment;
  /** Дерекқордың хосты — құпия бөлігінсіз */
  databaseHost: string;
  /** Адамға көрсетуге арналған қысқа белгі */
  label: string;
  /** Өндіріс пе: қауіпті әрекеттер осыны тексереді */
  isProduction: boolean;
};

/** Қосылым жолынан тек хостты алады. Пайдаланушы аты мен құпиясөз алынбайды. */
function hostOf(url: string | undefined): string {
  const value = (url || "").trim();
  if (!value) {
    return "(белгісіз)";
  }

  // `postgresql://user:pass@host:port/db?params` → `host:port`
  const afterAuth = value.replace(/^[a-z+]+:\/\/(?:[^@/]*@)?/i, "");
  const host = afterAuth.split(/[/?]/)[0] || "";
  return host || "(белгісіз)";
}

const LOCAL_HOSTS = ["localhost", "127.0.0.1", "[::1]", "host.docker.internal", "db"];

export function resolveEnvironment(env: NodeJS.ProcessEnv = process.env): EnvironmentInfo {
  const databaseHost = hostOf(env.DATABASE_URL);
  const bare = databaseHost.split(":")[0];
  const isLocalDatabase = LOCAL_HOSTS.includes(bare) || bare.endsWith(".localhost") || bare.endsWith(".test");

  /**
   * Шешуші белгі — ДЕРЕКҚОР, қолданбаның өзі қай жерде жүргені емес.
   * Жергілікті серверден өндірістік базаға қосылу да, керісінше де
   * мүмкін, ал қауіп дәл дерекқорда.
   */
  let environment: RuntimeEnvironment;
  if (isLocalDatabase) {
    environment = "development";
  } else if (env.VERCEL_ENV === "production") {
    environment = "production";
  } else if (env.VERCEL_ENV === "preview") {
    environment = "preview";
  } else {
    // Жергілікті емес база, бірақ Vercel-де емеспіз: қашықтағы базамен
    // жұмыс істеп отырмыз, сондықтан өндіріс деп санаған қауіпсіз.
    environment = "production";
  }

  const label =
    environment === "development"
      ? "Әзірлеу"
      : environment === "preview"
        ? "Алдын ала қарау"
        : "ӨНДІРІС";

  return { environment, databaseHost, label, isProduction: environment === "production" };
}

/**
 * Деректі өзгертетін скрипттер үшін қорғаныс.
 *
 * Өндірістік базаға жазбас бұрын `JUZBOOK_ALLOW_PRODUCTION_WRITE=1`
 * айнымалысы талап етіледі. Байқаусыз жүгірту сонда мүмкін болмайды.
 */
export function assertWritable(action: string, env: NodeJS.ProcessEnv = process.env): EnvironmentInfo {
  const info = resolveEnvironment(env);
  if (info.isProduction && env.JUZBOOK_ALLOW_PRODUCTION_WRITE !== "1") {
    throw new Error(
      `«${action}» ӨНДІРІСТІК дерекқорға (${info.databaseHost}) жазбақ болды. ` +
        "Әдейі екеніне көз жеткізіп, JUZBOOK_ALLOW_PRODUCTION_WRITE=1 қойыңыз."
    );
  }
  return info;
}
