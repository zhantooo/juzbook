"use client";

export function NoteHtml({ html, className = "" }: { html: string; className?: string }) {
  return (
    <div
      className={`w-full max-w-none break-words text-slate-700 dark:text-zinc-200 [&_a]:font-medium [&_a]:text-blue-600 [&_a]:underline [&_blockquote]:my-3 [&_blockquote]:border-l-4 [&_blockquote]:border-slate-300 [&_blockquote]:pl-4 [&_blockquote]:italic [&_img]:mx-auto [&_img]:my-4 [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-xl [&_img]:shadow-md [&_li]:ml-4 [&_ol]:my-2 [&_ol]:list-decimal [&_p]:my-2 [&_strong]:font-semibold [&_ul]:my-2 [&_ul]:list-disc ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
