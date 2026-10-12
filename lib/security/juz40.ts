/**
 * juz40-edu.kz арқылы кіру (OAuth2 / OpenID Connect).
 *
 * "Google арқылы кіру" сияқты: оқушы құпия сөзін juz40 сайтында енгізеді,
 * бізге тек профилі (email/аты) қайтады — құпия сөз ешқашан бізге келмейді.
 *
 * juz40 сайты сыртқы қосымшаларға OAuth беруі керек. Сол жерден алынатын
 * дерек `.env` файлына жазылады:
 *   JUZ40_CLIENT_ID, JUZ40_CLIENT_SECRET
 *   JUZ40_AUTHORIZE_URL   (мыс. https://juz40-edu.kz/oauth/authorize)
 *   JUZ40_TOKEN_URL       (мыс. https://juz40-edu.kz/oauth/token)
 *   JUZ40_USERINFO_URL    (мыс. https://juz40-edu.kz/api/me)
 *   JUZ40_SCOPE           (міндетті емес, әдепкі "openid email profile")
 *   JUZ40_REDIRECT_URI    (міндетті емес, әдепкі {APP_URL}/api/auth/juz40/callback)
 * Профиль өрістерінің аты бөлек болса, оны да көрсетуге болады:
 *   JUZ40_EMAIL_FIELD, JUZ40_NAME_FIELD, JUZ40_ID_FIELD,
 *   JUZ40_SCHOOL_FIELD, JUZ40_GRADE_FIELD
 */

export type Juz40Config = {
  clientId: string;
  clientSecret: string;
  authorizeUrl: string;
  tokenUrl: string;
  userinfoUrl: string;
  scope: string;
  redirectUri: string;
  fields: {
    id: string;
    email: string;
    name: string;
    school: string;
    grade: string;
  };
};

export const JUZ40_STATE_COOKIE = "juzbook_juz40_state";

function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000";
}

export function getJuz40Config(): Juz40Config {
  return {
    clientId: process.env.JUZ40_CLIENT_ID?.trim() || "",
    clientSecret: process.env.JUZ40_CLIENT_SECRET?.trim() || "",
    authorizeUrl: process.env.JUZ40_AUTHORIZE_URL?.trim() || "",
    tokenUrl: process.env.JUZ40_TOKEN_URL?.trim() || "",
    userinfoUrl: process.env.JUZ40_USERINFO_URL?.trim() || "",
    scope: process.env.JUZ40_SCOPE?.trim() || "openid email profile",
    redirectUri: process.env.JUZ40_REDIRECT_URI?.trim() || `${appUrl()}/api/auth/juz40/callback`,
    fields: {
      id: process.env.JUZ40_ID_FIELD?.trim() || "sub",
      email: process.env.JUZ40_EMAIL_FIELD?.trim() || "email",
      name: process.env.JUZ40_NAME_FIELD?.trim() || "name",
      school: process.env.JUZ40_SCHOOL_FIELD?.trim() || "school",
      grade: process.env.JUZ40_GRADE_FIELD?.trim() || "grade"
    }
  };
}

/** Барлық міндетті баптау бар ма — сол болғанда ғана батырма көрсетіледі */
export function isJuz40Configured(config: Juz40Config = getJuz40Config()) {
  return Boolean(
    config.clientId && config.clientSecret && config.authorizeUrl && config.tokenUrl && config.userinfoUrl
  );
}

/** Профиль өрісін атауы (нүктелі жол да болады: "data.email") бойынша алады */
function pickField(source: Record<string, unknown>, path: string): string {
  if (!path) {
    return "";
  }
  let value: unknown = source;
  for (const segment of path.split(".")) {
    if (value && typeof value === "object" && segment in (value as Record<string, unknown>)) {
      value = (value as Record<string, unknown>)[segment];
    } else {
      return "";
    }
  }
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}

export type Juz40Profile = {
  externalId: string;
  email: string;
  name: string;
  school: string;
  grade: string;
};

/** juz40 userinfo жауабынан профильді шығарады (өріс аттары икемді) */
export function extractJuz40Profile(payload: Record<string, unknown>, config: Juz40Config): Juz40Profile {
  const externalId = pickField(payload, config.fields.id) || pickField(payload, "id") || pickField(payload, "login");
  const email = pickField(payload, config.fields.email).toLowerCase();
  const name = pickField(payload, config.fields.name) || pickField(payload, "full_name") || "Оқушы";
  const school = pickField(payload, config.fields.school);
  const grade = pickField(payload, config.fields.grade);
  return { externalId, email, name, school, grade };
}
