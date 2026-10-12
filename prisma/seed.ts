import bcrypt from "bcryptjs";
import { PrismaClient } from "../generated/prisma-client";
import { demoAccounts, subjectBlueprints } from "../lib/demo-catalog";

const prisma = new PrismaClient();

async function main() {
  await prisma.passwordResetToken.deleteMany();
  await prisma.bookReadingStat.deleteMany();
  await prisma.userProgress.deleteMany();
  await prisma.highlight.deleteMany();
  await prisma.note.deleteMany();
  await prisma.chapter.deleteMany();
  await prisma.sectionChapter.deleteMany();
  await prisma.section.deleteMany();
  await prisma.book.deleteMany();
  await prisma.subject.deleteMany();
  await prisma.user.deleteMany();

  // Құпиясөздер тек `.env` ішінде тұрады (DEMO_*_PASSWORD). Берілмесе,
  // сол аккаунт құрылмайды — кодта әдепкі құпиясөз болмағаны қауіпсізірек.
  const passwordEnv: Record<string, string> = {
    "student@juzbook.kz": "DEMO_STUDENT_PASSWORD",
    "admin@juzbook.kz": "DEMO_ADMIN_PASSWORD",
    "superadmin@juzbook.kz": "DEMO_SUPERADMIN_PASSWORD"
  };

  for (const account of demoAccounts) {
    const password = process.env[passwordEnv[account.email] ?? ""]?.trim();
    if (!password) {
      console.warn(`${account.email}: ${passwordEnv[account.email]} берілмеген — аккаунт құрылмады`);
      continue;
    }

    await prisma.user.create({
      data: {
        email: account.email,
        password: await bcrypt.hash(password, 10),
        name: account.name,
        schoolName: "",
        grade: "11-сынып",
        direction:
          account.role === "SUPERADMIN" ? "Платформа басқару" : account.role === "ADMIN" ? "Басқару" : "IT бағыты",
        role: account.role,
        currentStreak: 1,
        totalReadingSeconds: account.role === "USER" ? 58 * 60 * 60 : 12 * 60 * 60,
        lastLoginDate: new Date()
      }
    });
  }

  for (const subject of subjectBlueprints) {
    await prisma.subject.create({
      data: {
        id: subject.id,
        name: subject.name,
        description: subject.description,
        books: {
          create: [
            {
              id: subject.bookId,
              title: subject.bookTitle,
              coverImage: subject.coverImage ?? null,
              sections: {
                create: [
                  {
                    id: `${subject.bookId}-section`,
                    title: "Негізгі бөлім",
                    order: 1,
                    chapters: {
                      create: [
                        {
                          id: `${subject.bookId}-chapter-group`,
                          title: "Тақырыптар",
                          order: 1
                        }
                      ]
                    }
                  }
                ]
              },
              chapters: {
                create: subject.chapters.map((chapter, index) => ({
                  id: chapter.id,
                  title: chapter.title,
                  excerpt: chapter.excerpt,
                  content: chapter.content,
                  order: index + 1,
                  sectionId: `${subject.bookId}-section`,
                  sectionChapterId: `${subject.bookId}-chapter-group`
                }))
              }
            }
          ]
        }
      }
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
