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
  },
  /**
   * Оқулық суреттері.
   *
   * Жергілікті жерде олар `public/books/` ішінде жатыр. Орналастырылған
   * нұсқада ол қалта жоқ (авторлық құқық: репозиторийге салынбайды),
   * сондықтан суреттер сыртқы файл қоймасынан беріледі.
   *
   * `fallback` деп жазылуы маңызды: оқу бетінің мекенжайы да `/books/...`
   * болады (`/books/<кітап>/chapters/<тақырып>`). `afterFiles` ережесі
   * динамикалық маршруттардан БҰРЫН тексеріледі де, оқу бетін де ұстап
   * қалар еді. `fallback` бәрінен кейін тұрады: нақты бет табылса, сол
   * ашылады, ал ешқандай маршрутқа сәйкес келмеген жол (яғни сурет файлы)
   * ғана қоймаға барады.
   *
   * Жергілікті жерде `public/books/` файлдары бұдан да бұрын берілетіндіктен,
   * ереже тіпті қолданылмайды.
   */
  async rewrites() {
    const blobHost = process.env.NEXT_PUBLIC_BOOKS_BLOB_HOST?.trim();
    if (!blobHost) {
      return { beforeFiles: [], afterFiles: [], fallback: [] };
    }

    return {
      beforeFiles: [],
      afterFiles: [],
      fallback: [
        {
          source: "/books/:path*",
          destination: `https://${blobHost}/books/:path*`
        }
      ]
    };
  }
};

export default nextConfig;
