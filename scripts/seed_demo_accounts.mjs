/**
 * Орналастырылған дерекқорға демо аккаунттарды ғана құяды.
 *
 * Arena кіруді талап етеді, ал кіру оқу бөлігінің PostgreSQL-індегі User
 * кестесіне сүйенеді. Сондықтан орналастырылған нұсқада толық оқулық
 * мазмұнының қажеті жоқ — тек аккаунттар керек. Оқулық мазмұны авторлық
 * құқықпен қорғалғандықтан, ол жергілікті күйінде қалады.
 *
 * Құпиясөздер `.env` ішіндегі DEMO_*_PASSWORD айнымалыларынан алынады.
 * Берілмесе, сол аккаунт құрылмайды.
 *
 * DATABASE_URL=<орналастырылған дерекқор> node --env-file=.env scripts/seed_demo_accounts.mjs
 */
import { createRequire } from "node:module";
import { PrismaClient } from "file:///C:/Users/user/Documents/JUZBOOKS/generated/prisma-client/index.js";

const require = createRequire("file:///C:/Users/user/Documents/JUZBOOKS/package.json");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

const ACCOUNTS = [
  { email: "student@juzbook.kz", variable: "DEMO_STUDENT_PASSWORD", role: "USER", name: "Оқушы", direction: "IT бағыты" },
  { email: "admin@juzbook.kz", variable: "DEMO_ADMIN_PASSWORD", role: "ADMIN", name: "Әкімші", direction: "Басқару" },
  {
    email: "superadmin@juzbook.kz",
    variable: "DEMO_SUPERADMIN_PASSWORD",
    role: "SUPERADMIN",
    name: "Бас суперәкімші",
    direction: "Платформа басқару"
  }
];

console.log("дерекқор:", (process.env.DATABASE_URL || "").replace(/(:\/\/[^:]+:)[^@]+@/, "$1<құпия>@"));

let created = 0;
let updated = 0;

for (const account of ACCOUNTS) {
  const password = process.env[account.variable]?.trim();
  if (!password) {
    console.log(`${account.email}: ${account.variable} берілмеген — өткізілді`);
    continue;
  }

  const hash = await bcrypt.hash(password, 10);
  const existing = await prisma.user.findUnique({ where: { email: account.email }, select: { id: true } });

  if (existing) {
    await prisma.user.update({ where: { id: existing.id }, data: { password: hash, role: account.role } });
    updated += 1;
    console.log(`${account.role} ${account.email}: жаңартылды`);
  } else {
    await prisma.user.create({
      data: {
        email: account.email,
        password: hash,
        name: account.name,
        schoolName: "",
        grade: "11-сынып",
        direction: account.direction,
        role: account.role,
        currentStreak: 1,
        totalReadingSeconds: 0,
        lastLoginDate: new Date()
      }
    });
    created += 1;
    console.log(`${account.role} ${account.email}: құрылды`);
  }
}

console.log(`\nқұрылды: ${created} | жаңартылды: ${updated}`);
await prisma.$disconnect();
