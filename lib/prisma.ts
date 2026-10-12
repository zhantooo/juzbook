import { PrismaClient } from "@/generated/prisma-client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaRevision?: string;
};

const PRISMA_CLIENT_REVISION = "2026-06-16-database-stability-fix";

function createPrismaClient() {
  return new PrismaClient({
    log: ["error"]
  });
}

export const prisma =
  globalForPrisma.prisma && globalForPrisma.prismaRevision === PRISMA_CLIENT_REVISION
    ? globalForPrisma.prisma
    : createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaRevision = PRISMA_CLIENT_REVISION;
}
