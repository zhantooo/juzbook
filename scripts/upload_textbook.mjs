/**
 * Дайындалған оқулық мазмұнын сайттың каталог API-і арқылы жүктейді.
 *
 * Қолданылуы:
 *   node scripts/upload_textbook.mjs <payload.json> [baseUrl]
 *
 * Әкімші тіркелгісі JUZBOOK_ADMIN_EMAIL / JUZBOOK_ADMIN_PASSWORD арқылы беріледі.
 */

import { readFile } from "node:fs/promises";

const payloadPath = process.argv[2];
const baseUrl = (process.argv[3] || "http://localhost:3000").replace(/\/$/, "");

if (!payloadPath) {
  console.error("payload.json жолы көрсетілмеді.");
  process.exit(1);
}

const email = process.env.JUZBOOK_ADMIN_EMAIL || "admin@juzbook.kz";
const password = process.env.JUZBOOK_ADMIN_PASSWORD;

if (!password) {
  console.error("JUZBOOK_ADMIN_PASSWORD орнатылмаған.");
  process.exit(1);
}

let cookie = "";

async function api(path, options = {}) {
  const response = await fetch(baseUrl + path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
      ...(options.headers || {})
    }
  });

  const setCookie = response.headers.getSetCookie?.() ?? [];
  if (setCookie.length) {
    cookie = setCookie.map((item) => item.split(";")[0]).join("; ");
  }

  const text = await response.text();
  let body = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text.slice(0, 300) };
  }

  if (!response.ok) {
    throw new Error(`${path} → ${response.status}: ${body.error || body.raw || "белгісіз қате"}`);
  }

  return body;
}

async function createEntity(entityType, data) {
  const result = await api("/api/catalog/entities", {
    method: "POST",
    body: JSON.stringify({ entityType, data })
  });
  return result.entity;
}

async function main() {
  const payload = JSON.parse(await readFile(payloadPath, "utf-8"));

  await api("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });
  console.log("Кірдік:", email);

  for (const book of payload) {
    const created = await createEntity("book", {
      subjectId: book.subjectId,
      title: book.title,
      sourceInfo: book.sourceInfo,
      theme: book.theme
    });

    const bookId = created.id;
    console.log(`\nКітап құрылды: ${book.title} (${bookId})`);

    let topicCount = 0;
    for (const section of book.sections) {
      const sectionEntity = await createEntity("section", {
        bookId,
        title: section.title
      });
      console.log(`  Бөлім: ${section.title}`);

      for (const group of section.groups) {
        const groupEntity = await createEntity("chapter-group", {
          sectionId: sectionEntity.id,
          title: group.title
        });

        for (const topic of group.topics) {
          await createEntity("topic", {
            bookId,
            sectionId: sectionEntity.id,
            chapterGroupId: groupEntity.id,
            title: topic.title,
            excerpt: topic.excerpt,
            pdfPage: topic.pdfPage,
            content: topic.content
          });
          topicCount += 1;
          process.stdout.write(`    ${topicCount}. ${topic.title}\n`);
        }
      }
    }

    console.log(`Барлығы: ${topicCount} тақырып`);
  }
}

main().catch((error) => {
  console.error("Қате:", error.message);
  process.exit(1);
});
