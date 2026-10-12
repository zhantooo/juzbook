const SESSION_COOKIE_NAME = "juzbook_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

type SessionRole = "USER" | "ADMIN" | "SUPERADMIN";

export type SessionTokenPayload = {
  sub: string;
  name: string;
  email: string;
  role: SessionRole;
  iat: number;
  exp: number;
};

function getSessionSecret() {
  const configuredSecret = (process.env.JUZBOOK_SESSION_SECRET || process.env.NEXTAUTH_SECRET || "").trim();

  if (configuredSecret) {
    return configuredSecret;
  }

  /// Жергілікті әзірлеуде жүйе толық тоқтап қалмауы үшін уақытша құпия кілт беріледі.
  if (process.env.NODE_ENV !== "production") {
    return "juzbook-dev-secret-change-me";
  }

  return "";
}

function toBase64(bytes: Uint8Array) {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }

  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

function fromBase64(value: string) {
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(value, "base64"));
  }

  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function toBase64Url(bytes: Uint8Array) {
  return toBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return fromBase64(padded);
}

function encodeJson(value: unknown) {
  return toBase64Url(new TextEncoder().encode(JSON.stringify(value)));
}

async function importSigningKey() {
  const secret = getSessionSecret();

  if (!secret) {
    throw new Error("JUZBOOK_SESSION_SECRET бапталмаған.");
  }

  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

export async function createSessionToken(payload: Omit<SessionTokenPayload, "iat" | "exp">) {
  const now = Math.floor(Date.now() / 1000);
  const completePayload: SessionTokenPayload = {
    ...payload,
    iat: now,
    exp: now + SESSION_TTL_SECONDS
  };

  const encodedHeader = encodeJson({ alg: "HS256", typ: "JWT" });
  const encodedPayload = encodeJson(completePayload);
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const key = await importSigningKey();
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signingInput));

  return `${signingInput}.${toBase64Url(new Uint8Array(signature))}`;
}

export async function verifySessionToken(token: string) {
  try {
    const [encodedHeader, encodedPayload, signature] = token.split(".");
    if (!encodedHeader || !encodedPayload || !signature) {
      return null;
    }

    const key = await importSigningKey();
    const signingInput = `${encodedHeader}.${encodedPayload}`;
    const isValid = await crypto.subtle.verify(
      "HMAC",
      key,
      fromBase64Url(signature),
      new TextEncoder().encode(signingInput)
    );

    if (!isValid) {
      return null;
    }

    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(encodedPayload))) as SessionTokenPayload;
    const now = Math.floor(Date.now() / 1000);

    if (!payload?.sub || !payload?.name || !payload?.email || !payload?.role || payload.exp <= now) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export { SESSION_COOKIE_NAME, SESSION_TTL_SECONDS };
