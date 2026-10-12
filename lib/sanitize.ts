const SQL_SUSPICIOUS = /(--|;|\/\*|\*\/|xp_|union\s+select|drop\s+table|insert\s+into|delete\s+from)/gi;
const SCRIPT_PATTERN = /<script[\s\S]*?>[\s\S]*?<\/script>/gi;
const EVENT_HANDLER_PATTERN = /\son\w+="[^"]*"/gi;
const JAVASCRIPT_URL_PATTERN = /javascript:/gi;

export function sanitizePlainText(value: string) {
  return value
    .replace(SCRIPT_PATTERN, "")
    .replace(SQL_SUSPICIOUS, " ")
    .replace(/[<>]/g, "")
    .trim();
}

export function sanitizeRichText(value: string) {
  return value
    .replace(SCRIPT_PATTERN, "")
    .replace(EVENT_HANDLER_PATTERN, "")
    .replace(JAVASCRIPT_URL_PATTERN, "")
    .trim();
}
