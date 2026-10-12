"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  BookMarked,
  CalendarDays,
  Droplets,
  GraduationCap,
  PencilLine,
  Save,
  Settings2,
  TimerReset,
  Trophy,
  UserCircle2
} from "lucide-react";
import { RouteGuard } from "@/components/auth/route-guard";
import { AvatarStudio } from "@/components/avatar/avatar-studio";
import { ReaderFeatureSettings } from "@/components/profile/reader-feature-settings";
import { SiteHeader } from "@/components/site/site-header";
import { useAuth } from "@/components/state/auth-context";
import { useCatalog } from "@/components/state/catalog-context";
import { ComboPicker } from "@/components/ui/combo-picker";
import { comboOptions } from "@/lib/combo-options";
import type { ComboCode, StudentProfile } from "@/lib/types";
import { formatHours, getTreeStage } from "@/lib/tree";

const comboCards: Array<{ code: ComboCode; title: string; caption: string }> = [
  { code: "BIO-CHEM", title: "БИО-ХИМ", caption: "Биология + Химия" },
  { code: "GEO-BIO", title: "ГЕО-БИО", caption: "География + Биология" },
  { code: "GEO-MATH", title: "ГЕО-МАТ", caption: "География + Математика" },
  { code: "GEO-WORLD", title: "ГЕО-ДЖТ", caption: "География + Дүниежүзі тарихы" },
  { code: "WORLD-ENG", title: "ДЖТ-АНГЛ", caption: "Дүниежүзі тарихы + Ағылшын тілі" },
  { code: "GEO-ENG", title: "ГЕО-АНГЛ", caption: "География + Ағылшын тілі" },
  { code: "WORLD-LAW", title: "ДЖТ-ҚҰҚЫҚ", caption: "Дүниежүзі тарихы + Құқық негіздері" },
  { code: "PHYS-MATH", title: "ФИЗ-МАТ", caption: "Физика + Математика" },
  { code: "PHYS-CHEM", title: "ФИЗ-ХИМ", caption: "Физика + Химия" },
  { code: "INFO-MATH", title: "ИНФО-МАТ", caption: "Информатика + Математика" },
  { code: "LIT-LANG", title: "ӘДЕБ-ТІЛ", caption: "Қазақ әдебиеті + Қазақ тілі" },
  { code: "RUSLIT", title: "РУСЛИТ", caption: "Орыс тілі мен әдебиеті" },
  { code: "CREATIVE", title: "ШЫҒАРМАШЫЛЫҚ", caption: "Шығармашылық бағыт" }
];

const comboSubjectMap: Record<ComboCode, string[]> = {
  "BIO-CHEM": ["biology", "chemistry"],
  "GEO-BIO": ["geography", "biology"],
  "GEO-MATH": ["geography", "mathematics"],
  "GEO-WORLD": ["geography", "world-history"],
  "WORLD-ENG": ["world-history", "english"],
  "GEO-ENG": ["geography", "english"],
  "WORLD-LAW": ["world-history", "law-basics"],
  "PHYS-MATH": ["physics", "mathematics"],
  "PHYS-CHEM": ["physics", "chemistry"],
  "INFO-MATH": ["informatics", "mathematics"],
  "LIT-LANG": ["kazakh-literature", "kazakh-language"],
  RUSLIT: ["russian-language-literature"],
  CREATIVE: []
};

