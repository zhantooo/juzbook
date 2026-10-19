import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  outputFileTracingRoot: projectRoot,
  // Тексеру үшін build-ты бөлек бумаға жинауға болады:
  //   NEXT_DIST_DIR=.next-check npm run build
  // Сонда жұмыс істеп тұрған dev сервердің .next бумасы бүлінбейді.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // libsql пакетінің ішінде нативті модуль мен README сияқты файлдар бар:
  // оларды бандлге тартса, құрастыру бұзылады. Сондықтан сервер жағында
  // қалыпты модуль ретінде жүктелсін.
  serverExternalPackages: ["@prisma/adapter-libsql", "@libsql/client", "libsql"],
  images: {
    remotePatterns: []
  }
};

export default nextConfig;
