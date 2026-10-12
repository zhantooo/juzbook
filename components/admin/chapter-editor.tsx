"use client";

import dynamic from "next/dynamic";
import type { ComponentType, RefAttributes } from "react";
import { forwardRef } from "react";
import type { RichTextEditorHandle } from "@/components/admin/rich-text-editor-client";

type ChapterEditorProps = {
  value: string;
  onChange: (value: string) => void;
  /** Шағын формаларда жазу алаңын кішірейту үшін */
  heightClass?: string;
  /** "side" — құралдар оң жақта, мәтін кітаптағыдай кең тұрады */
  layout?: "stacked" | "side";
  /** Жазу алаңының қосымша стилі (кітаптың қаріпі) */
  editorClassName?: string;
};

export type ChapterEditorHandle = RichTextEditorHandle;

const RichTextEditorClient = dynamic(
  () => import("@/components/admin/rich-text-editor-client").then((module) => module.RichTextEditorClient),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
        Редактор жүктеліп жатыр...
      </div>
    )
  }
) as ComponentType<ChapterEditorProps & RefAttributes<RichTextEditorHandle>>;

export const ChapterEditor = forwardRef<ChapterEditorHandle, ChapterEditorProps>(function ChapterEditor(props, ref) {
  return <RichTextEditorClient {...props} ref={ref} />;
});
