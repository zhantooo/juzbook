import { z } from "zod";
import type { ComboCode } from "@/lib/types";
import { sanitizePlainText } from "@/lib/sanitize";

const scriptPattern = /<script[\s\S]*?>[\s\S]*?<\/script>/i;
const javascriptProtocolPattern = /javascript:/i;
const comboCodes = [
  "BIO-CHEM",
  "GEO-BIO",
  "GEO-MATH",
  "GEO-WORLD",
  "WORLD-ENG",
  "GEO-ENG",
  "WORLD-LAW",
  "PHYS-MATH",
  "PHYS-CHEM",
  "INFO-MATH",
  "LIT-LANG",
  "RUSLIT",
  "CREATIVE"
] as const satisfies ReadonlyArray<ComboCode>;

function noExecutableContent(value: string) {
  return !scriptPattern.test(value) && !javascriptProtocolPattern.test(value);
}

function hasDigit(value: string) {
  return /\d/.test(value);
}

function createSafeTextSchema(min: number, max: number, minMessage: string) {
  return z
    .string()
    .trim()
    .min(min, minMessage)
    .max(max, "Мәтін тым ұзын.")
    .refine(noExecutableContent, "Қауіпті мәтін анықталды.")
    .transform((value) => sanitizePlainText(value));
}

export const loginRequestSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Қате email форматы!")
    .max(200, "Email тым ұзын.")
    .transform((value) => value.toLowerCase()),
  password: z
    .string()
    .trim()
    .min(1, "Құпия сөзді енгізіңіз!")
    .max(200, "Құпия сөз тым ұзын.")
    .refine(noExecutableContent, "Қауіпті мәтін анықталды.")
});

export const registerRequestSchema = z.object({
  name: createSafeTextSchema(1, 120, "Аты-жөніңізді енгізіңіз."),
  email: z
    .string()
    .trim()
    .email("Қате email форматы!")
    .max(200, "Email тым ұзын.")
    .transform((value) => value.toLowerCase()),
  password: z
    .string()
    .trim()
    .min(8, "Құпия сөз кем дегенде 8 таңбадан тұруы керек!")
    .max(200, "Құпия сөз тым ұзын.")
    .refine(hasDigit, "Құпия сөзде кемінде бір сан болуы керек!")
    .refine(noExecutableContent, "Қауіпті мәтін анықталды."),
  selectedCombo: z.enum(comboCodes, {
    message: "Комбинацияны міндетті түрде таңдауыңыз."
  }),
  isAgreedToTerms: z
    .boolean()
    .refine((value) => value === true, "Жүйеге тіркелу үшін ережелермен келісуіңіз қажет!")
});

export const forgotPasswordRequestSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Қате email форматы!")
    .max(200, "Email тым ұзын.")
    .transform((value) => value.toLowerCase())
});

export const resetPasswordRequestSchema = z.object({
  token: z.string().trim().min(1, "Қалпына келтіру токені қажет."),
  password: z
    .string()
    .trim()
    .min(8, "Құпия сөз кем дегенде 8 таңбадан тұруы керек!")
    .max(200, "Құпия сөз тым ұзын.")
    .refine(hasDigit, "Құпия сөзде кемінде бір сан болуы керек!")
    .refine(noExecutableContent, "Қауіпті мәтін анықталды.")
});

export const roleUpdateRequestSchema = z.object({
  userId: z.string().trim().min(1, "Пайдаланушы идентификаторы қажет."),
  newRole: z.enum(["USER", "ADMIN"])
});

export function formatAuthValidationError(error: z.ZodError) {
  return error.issues[0]?.message || "Сұраныс деректері жарамсыз.";
}

export type LoginRequestInput = z.infer<typeof loginRequestSchema>;
export type RegisterRequestInput = z.infer<typeof registerRequestSchema>;
