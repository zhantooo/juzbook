import { z } from "next/dist/compiled/zod";
import { sanitizePlainText, sanitizeRichText } from "@/lib/sanitize";

const scriptPattern = /<script[\s\S]*?>[\s\S]*?<\/script>/i;
const javascriptProtocolPattern = /javascript:/i;

function noExecutableContent(value: string) {
  return !scriptPattern.test(value) && !javascriptProtocolPattern.test(value);
}

function createSafePlainTextSchema(options?: { min?: number; max?: number }) {
  let schema = z.string().trim();

  if (typeof options?.min === "number") {
    schema = schema.min(options.min, "Міндетті өріс бос болмауы керек.");
  }

  if (typeof options?.max === "number") {
    schema = schema.max(options.max, "Мәтін тым ұзын.");
  }

  return schema
    .refine(noExecutableContent, "Мәтінде қауіпті скрипт болмауы керек.")
    .transform((value: string) => sanitizePlainText(value));
}

function createSafeOptionalPlainTextSchema(max = 5000) {
  return z
    .string()
    .trim()
    .max(max, "Мәтін тым ұзын.")
    .refine(noExecutableContent, "Мәтінде қауіпті скрипт болмауы керек.")
    .transform((value: string) => sanitizePlainText(value))
    .optional()
    .default("");
}

function createSafeRichTextSchema(max = 300000) {
  return z
    .string()
    .trim()
    .max(max, "Мәтін тым ұзын.")
    .refine(noExecutableContent, "Мәтінде қауіпті скрипт болмауы керек.")
    .transform((value: string) => sanitizeRichText(value));
}

const safeIdentifierSchema = z
  .string()
  .trim()
  .min(1, "Міндетті өріс бос болмауы керек.")
  .max(120, "Өріс тым ұзын.")
  .regex(/^[a-zA-Z0-9-:_]+$/, "Идентификатор пішімі дұрыс емес.");

const optionalIdentifierSchema = z
  .preprocess(
    (value: unknown) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    safeIdentifierSchema.optional()
  )
  .transform((value: string | undefined) => value ?? "");

const entityTypeSchema = z.enum(["subject", "book", "section", "chapter-group", "topic"]);

const subjectDataSchema = z.object({
  id: safeIdentifierSchema.optional(),
  name: createSafePlainTextSchema({ min: 1, max: 200 }),
  description: createSafeOptionalPlainTextSchema(4000)
});

const bookDataSchema = z.object({
  id: safeIdentifierSchema.optional(),
  subjectId: safeIdentifierSchema.optional().default(""),
  subjectName: createSafeOptionalPlainTextSchema(200),
  title: createSafePlainTextSchema({ min: 1, max: 200 }),
  sourceInfo: createSafeOptionalPlainTextSchema(300),
  sourceLink: z
    .string()
    .trim()
    .max(5000, "Сілтеме тым ұзын.")
    .refine((value: string) => !value || /^https?:\/\//i.test(value), "Ресми сілтеме https:// түрінде болуы керек.")
    .optional()
    .default(""),
  theme: z.enum(["basic", "sky", "emerald", "amber", "rose", "violet", "slate"]).optional().default("sky"),
  coverImage: z
    .string()
    .trim()
    .max(5000, "Сурет сілтемесі тым ұзын.")
    .refine(
      (value: string) =>
        !value || /^https?:\/\//i.test(value) || value.startsWith("/") || value.startsWith("data:image/"),
      "Сурет сілтемесі немесе жүктелген файл форматы жарамсыз."
    )
    .optional()
    .nullable(),
  pdfFileName: createSafeOptionalPlainTextSchema(300),
  pdfData: z
    .string()
    .trim()
    .max(25000000, "PDF файлы тым үлкен.")
    .refine((value: string) => !value || value.startsWith("data:application/pdf"), "PDF файлының форматы жарамсыз.")
    .optional()
    .nullable()
});

const sectionDataSchema = z.object({
  id: safeIdentifierSchema.optional(),
  bookId: safeIdentifierSchema,
  title: createSafePlainTextSchema({ min: 1, max: 200 })
});

const chapterGroupDataSchema = z.object({
  id: safeIdentifierSchema.optional(),
  sectionId: safeIdentifierSchema,
  title: createSafePlainTextSchema({ min: 1, max: 200 })
});

const topicDataSchema = z.object({
  id: safeIdentifierSchema.optional(),
  bookId: safeIdentifierSchema,
  sectionId: optionalIdentifierSchema,
  chapterGroupId: optionalIdentifierSchema,
  title: createSafePlainTextSchema({ min: 1, max: 200 }),
  excerpt: createSafeOptionalPlainTextSchema(2000),
  pdfPage: z.coerce.number().int().min(1, "PDF беті 1-ден басталуы керек.").max(5000, "PDF бет нөмірі тым үлкен.").optional().nullable(),
  content: createSafeRichTextSchema(8000000)
});

export const loginRequestSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Электронды пошта дұрыс емес.")
    .max(200)
    .transform((value: string) => value.toLowerCase()),
  password: z
    .string()
    .trim()
    .min(6, "Құпиясөз тым қысқа.")
    .max(200, "Құпиясөз тым ұзын.")
    .refine(noExecutableContent, "Қауіпті дерек анықталды.")
});

