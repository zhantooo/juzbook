import { createClearedSessionResponse } from "@/lib/security/auth";

export const runtime = "nodejs";

export async function POST() {
  return createClearedSessionResponse();
}
