"use client";

import { sanitizeRichText } from "@/lib/sanitize";

/** Мәтінде HTML белгілеуі бар ма? */
function looksLikeHtml(value: string) {
  return /<[a-z][\s\S]*>/i.test(value);
}

/**
 * Сұрақ мәтінін көрсетеді.
 * Әкімші редактор арқылы пішімдесе (қалың, индекс, түс, сурет), сол пішім сақталады;
 * қарапайым мәтін болса, ол жай мәтін ретінде шығады — сондықтан «x < 5» сияқты
 * жазулар жоғалып кетпейді.
 */
export function RichQuestionText({ value, className }: { value: string; className?: string }) {
  const text = value ?? "";

  if (!looksLikeHtml(text)) {
    return <span className={className}>{text}</span>;
  }

  return (
    <span
      className={`rich-question ${className ?? ""}`}
      dangerouslySetInnerHTML={{ __html: sanitizeRichText(text) }}
    />
  );
}