export const generateTestRequestSchema = z.object({
  text: createSafePlainTextSchema({ min: 80, max: 220000 }),
  topicTitle: createSafeOptionalPlainTextSchema(200).default("Таңдалған тақырып"),
  /// Дайын сұрақ банкі таусылғанын тексеру үшін керек (міндетті емес).
  chapterIds: z.array(z.string().trim().min(1)).max(30).optional(),
  count: z.union([z.literal(10), z.literal(15), z.literal(20)]).default(10),
  difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
  language: z.enum(["kk", "en"]).default("kk")
});

type EntityType = "subject" | "book" | "section" | "chapter-group" | "topic";

export const catalogCreateRequestSchema = z
  .object({
    entityType: entityTypeSchema,
    data: z.record(z.unknown())
  })
  .superRefine(
    (value: { entityType: EntityType; data: Record<string, unknown> }, ctx: { addIssue: (issue: unknown) => void }) => {
      const result = parseCatalogDataByType(value.entityType, value.data);
      if (!result.success) {
        for (const issue of result.error.issues) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: issue.message,
            path: ["data", ...issue.path.map((item: unknown) => String(item))]
          });
        }
      }
    }
  );

export const catalogUpdateRequestSchema = z
  .object({
    entityType: entityTypeSchema,
    entityId: safeIdentifierSchema,
    data: z.record(z.unknown())
  })
  .superRefine(
    (value: { entityType: EntityType; data: Record<string, unknown> }, ctx: { addIssue: (issue: unknown) => void }) => {
      const result = parseCatalogDataByType(value.entityType, value.data);
      if (!result.success) {
        for (const issue of result.error.issues) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: issue.message,
            path: ["data", ...issue.path.map((item: unknown) => String(item))]
          });
        }
      }
    }
  );

export const entityParamsSchema = z.object({
  entityType: entityTypeSchema,
  entityId: safeIdentifierSchema
});

export const importBooksFormSchema = z.object({
  subject: createSafePlainTextSchema({ min: 1, max: 200 }),
  title: createSafeOptionalPlainTextSchema(300),
  author: createSafeOptionalPlainTextSchema(300),
  grade: createSafeOptionalPlainTextSchema(100),
  skipFirst: z.coerce.number().int().min(0).max(20).default(2),
  skipLast: z.coerce.number().int().min(0).max(20).default(1),
  replaceExisting: z.coerce.boolean().default(false)
});

export const noteMutationSchema = z.object({
  selectedText: createSafeOptionalPlainTextSchema(5000),
  noteText: createSafePlainTextSchema({ min: 1, max: 20000 }),
  paragraphId: createSafeOptionalPlainTextSchema(200)
});

export const highlightMutationSchema = z.object({
  selectedText: createSafePlainTextSchema({ min: 1, max: 5000 }),
  color: z
    .string()
    .trim()
    .min(1, "Маркер түсін таңдаңыз.")
    .max(30, "Маркер түсі жарамсыз.")
    .refine((value: string) => /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value), "Маркер түсі HEX форматында болуы керек.")
    .transform((value: string) => value.toLowerCase()),
  paragraphId: createSafeOptionalPlainTextSchema(200)
});

export function parseCatalogDataByType(entityType: EntityType, data: Record<string, unknown>) {
  switch (entityType) {
    case "subject":
      return subjectDataSchema.safeParse(data);
    case "book":
      return bookDataSchema.safeParse(data);
    case "section":
      return sectionDataSchema.safeParse(data);
    case "chapter-group":
      return chapterGroupDataSchema.safeParse(data);
    case "topic":
      return topicDataSchema.safeParse(data);
  }
}

export function formatValidationError(error: { issues?: Array<{ message?: string }> }) {
  return error.issues?.[0]?.message || "Сұраныс деректері жарамсыз.";
}
