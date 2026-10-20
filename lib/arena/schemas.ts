import { z } from "zod";

/**
 * Arena маршруттарына келетін деректің сұлбалары.
 *
 * Бөлек файлда тұрғаны әдейі: маршруттың ішінде жазылса, оларды тексеру
 * үшін бүкіл HTTP қабатын көтеру керек болар еді. Мұнда олар таза дерек
 * сипаттамасы — тесттер тікелей шақыра алады, ал `openapi.yaml` осылармен
 * сәйкес келуі керек.
 */

/** Пән бойынша әрекет: кезекке тұру, бөлме құру */
export const subjectRequestSchema = z.object({
  subjectId: z.string().trim().min(1)
});

/** Бөлме коды. Регистрге тәуелсіз — әрқашан бас әріпке келтіріледі. */
export const codeRequestSchema = z.object({
  code: z
    .string()
    .trim()
    .min(4)
    .max(8)
    .transform((value) => value.toUpperCase())
});

/**
 * Жауап.
 *
 * `position` — сұрақтың нөмірі. Матчта он сұрақ болса да, шек кеңірек
 * алынған: кешігіп келген жауап қатемен емес, үнсіз өткізілуі керек,
 * ал ол шешім қозғалтқышта қабылданады.
 */
export const answerRequestSchema = z.object({
  position: z.number().int().min(0).max(99),
  chosenIndex: z.number().int().min(0).max(9)
});

/** Рейтинг маршрутының сұрау параметрлері */
export const ratingsQuerySchema = z.object({
  view: z.enum(["ratings", "leaderboard", "history"]).default("ratings"),
  subjectId: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional()
});

export type SubjectRequest = z.infer<typeof subjectRequestSchema>;
export type CodeRequest = z.infer<typeof codeRequestSchema>;
export type AnswerRequest = z.infer<typeof answerRequestSchema>;
export type RatingsQuery = z.infer<typeof ratingsQuerySchema>;