export function ProfilePage() {
  const {
    session,
    profile,
    completedChapters,
    selectedCombo,
    setSelectedCombo,
    continueReadingSettings,
    setContinueReadingEnabled,
    setHighlightMenuEnabled,
    updateProfile,
    todayReadingSeconds,
    totalReadingSeconds,
    treeStats,
    waterTree
  } = useAuth();
  const { subjects } = useCatalog();

  const [isEditing, setIsEditing] = useState(false);
  const [draftProfile, setDraftProfile] = useState<StudentProfile>({
    fullName: "",
    schoolName: "",
    grade: "",
    direction: ""
  });

  useEffect(() => {
    setDraftProfile({
      fullName: profile.fullName || "",
      schoolName: profile.schoolName || "",
      grade: profile.grade || "",
      direction: profile.direction || ""
    });
  }, [profile]);

  const treeStage = getTreeStage(treeStats);
  const selectedComboLabel = comboCards.find((item) => item.code === selectedCombo)?.title ?? "Комбо әлі таңдалмаған";

  const readingLeaderboard = useMemo(() => {
    const currentStudent = {
      name: profile.fullName || session?.name || "Оқушы",
      totalSeconds: Math.max(totalReadingSeconds, 58 * 60 * 60),
      todaySeconds: todayReadingSeconds
    };

    return [
      currentStudent,
      { name: "Айша", totalSeconds: 46 * 60 * 60 + 25 * 60, todaySeconds: 2 * 60 * 60 + 40 * 60 },
      { name: "Нұрсұлтан", totalSeconds: 42 * 60 * 60 + 10 * 60, todaySeconds: 3 * 60 * 60 + 5 * 60 },
      { name: "Мадина", totalSeconds: 37 * 60 * 60 + 50 * 60, todaySeconds: 1 * 60 * 60 + 55 * 60 },
      { name: "Әлихан", totalSeconds: 34 * 60 * 60 + 15 * 60, todaySeconds: 2 * 60 * 60 + 15 * 60 },
      { name: "Дана", totalSeconds: 31 * 60 * 60 + 20 * 60, todaySeconds: 1 * 60 * 60 + 30 * 60 },
      { name: "Ерасыл", totalSeconds: 28 * 60 * 60 + 45 * 60, todaySeconds: 2 * 60 * 60 },
      { name: "Аружан", totalSeconds: 24 * 60 * 60 + 35 * 60, todaySeconds: 50 * 60 },
      { name: "Санжар", totalSeconds: 20 * 60 * 60 + 10 * 60, todaySeconds: 1 * 60 * 60 + 10 * 60 },
      { name: "Мерей", totalSeconds: 18 * 60 * 60 + 5 * 60, todaySeconds: 45 * 60 }
    ].sort((left, right) => right.totalSeconds - left.totalSeconds);
  }, [profile.fullName, session?.name, todayReadingSeconds, totalReadingSeconds]);

  const progressSubjects = useMemo(() => {
    const selectedIds = selectedCombo ? comboSubjectMap[selectedCombo] : [];
    const orderedIds = Array.from(new Set([...selectedIds, "kazakh-history"]));

    return orderedIds
      .map((subjectId) => {
        const subject = subjects.find((item) => item.id === subjectId);
        if (!subject) {
          return null;
        }

        const chapterIds = subject.books.flatMap((book) => book.chapters.map((chapter) => chapter.id));
        const completed = chapterIds.filter((id) => completedChapters.some((item) => item.chapterId === id)).length;
        const percentage = chapterIds.length ? Math.round((completed / chapterIds.length) * 100) : 0;

        return {
          id: subject.id,
          name: subject.name,
          percentage,
          completed,
          total: chapterIds.length,
          href: `/subjects/${subject.id}`,
          description: subject.description
        };
      })
      .filter(Boolean) as Array<{
      id: string;
      name: string;
      percentage: number;
      completed: number;
      total: number;
      href: string;
      description: string;
    }>;
  }, [completedChapters, selectedCombo, subjects]);

  function saveProfile() {
    updateProfile({
      fullName: draftProfile.fullName || "",
      schoolName: draftProfile.schoolName || "",
      grade: draftProfile.grade || "",
      direction: draftProfile.direction || ""
    });
    setIsEditing(false);
  }

  return (
    <RouteGuard role="USER">
      <div className="page-shell">
        <div className="page-glow">
          <div className="glow-drift-a absolute left-[-10rem] top-10 h-72 w-72 rounded-full bg-cyan-200/35 blur-3xl dark:bg-sky-500/12" />
          <div className="glow-drift-b absolute right-[-12rem] top-48 h-72 w-72 rounded-full bg-sky-200/35 blur-3xl dark:bg-cyan-500/10" />
        </div>
        <SiteHeader />
        <main id="juz-main" className="page-width py-10">
          <AvatarStudio />

          <div className="mt-6">
            <ReaderFeatureSettings />
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[0.82fr_1.18fr]">
            <section className="glass-card p-8 xl:order-2">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="intro-mask">
                    <p className="hero-line flex items-center gap-3 text-sm uppercase tracking-[0.12em] text-sky-700 dark:text-cyan-300" style={{ animationDelay: "0.06s" }}>
                      <span className="hero-rule inline-block h-[2px] w-8 bg-sky-600 dark:bg-cyan-400" style={{ animationDelay: "0.2s" }} />
                      Жеке кабинет
                    </p>
                  </div>
                  <h1 className="intro-mask mt-4 text-5xl font-semibold">
                    <span className="hero-rise block" style={{ animationDelay: "0.14s" }}>Студент профилі</span>
                  </h1>
                  <p className="hero-line mt-4 max-w-3xl text-base leading-8 text-slate-600 dark:text-zinc-400" style={{ animationDelay: "0.4s" }}>
                    Мұнда жеке мәліметтер, оқу уақыты, пәндік прогресс және ағашқа жиналған су көлемі сақталады.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => (isEditing ? saveProfile() : setIsEditing(true))}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-sky-300 hover:text-sky-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-cyan-500/50 dark:hover:text-cyan-300"
                >
                  {isEditing ? <Save className="h-4 w-4" /> : <PencilLine className="h-4 w-4" />}
                  {isEditing ? "Сақтау" : "Өңдеу"}
                </button>
              </div>

              <div className="mt-8 grid gap-4 lg:grid-cols-2">
                <div className="soft-card p-5">
                  <div className="inline-flex items-center gap-2 text-sm text-slate-500 dark:text-zinc-400">
                    <UserCircle2 className="h-4 w-4" />
                    Жеке мәліметтер
                  </div>
                  {isEditing ? (
                    <div className="mt-4 grid gap-3">
                      <input
                        value={draftProfile.fullName || ""}
                        spellCheck={false}
                        onChange={(event) => setDraftProfile((current) => ({ ...current, fullName: event.target.value || "" }))}
                        placeholder="Аты-жөні"
                        className="h-12 rounded-2xl border border-slate-200 bg-white px-4 outline-none dark:border-zinc-800 dark:bg-zinc-900"
                      />
                      <input
                        value={draftProfile.schoolName || ""}
                        spellCheck={false}
                        onChange={(event) => setDraftProfile((current) => ({ ...current, schoolName: event.target.value || "" }))}
                        placeholder="Оқу орны немесе мектебі"
                        className="h-12 rounded-2xl border border-slate-200 bg-white px-4 outline-none dark:border-zinc-800 dark:bg-zinc-900"
                      />
                      <input
                        value={draftProfile.grade || ""}
                        spellCheck={false}
                        onChange={(event) => setDraftProfile((current) => ({ ...current, grade: event.target.value || "" }))}
                        placeholder="Сынып"
                        className="h-12 rounded-2xl border border-slate-200 bg-white px-4 outline-none dark:border-zinc-800 dark:bg-zinc-900"
                      />
                      <input
                        value={draftProfile.direction || ""}
                        spellCheck={false}
                        onChange={(event) => setDraftProfile((current) => ({ ...current, direction: event.target.value || "" }))}
                        placeholder="Бағыты"
                        className="h-12 rounded-2xl border border-slate-200 bg-white px-4 outline-none dark:border-zinc-800 dark:bg-zinc-900"
                      />
                    </div>
                  ) : (
                    <div className="mt-4 space-y-2 text-sm leading-7 text-slate-700 dark:text-zinc-200">
                      <p><span className="font-semibold">Аты-жөні:</span> {profile.fullName || "Толтырылмаған"}</p>
                      <p><span className="font-semibold">Профиль атауы:</span> {session?.name ?? "Оқушы"}</p>
                      <p><span className="font-semibold">Оқу орны:</span> {profile.schoolName || "Көрсетілмеген"}</p>
                      <p><span className="font-semibold">Сынып:</span> {profile.grade || "Толтырылмаған"}</p>
                      <p><span className="font-semibold">Бағыты:</span> {profile.direction || "Толтырылмаған"}</p>
                    </div>
                  )}
                </div>

                <div className="soft-card p-5">
                  <div className="inline-flex items-center gap-2 text-sm text-slate-500 dark:text-zinc-400">
                    <GraduationCap className="h-4 w-4" />
                    ҰБТ комбинациясы
                  </div>
                  <p className="mt-4 text-2xl font-semibold text-slate-900 dark:text-zinc-50">{selectedComboLabel}</p>
                  <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-zinc-400">
                    Таңдалған комбоға сәйкес тек сол пәндер ғана басты бет пен прогресс бөлімінде жоғарыға шығады.
                  </p>
                  {isEditing ? (
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      {comboCards.map((combo) => {
                        const active = selectedCombo === combo.code;

                        return (
                          <button
                            key={combo.code}
                            type="button"
                            onClick={() => setSelectedCombo(combo.code)}
                            className={`rounded-2xl border p-4 text-left transition-all duration-300 ${
                              active
                                ? "border-sky-300 bg-sky-50 shadow-sm shadow-sky-100 dark:border-cyan-500/40 dark:bg-cyan-500/10"
                                : "border-slate-200/80 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700 dark:hover:bg-zinc-800"
                            }`}
                          >
                            <p className="text-sm font-semibold">{combo.title}</p>
                            <p className="mt-2 text-xs leading-6 text-slate-600 dark:text-zinc-400">{combo.caption}</p>
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>

                <div className="soft-card p-5">
                  <div className="inline-flex items-center gap-2 text-sm text-slate-500 dark:text-zinc-400">
                    <CalendarDays className="h-4 w-4" />
                    Бүгінгі сағат
                  </div>
                  <p className="mt-4 text-4xl font-semibold text-sky-700 dark:text-cyan-300">{formatHours(todayReadingSeconds)} сағат</p>
                  <p className="mt-2 text-sm text-slate-600 dark:text-zinc-400">Бүгінгі нақты оқу уақыты.</p>
                </div>

                <div className="soft-card p-5">
                  <div className="inline-flex items-center gap-2 text-sm text-slate-500 dark:text-zinc-400">
                    <TimerReset className="h-4 w-4" />
                    Жалпы сағат
                  </div>
                  <p className="mt-4 text-4xl font-semibold text-sky-700 dark:text-cyan-300">{formatHours(totalReadingSeconds)} сағат</p>
                  <p className="mt-2 text-sm text-slate-600 dark:text-zinc-400">Тіркелгеннен бергі жиналған оқу уақыты.</p>
                </div>

                <div className="soft-card p-5">
                  <div className="inline-flex items-center gap-2 text-sm text-slate-500 dark:text-zinc-400">
                    <BookMarked className="h-4 w-4" />
                    Оқылған тараулар
                  </div>
                  <p className="mt-4 text-4xl font-semibold text-sky-700 dark:text-cyan-300">{completedChapters.length}</p>
                  <p className="mt-2 text-sm text-slate-600 dark:text-zinc-400">Аяқталды деп белгіленген тараулар саны.</p>
                </div>

                <div className="soft-card p-5">
                  <div className="inline-flex items-center gap-2 text-sm text-slate-500 dark:text-zinc-400">
                    <Droplets className="h-4 w-4 text-sky-600" />
                    Құюға дайын су
                  </div>
                  <p className="mt-4 text-4xl font-semibold text-sky-700 dark:text-cyan-300">{formatHours(treeStats.availableWaterSeconds)} сағат</p>
                  <p className="mt-2 text-sm text-slate-600 dark:text-zinc-400">Оқылған уақытты қалаған кезде ағашқа құя аласыз.</p>
                </div>
              </div>

              <div className="hidden">
                <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                  <div>
                    <p className="text-sm uppercase tracking-[0.12em] text-amber-600 dark:text-amber-300">Оқу рейтингі</p>
                    <h2 className="mt-2 text-3xl font-semibold text-slate-950 dark:text-zinc-50">Ең белсенді оқушылар</h2>
                  </div>
                  <div className="rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                    Бүгінгі рекорд: {formatHours(Math.max(...readingLeaderboard.map((item) => item.todaySeconds)))} сағат
                  </div>
                </div>
                <div className="mt-5 grid gap-3">
                  {readingLeaderboard.map((item, index) => {
                    const isCurrent = item.name === (profile.fullName || session?.name || "Оқушы");

                    return (
                      <div
                        key={`${item.name}-${index}`}
                        className={`grid gap-3 rounded-2xl border px-4 py-3 md:grid-cols-[auto_minmax(0,1fr)_auto_auto] md:items-center ${
                          isCurrent
                            ? "border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100"
                            : "border-slate-200 bg-slate-50 text-slate-800 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
                        }`}
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-sm font-bold shadow-sm dark:bg-zinc-950">
                          {index === 0 ? <Trophy className="h-5 w-5 text-amber-500" /> : index + 1}
                        </div>
                        <div>
                          <p className="font-semibold">{item.name}</p>
                          <p className="text-xs text-slate-500 dark:text-zinc-400">{isCurrent ? "Сіздің аккаунтыңыз" : "Оқушы"}</p>
                        </div>
                        <p className="text-sm font-semibold">Жалпы: {formatHours(item.totalSeconds)} сағат</p>
                        <p className="text-sm font-semibold">Бүгін: {formatHours(item.todaySeconds)} сағат</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>

            <aside className="space-y-6 xl:order-1">
              <div className="glass-card p-6">
                <div className="flex items-center gap-3">
                  <Settings2 className="h-5 w-5 text-sky-700 dark:text-cyan-300" />
                  <h2 className="text-2xl font-semibold">Оқу баптаулары</h2>
                </div>
                <label className="mt-5 flex items-center justify-between gap-4 rounded-2xl border border-slate-200/80 bg-white px-4 py-4 dark:border-zinc-800 dark:bg-zinc-900">
                  <span className="text-sm leading-6 text-slate-700 dark:text-zinc-200">Соңғы оқыған жерден жалғастыруды көрсету</span>
                  <input
                    type="checkbox"
                    checked={!!continueReadingSettings.enabled}
                    onChange={(event) => setContinueReadingEnabled(event.target.checked)}
                    className="h-5 w-5 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                  />
                </label>
                <label className="mt-4 flex items-center justify-between gap-4 rounded-2xl border border-slate-200/80 bg-white px-4 py-4 dark:border-zinc-800 dark:bg-zinc-900">
                  <span className="text-sm leading-6 text-slate-700 dark:text-zinc-200">Мәтінді белгілегенде маркер мәзірін көрсету</span>
                  <input
                    type="checkbox"
                    checked={!!continueReadingSettings.highlightMenuEnabled}
                    onChange={(event) => setHighlightMenuEnabled(event.target.checked)}
                    className="h-5 w-5 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                  />
                </label>
              </div>

              <div className="glass-card p-6">
                <h2 className="text-2xl font-semibold">Прогресс</h2>
                <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-zinc-400">
                  Тізім тек таңдаған комбо пәндеріңізге байланысты құрылады.
                </p>
                <div className="mt-5 space-y-3">
                  {progressSubjects.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200/80 bg-slate-50 p-4 text-sm text-slate-600 dark:border-zinc-800 dark:bg-zinc-950/60 dark:text-zinc-400">
                      Алдымен комбинация таңдаңыз.
                    </div>
                  ) : (
                    progressSubjects.map((item) => (
                      <Link
                        key={item.id}
                        href={item.href}
                        className="block rounded-2xl border border-slate-200/80 bg-white p-4 transition hover:border-sky-300 hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-cyan-500/40 dark:hover:bg-zinc-800"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-base font-semibold">{item.name}</p>
                            <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">{item.description}</p>
                          </div>
                          <span className="text-sm font-semibold text-sky-700 dark:text-cyan-300">{item.percentage}%</span>
                        </div>
                        <div className="mt-3 h-2 rounded-full bg-slate-100 dark:bg-zinc-800">
                          <div className="h-2 rounded-full bg-sky-600 dark:bg-cyan-400" style={{ width: `${item.percentage}%` }} />
                        </div>
                        <p className="mt-2 text-xs uppercase tracking-[0.1em] text-slate-500 dark:text-zinc-400">
                          {item.completed}/{item.total} тарау
                        </p>
                      </Link>
                    ))
                  )}
                </div>
              </div>
            </aside>
          </div>
        </main>
      </div>
    </RouteGuard>
  );
}
