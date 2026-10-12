"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CheckSquare2, Layers3, Plus, Save, Search, Square, Trash2 } from "lucide-react";
import type { SpecificationRecord, SubjectRecord } from "@/lib/types";

type Props = {
  subjects: SubjectRecord[];
  activeSubjectId: string;
  onSelectSubject: (subjectId: string) => void;
  specifications: SpecificationRecord[];
  onRefreshSpecifications: (subjectId?: string) => Promise<void>;
  onSaveSpecification: (input: {
    specificationId?: string;
    subjectId: string;
    title: string;
    description: string;
    topicIds: string[];
  }) => Promise<void>;
  onDeleteSpecification: (specificationId: string) => Promise<void>;
};

export function SpecificationPanel({
  subjects,
  activeSubjectId,
  onSelectSubject,
  specifications,
  onRefreshSpecifications,
  onSaveSpecification,
  onDeleteSpecification
}: Props) {
  const activeSubject = subjects.find((subject) => subject.id === activeSubjectId) ?? null;
  const refreshedSubjectRef = useRef("");
  const [selectedSpecificationId, setSelectedSpecificationId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedTopicIds, setSelectedTopicIds] = useState<string[]>([]);
  const [topicSearch, setTopicSearch] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const subjectSpecifications = useMemo(
    () => specifications.filter((specification) => specification.subjectId === activeSubjectId),
    [activeSubjectId, specifications]
  );

  const selectedSpecification = useMemo(
    () => subjectSpecifications.find((item) => item.id === selectedSpecificationId) ?? null,
    [selectedSpecificationId, subjectSpecifications]
  );

  useEffect(() => {
    if (!activeSubjectId || refreshedSubjectRef.current === activeSubjectId) {
      return;
    }

    refreshedSubjectRef.current = activeSubjectId;
    void onRefreshSpecifications(activeSubjectId);
  }, [activeSubjectId, onRefreshSpecifications]);

  useEffect(() => {
    setSelectedSpecificationId("");
    setTitle("");
    setDescription("");
    setSelectedTopicIds([]);
    setTopicSearch("");
    setSubmitError("");
  }, [activeSubjectId]);

  useEffect(() => {
    if (!selectedSpecificationId) {
      return;
    }

    if (!selectedSpecification) {
      setSelectedSpecificationId("");
      return;
    }

    setTitle(selectedSpecification.title);
    setDescription(selectedSpecification.description);
    setSelectedTopicIds(selectedSpecification.topics.map((topic) => topic.topicId));
    setSubmitError("");
  }, [selectedSpecificationId, selectedSpecification]);

  const availableTopics = useMemo(() => {
    if (!activeSubject) {
      return [];
    }

    return activeSubject.books.flatMap((book) =>
      book.sections.flatMap((section) =>
        section.chapters.flatMap((chapterGroup) =>
          chapterGroup.topics.map((topic) => ({
            id: topic.id,
            title: topic.title,
            excerpt: topic.excerpt,
            bookTitle: book.title,
            sectionTitle: section.title,
            chapterGroupTitle: chapterGroup.title
          }))
        )
      )
    );
  }, [activeSubject]);

  const filteredTopics = useMemo(() => {
    const query = topicSearch.trim().toLowerCase();
    if (!query) {
      return availableTopics;
    }

    return availableTopics.filter((topic) =>
      [topic.title, topic.excerpt, topic.bookTitle, topic.sectionTitle, topic.chapterGroupTitle]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [availableTopics, topicSearch]);

  const previewTopics = useMemo(
    () =>
      selectedTopicIds
        .map((topicId) => availableTopics.find((topic) => topic.id === topicId) ?? null)
        .filter((topic): topic is NonNullable<typeof topic> => Boolean(topic)),
    [availableTopics, selectedTopicIds]
  );

  function resetEditor() {
    setSelectedSpecificationId("");
    setTitle("");
    setDescription("");
    setSelectedTopicIds([]);
    setTopicSearch("");
    setSubmitError("");
  }

  function toggleTopic(topicId: string) {
    setSelectedTopicIds((current) =>
      current.includes(topicId) ? current.filter((item) => item !== topicId) : [...current, topicId]
    );
  }

  async function handleSave() {
    if (!activeSubjectId) {
      setSubmitError("Алдымен пәнді таңдаңыз.");
      return;
    }

    if (!title.trim()) {
      setSubmitError("Спецификация атауын енгізіңіз.");
      return;
    }

    if (!selectedTopicIds.length) {
      setSubmitError("Кемінде бір тақырыпты белгілеу керек.");
      return;
    }

    try {
      setSubmitError("");
      setIsSubmitting(true);
      await onSaveSpecification({
        specificationId: selectedSpecificationId || undefined,
        subjectId: activeSubjectId,
        title: title.trim(),
        description: description.trim(),
        topicIds: selectedTopicIds
      });
      await onRefreshSpecifications(activeSubjectId);
      if (!selectedSpecificationId) {
        resetEditor();
      }
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Спецификацияны сақтау мүмкін болмады.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!selectedSpecificationId) {
      return;
    }

    try {
      setSubmitError("");
      setIsSubmitting(true);
      await onDeleteSpecification(selectedSpecificationId);
      await onRefreshSpecifications(activeSubjectId);
      resetEditor();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Спецификацияны өшіру мүмкін болмады.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="mt-8 glass-card p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm text-sky-700 dark:text-cyan-300">Спецификация</p>
          <h2 className="mt-3 text-3xl font-semibold">Спецификация бойынша дайындалу</h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 dark:text-zinc-400">
            Пәнді таңдап, кітаптағы бірнеше тақырыпты бір спецификацияға біріктіре аласыз. Төмендегі алдын ала
            қарау блогы оқушыға бұл бағыттың қалай көрінетінін бірден көрсетеді.
          </p>
        </div>

        <button
          type="button"
          onClick={resetEditor}
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
        >
          <Plus className="h-4 w-4" />
          Жаңа спецификация
        </button>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
        <div className="space-y-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-xs text-slate-500 dark:text-zinc-400">Пән таңдау</p>
            <div className="mt-3 space-y-2">
              {subjects.map((subject) => (
                <button
                  key={subject.id}
                  type="button"
                  onClick={() => onSelectSubject(subject.id)}
                  className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                    activeSubjectId === subject.id
                      ? "border-sky-300 bg-sky-50 text-sky-900 dark:border-cyan-500/40 dark:bg-cyan-500/10 dark:text-cyan-200"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200"
                  }`}
                >
                  <p className="font-semibold">{subject.name}</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">{subject.books.length} кітап</p>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-xs text-slate-500 dark:text-zinc-400">Дайын спецификациялар</p>
            <div className="mt-3 space-y-2">
              {subjectSpecifications.map((specification) => (
                <button
                  key={specification.id}
                  type="button"
                  onClick={() => setSelectedSpecificationId(specification.id)}
                  className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                    selectedSpecificationId === specification.id
                      ? "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200"
                  }`}
                >
                  <p className="font-semibold">{specification.title}</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">{specification.topics.length} тақырып</p>
                </button>
              ))}
              {!subjectSpecifications.length ? (
                <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-4 text-sm text-slate-500 dark:border-zinc-700 dark:text-zinc-400">
                  Бұл пәнде әлі спецификация жасалмаған.
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-panel border border-slate-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2 md:col-span-2">
                <span className="text-sm text-slate-600 dark:text-zinc-400">Спецификация атауы</span>
                <input
                  value={title}
                  spellCheck={false}
                  onChange={(event) => setTitle(event.target.value || "")}
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 outline-none dark:border-zinc-800 dark:bg-zinc-950"
                  placeholder="Мысалы: 1-тоқсанға дайындық"
                />
              </label>

              <label className="space-y-2 md:col-span-2">
                <span className="text-sm text-slate-600 dark:text-zinc-400">Қысқаша сипаттама</span>
                <textarea
                  value={description}
                  spellCheck={false}
                  onChange={(event) => setDescription(event.target.value || "")}
                  rows={3}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none dark:border-zinc-800 dark:bg-zinc-950"
                  placeholder="Бұл бағыттың не үшін керегін жазыңыз"
                />
              </label>
            </div>

            <div className="mt-6">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-2">
                  <Layers3 className="h-4 w-4 text-sky-700 dark:text-cyan-300" />
                  <p className="text-sm font-semibold">Тақырыптарды белгілеу</p>
                </div>
                <p className="text-xs text-slate-500 dark:text-zinc-400">Таңдалды: {selectedTopicIds.length}</p>
              </div>

              <label className="relative mt-4 block">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={topicSearch}
                  spellCheck={false}
                  onChange={(event) => setTopicSearch(event.target.value || "")}
                  placeholder="Тақырыптан, кітаптан немесе бөлімнен іздеу"
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 outline-none dark:border-zinc-800 dark:bg-zinc-950"
                />
              </label>

              <div className="mt-4 max-h-[28rem] space-y-3 overflow-y-auto pr-2">
                {filteredTopics.map((topic) => {
                  const active = selectedTopicIds.includes(topic.id);

                  return (
                    <button
                      key={topic.id}
                      type="button"
                      onClick={() => toggleTopic(topic.id)}
                      className={`flex w-full items-start gap-4 rounded-2xl border px-4 py-4 text-left transition ${
                        active
                          ? "border-sky-300 bg-sky-50 dark:border-cyan-500/40 dark:bg-cyan-500/10"
                          : "border-slate-200 bg-white hover:border-slate-300 dark:border-zinc-800 dark:bg-zinc-950"
                      }`}
                    >
                      <span className="mt-0.5 shrink-0 text-sky-700 dark:text-cyan-300">
                        {active ? <CheckSquare2 className="h-5 w-5" /> : <Square className="h-5 w-5" />}
                      </span>
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 dark:text-zinc-50">{topic.title}</p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
                          {topic.bookTitle} · {topic.sectionTitle} · {topic.chapterGroupTitle}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-zinc-400">{topic.excerpt}</p>
                      </div>
                    </button>
                  );
                })}

                {!filteredTopics.length ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-4 text-sm text-slate-500 dark:border-zinc-700 dark:text-zinc-400">
                    Іздеуге сай тақырып табылмады.
                  </div>
                ) : null}
              </div>
            </div>

            {submitError ? (
              <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
                {submitError}
              </div>
            ) : null}

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={isSubmitting}
                className="inline-flex items-center gap-2 rounded-full bg-sky-700 px-5 py-3 text-sm font-medium text-white disabled:opacity-60 dark:bg-cyan-400 dark:text-zinc-950"
              >
                <Save className="h-4 w-4" />
                {selectedSpecificationId ? "Өзгерісті сақтау" : "Спецификацияны сақтау"}
              </button>
              {selectedSpecificationId ? (
                <button
                  type="button"
                  onClick={() => void handleDelete()}
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-5 py-3 text-sm font-medium text-rose-700 disabled:opacity-60 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
                >
                  <Trash2 className="h-4 w-4" />
                  Спецификацияны өшіру
                </button>
              ) : null}
            </div>
          </div>

          <div className="rounded-panel border border-slate-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-sky-700 dark:text-cyan-300">Алдын ала қарау</p>
                <h3 className="mt-2 text-2xl font-semibold">Оқушыға осылай көрінеді</h3>
              </div>
              <div className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600 dark:bg-zinc-800 dark:text-zinc-300">
                {previewTopics.length} тақырып
              </div>
            </div>

            <div className="mt-5 rounded-3xl border border-slate-200 bg-slate-50 p-5 dark:border-zinc-800 dark:bg-zinc-950/60">
              <div className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-3 py-1 text-xs text-sky-700 dark:bg-cyan-500/10 dark:text-cyan-300">
                <Layers3 className="h-4 w-4" />
                Спецификация
              </div>
              <h4 className="mt-4 text-3xl font-semibold">{title.trim() || "Спецификация атауы"}</h4>
              <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-zinc-400">
                {description.trim() || "Бұл жерде оқушыға көрінетін қысқаша сипаттама тұрады."}
              </p>
            </div>

            <div className="mt-5 grid gap-3">
              {previewTopics.map((topic, index) => (
                <div
                  key={topic.id}
                  className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950"
                >
                  <p className="text-xs uppercase tracking-[0.12em] text-slate-500 dark:text-zinc-400">Қадам {index + 1}</p>
                  <h4 className="mt-3 text-xl font-semibold">{topic.title}</h4>
                  <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-zinc-400">{topic.excerpt}</p>
                  <p className="mt-4 text-xs uppercase tracking-[0.1em] text-slate-500 dark:text-zinc-400">
                    {topic.bookTitle}
                  </p>
                </div>
              ))}

              {!previewTopics.length ? (
                <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-4 text-sm text-slate-500 dark:border-zinc-700 dark:text-zinc-400">
                  Алдымен тақырыптарды белгілеңіз, сонда бұл блокта бірден preview көрінеді.
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
