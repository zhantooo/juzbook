import { prisma } from "../lib/prisma";

async function main() {
  const deletedTopicsWithoutBook = await prisma.$executeRaw`
    DELETE FROM "Chapter" AS topic
    WHERE NOT EXISTS (
      SELECT 1 FROM "Book" AS book
      WHERE book."id" = topic."bookId"
    )
  `;

  const deletedTopicsWithoutSection = await prisma.$executeRaw`
    DELETE FROM "Chapter" AS topic
    WHERE topic."sectionId" IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM "Section" AS section
        WHERE section."id" = topic."sectionId"
      )
  `;

  const deletedTopicsWithWrongBook = await prisma.$executeRaw`
    DELETE FROM "Chapter" AS topic
    WHERE topic."sectionId" IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM "Section" AS section
        WHERE section."id" = topic."sectionId"
          AND section."bookId" <> topic."bookId"
      )
  `;

  const booksWithoutSections = await prisma.book.findMany({
    where: {
      sections: {
        none: {}
      }
    },
    select: {
      id: true
    }
  });

  let createdDefaultSections = 0;

  for (const book of booksWithoutSections) {
    await prisma.section.create({
      data: {
        title: "Негізгі бөлім",
        order: 1,
        bookId: book.id
      }
    });
    createdDefaultSections += 1;
  }

  console.log(
    JSON.stringify(
      {
        deletedTopicsWithoutBook,
        deletedTopicsWithoutSection,
        deletedTopicsWithWrongBook,
        createdDefaultSections
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error("Каталог байланыстарын тазалау кезінде қате пайда болды.", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
