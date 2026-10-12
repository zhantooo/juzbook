import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { demoAccounts } from "@/lib/demo-catalog";
import { requireSuperAdminUser } from "@/lib/security/auth";

export const runtime = "nodejs";

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: "USER" | "ADMIN" | "SUPERADMIN";
  createdAt: string;
  source: "database" | "demo";
};

function toDemoUserId(email: string) {
  return `demo:${email.toLowerCase()}`;
}

export async function GET(request: Request) {
  const authResult = await requireSuperAdminUser(request);
  if ("response" in authResult) {
    return authResult.response;
  }

  const url = new URL(request.url);
  const query = url.searchParams.get("query")?.trim().toLowerCase() || "";

  const databaseUsers = await prisma.user.findMany({
    where: query
      ? {
          OR: [
            { email: { contains: query, mode: "insensitive" } },
            { name: { contains: query, mode: "insensitive" } }
          ]
        }
      : undefined,
    orderBy: [{ createdAt: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true
    }
  });

  const databaseEmails = new Set(databaseUsers.map((user) => user.email.toLowerCase()));

  const demoUsers: UserRow[] = demoAccounts
    .filter((account) => !databaseEmails.has(account.email.toLowerCase()))
    .filter((account) => {
      if (!query) {
        return true;
      }

      return (
        account.email.toLowerCase().includes(query) ||
        account.name.toLowerCase().includes(query)
      );
    })
    .map((account) => ({
      id: toDemoUserId(account.email),
      name: account.name,
      email: account.email,
      role: account.role,
      createdAt: "2026-01-01T00:00:00.000Z",
      source: "demo"
    }));

  const realUsers: UserRow[] = databaseUsers.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
    source: "database"
  }));

  const users = [...realUsers, ...demoUsers].sort((left, right) => {
    if (left.role === "SUPERADMIN" && right.role !== "SUPERADMIN") {
      return -1;
    }

    if (right.role === "SUPERADMIN" && left.role !== "SUPERADMIN") {
      return 1;
    }

    return left.name.localeCompare(right.name, "kk");
  });

  return NextResponse.json({ users });
}
