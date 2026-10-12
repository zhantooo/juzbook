"use client";

import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/ui/modal";
import type { SubjectRecord } from "@/lib/types";
import { SelectMenu } from "@/components/ui/select-menu";

export type TransferDialogState =
  | {
      mode: "move" | "copy";
      entityType: "section";
      entityId: string;
      entityTitle: string;
      currentBookId: string;
      subjectId: string;
    }
  | {
      mode: "move" | "copy";
      entityType: "chapter-group";
      entityId: string;
      entityTitle: string;
      currentSectionId: string;
      subjectId: string;
    }
  | {
      mode: "move" | "copy";
      entityType: "topic";
      entityId: string;
      entityTitle: string;
      currentSectionId: string;
      currentChapterGroupId?: string;
      subjectId: string;
    };

type Props = {
  open: boolean;
  state: TransferDialogState | null;
  subjects: SubjectRecord[];
  onClose: () => void;
  onMoveSectionToBook: (sectionId: string, targetBookId: string) => Promise<void>;
  onMoveChapterGroupToSection: (chapterGroupId: string, targetSectionId: string) => Promise<void>;
  onMoveTopicToLocation: (topicId: string, targetSectionId: string, targetChapterGroupId?: string) => Promise<void>;
  onCopySectionToBook: (sectionId: string, targetBookId: string) => Promise<void>;
  onCopyChapterGroupToSection: (chapterGroupId: string, targetSectionId: string) => Promise<void>;
  onCopyTopicToLocation: (topicId: string, targetSectionId: string, targetChapterGroupId?: string) => Promise<void>;
};

export function CatalogTransferModal({
  open,
  state,
  subjects,
  onClose,
  onMoveSectionToBook,
  onMoveChapterGroupToSection,
  onMoveTopicToLocation,
  onCopySectionToBook,
  onCopyChapterGroupToSection,
  onCopyTopicToLocation
}: Props) {
  const [targetBookId, setTargetBookId] = useState("");
  const [targetSectionId, setTargetSectionId] = useState("");
  const [targetChapterGroupId, setTargetChapterGroupId] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const activeSubject = useMemo(
    () => subjects.find((subject) => subject.id === state?.subjectId) ?? null,
    [state?.subjectId, subjects]
  );

  const availableBooks = activeSubject?.books ?? [];
  const availableSections = useMemo(
    () =>
      activeSubject?.books.flatMap((book) =>
        book.sections.map((section) => ({
          ...section,
          bookTitle: book.title
        }))
      ) ?? [],
    [activeSubject]
  );

  const availableChapterGroups = useMemo(() => {
    const section = availableSections.find((item) => item.id === targetSectionId);
    return section?.chapters.filter((chapterGroup) => !chapterGroup.id.startsWith("virtual-direct:")) ?? [];
  }, [availableSections, targetSectionId]);

  useEffect(() => {
    if (!state) {
      return;
    }

    setSubmitError("");

    if (state.entityType === "section") {
      setTargetBookId(
        availableBooks.find((book) => book.id !== state.currentBookId)?.id ?? availableBooks[0]?.id ?? ""
      );
      setTargetSectionId("");
      setTargetChapterGroupId("");
      return;
    }

    const nextSectionId =
      availableSections.find((section) => section.id !== state.currentSectionId)?.id ?? availableSections[0]?.id ?? "";

    setTargetBookId("");
    setTargetSectionId(nextSectionId);
    setTargetChapterGroupId("");
  }, [availableBooks, availableSections, state]);

  if (!open || !state) {
    return null;
  }

  const activeState = state;

  async function handleSubmit() {
    try {
      setSubmitError("");
      setIsSubmitting(true);

      if (activeState.entityType === "section") {
        if (!targetBookId) {
          throw new Error("Мақсатты кітапты таңдаңыз.");
        }

        if (activeState.mode === "move") {
          await onMoveSectionToBook(activeState.entityId, targetBookId);
        } else {
          await onCopySectionToBook(activeState.entityId, targetBookId);
        }
      } else if (activeState.entityType === "chapter-group") {
        if (!targetSectionId) {
          throw new Error("Мақсатты бөлімді таңдаңыз.");
        }

        if (activeState.mode === "move") {
          await onMoveChapterGroupToSection(activeState.entityId, targetSectionId);
        } else {
          await onCopyChapterGroupToSection(activeState.entityId, targetSectionId);
        }
      } else {
        if (!targetSectionId) {
          throw new Error("Мақсатты бөлімді таңдаңыз.");
        }

        if (activeState.mode === "move") {
          await onMoveTopicToLocation(activeState.entityId, targetSectionId, targetChapterGroupId || undefined);
        } else {
          await onCopyTopicToLocation(activeState.entityId, targetSectionId, targetChapterGroupId || undefined);
        }
      }

      onClose();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Ауыстыру орындалмады.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={activeState.mode === "move" ? "Орнын ауыстыру" : "Көшіріп қою"}
      description={`"${activeState.entityTitle}" элементін басқа жерге ${activeState.mode === "move" ? "ауыстырасыз" : "көшіресіз"}.`}
      maxWidthClassName="max-w-2xl"
    >
      <div className="space-y-4">
        {activeState.entityType === "section" ? (
          <label className="block space-y-2">
            <span className="text-sm text-slate-600 dark:text-zinc-400">Мақсатты кітап</span>
            <SelectMenu
              ariaLabel="Кітап"
              placeholder="Кітапты таңдаңыз"
              value={targetBookId}
              onChange={(next) => setTargetBookId(next)}
              options={[
                { value: "", label: "Кітапты таңдаңыз" },
                ...availableBooks.map((book) => ({ value: book.id, label: book.title }))
              ]}
            />
          </label>
        ) : (
          <>
            <label className="block space-y-2">
              <span className="text-sm text-slate-600 dark:text-zinc-400">Мақсатты бөлім</span>
              <SelectMenu
                ariaLabel="Бөлім"
                placeholder="Бөлімді таңдаңыз"
                value={targetSectionId}
                onChange={(next) => setTargetSectionId(next)}
                options={[
                  { value: "", label: "Бөлімді таңдаңыз" },
                  ...availableSections.map((section) => ({
                    value: section.id,
                    label: `${section.bookTitle} · ${section.title}`
                  }))
                ]}
              />
            </label>

            {activeState.entityType === "topic" ? (
              <label className="block space-y-2">
                <span className="text-sm text-slate-600 dark:text-zinc-400">Мақсатты тарау</span>
                <SelectMenu
                  ariaLabel="Тарау"
                  placeholder="Тараусыз сақтау"
                  value={targetChapterGroupId}
                  onChange={(next) => setTargetChapterGroupId(next)}
                  options={[
                    { value: "", label: "Тараусыз сақтау" },
                    ...availableChapterGroups.map((group) => ({ value: group.id, label: group.title }))
                  ]}
                />
              </label>
            ) : null}
          </>
        )}

        {submitError ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
            {submitError}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={isSubmitting}
            className="rounded-2xl bg-sky-700 px-5 py-3 text-sm font-medium text-white disabled:opacity-60 dark:bg-cyan-400 dark:text-zinc-950"
          >
            {activeState.mode === "move" ? "Ауыстыру" : "Көшіріп қою"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200"
          >
            Бас тарту
          </button>
        </div>
      </div>
    </Modal>
  );
}
