"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  CircleDot,
  Clock3,
  Dices,
  GripVertical,
  ListTodo,
  Pencil,
  Plus,
  Trash2
} from "lucide-react";
import { RouteGuard } from "@/components/auth/route-guard";
import { SiteHeader } from "@/components/site/site-header";
import { useAuth } from "@/components/state/auth-context";
import { useCatalog } from "@/components/state/catalog-context";
import { SelectMenu } from "@/components/ui/select-menu";
import type { TodoStatus, TodoSubtask, TodoTaskRecord, TopicRecord } from "@/lib/types";

const wheelColors = ["#4f46e5", "#fb7185", "#4ade80", "#fbbf24", "#c084fc", "#38bdf8"];

type SortMode = "manual" | "latest" | "alphabet" | "time" | "active";
type StatusFilter = "all" | TodoStatus;

/** Тапсырманың нақты күйі (ескі жазбада status болмаса, completed-тен алынады) */
function taskStatusOf(task: TodoTaskRecord): TodoStatus {
  return task.status ?? (task.completed ? "done" : "todo");
}

const statusMeta: Record<TodoStatus, { label: string; short: string }> = {
  todo: { label: "Орындалатын", short: "Жоспарда" },
  doing: { label: "Орындалуда", short: "Орындалуда" },
  done: { label: "Орындалды", short: "Дайын" }
};

/** Тізімдегі топтардың реті (бәрі бір тізімде, үш бөлікке бөлініп тұрады) */
const STATUS_ORDER: TodoStatus[] = ["todo", "doing", "done"];

const statusBadge: Record<TodoStatus, string> = {
  todo: "border-sky-200 bg-sky-50 text-sky-700 dark:border-cyan-500/30 dark:bg-cyan-500/10 dark:text-cyan-200",
  doing: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200",
  done: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200"
};

function createSubtask(title = ""): TodoSubtask {
  return {
    id: `subtask-${Math.random().toString(36).slice(2, 10)}`,
    title,
    completed: false
  };
}

function formatDueTime(value?: string | null) {
  if (!value) {
    return "Уақыт қойылмаған";
  }

  return value;
}

export function PlannerPage() {
  const { subjects } = useCatalog();
  const { todoTasks, addTodoTask, updateTodoTask, removeTodoTask, setTodoTaskStatus, moveTodoTask } = useAuth();

  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [draggedTaskId, setDraggedTaskId] = useState("");
  // Тапсырманы сүйреткенде оның қай жерге түсетінін көрсететін сызық
  const [dropTarget, setDropTarget] = useState<{ id: string; below: boolean } | null>(null);
  // Міндет қай топтың үстінде тұр (сүйреп күйін ауыстырғанда жарықталады)
  const [dragOverStatus, setDragOverStatus] = useState<TodoStatus | null>(null);
  const [expandedTaskIds, setExpandedTaskIds] = useState<string[]>([]);
  const [expandedSubtaskTaskIds, setExpandedSubtaskTaskIds] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [bookId, setBookId] = useState("");
  const [topicId, setTopicId] = useState("");
  const [dueTime, setDueTime] = useState("");
  const [remindWhileReading, setRemindWhileReading] = useState(false);
  const [subtasks, setSubtasks] = useState<TodoSubtask[]>([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [formError, setFormError] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("manual");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [rouletteTaskId, setRouletteTaskId] = useState("");
  const [isRouletteSpinning, setIsRouletteSpinning] = useState(false);
  const [rouletteRotation, setRouletteRotation] = useState(0);
  const [isWheelOpen, setIsWheelOpen] = useState(false);
  const rouletteTimeoutRef = useRef<number | null>(null);

  const selectedSubject = subjects.find((subject) => subject.id === subjectId) ?? null;
  const selectedBook = selectedSubject?.books.find((book) => book.id === bookId) ?? null;

  const availableTopics = useMemo<TopicRecord[]>(() => {
    if (!selectedBook) {
      return [];
    }

    return selectedBook.sections.flatMap((section) =>
      section.chapters.flatMap((chapterGroup) =>
        chapterGroup.topics.map((topic) => ({
          ...topic,
          sectionId: section.id,
          chapterGroupId: chapterGroup.id
        }))
      )
    );
  }, [selectedBook]);

  const rouletteCandidates = useMemo(
    () => todoTasks.filter((task) => !task.completed),
    [todoTasks]
  );

  const orderedTasks = useMemo(() => {
    const items = [...todoTasks];

    if (sortMode === "manual") {
      return items;
    }

    if (sortMode === "latest") {
      return items.sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());
    }

    if (sortMode === "alphabet") {
      return items.sort((left, right) => left.title.localeCompare(right.title, "kk"));
    }

    if (sortMode === "time") {
      return items.sort((left, right) => {
        if (!left.dueTime && !right.dueTime) {
          return 0;
        }
        if (!left.dueTime) {
          return 1;
        }
        if (!right.dueTime) {
          return -1;
        }
        return left.dueTime.localeCompare(right.dueTime, "kk");
      });
    }

    return items.sort((left, right) => Number(left.completed) - Number(right.completed));
  }, [sortMode, todoTasks]);

  const statusCounts = useMemo(() => {
    const counts = { all: todoTasks.length, todo: 0, doing: 0, done: 0 };
    for (const task of todoTasks) {
      counts[taskStatusOf(task)] += 1;
    }
    return counts;
  }, [todoTasks]);

  const filteredTasks = useMemo(
    () => (statusFilter === "all" ? orderedTasks : orderedTasks.filter((task) => taskStatusOf(task) === statusFilter)),
    [orderedTasks, statusFilter]
  );

  useEffect(() => {
    return () => {
      if (rouletteTimeoutRef.current) {
        window.clearTimeout(rouletteTimeoutRef.current);
      }
    };
  }, []);

  function resetForm() {
    setEditingTaskId(null);
    setTitle("");
    setDescription("");
    setSubjectId("");
    setBookId("");
    setTopicId("");
    setDueTime("");
    setRemindWhileReading(false);
    setSubtasks([]);
    setNewSubtaskTitle("");
    setFormError("");
  }

  function startEdit(task: TodoTaskRecord) {
    setEditingTaskId(task.id);
    setTitle(task.title);
    setDescription(task.description);
    setSubjectId(task.subjectId ?? "");
    setBookId(task.bookId ?? "");
    setTopicId(task.topicId ?? "");
    setDueTime(task.dueTime ?? "");
    setRemindWhileReading(Boolean(task.remindWhileReading));
    setSubtasks(task.subtasks.map((item) => ({ ...item })));
    setNewSubtaskTitle("");
    setFormError("");
  }

  function addSubtaskToDraft() {
    if (!newSubtaskTitle.trim()) {
      return;
    }

    setSubtasks((current) => [...current, createSubtask(newSubtaskTitle.trim())]);
    setNewSubtaskTitle("");
  }

  function toggleTaskExpanded(taskId: string) {
    setExpandedTaskIds((current) =>
      current.includes(taskId) ? current.filter((item) => item !== taskId) : [...current, taskId]
    );
  }

  function toggleSubtasksExpanded(taskId: string) {
    setExpandedSubtaskTaskIds((current) =>
      current.includes(taskId) ? current.filter((item) => item !== taskId) : [...current, taskId]
    );
  }

  function spinRoulette() {
    if (!rouletteCandidates.length) {
      setRouletteTaskId("");
      return;
    }

    if (rouletteTimeoutRef.current) {
      window.clearTimeout(rouletteTimeoutRef.current);
    }

    const winnerIndex = Math.floor(Math.random() * rouletteCandidates.length);
    const winner = rouletteCandidates[winnerIndex];
    const sliceSize = 360 / rouletteCandidates.length;
    const targetCenter = winnerIndex * sliceSize + sliceSize / 2;
    const extraTurns = 360 * 6;
    const finalRotation = rouletteRotation + extraTurns + (360 - targetCenter);

    setIsRouletteSpinning(true);
    setRouletteTaskId("");
    setRouletteRotation(finalRotation);

    rouletteTimeoutRef.current = window.setTimeout(() => {
      setRouletteTaskId(winner.id);
      setExpandedTaskIds((current) => (current.includes(winner.id) ? current : [...current, winner.id]));
      setIsRouletteSpinning(false);
      rouletteTimeoutRef.current = null;
    }, 4300);
  }

  function submitTask() {
    if (!title.trim()) {
      setFormError("Міндет атауын енгізіңіз.");
      return;
    }

    const existingTask = editingTaskId ? todoTasks.find((task) => task.id === editingTaskId) : null;
    const payload = {
      title: title.trim(),
      description: description.trim(),
      completed: existingTask?.completed ?? false,
      dueTime: dueTime || null,
      remindWhileReading,
      subjectId: selectedSubject?.id ?? null,
      subjectName: selectedSubject?.name ?? null,
      bookId: selectedBook?.id ?? null,
      bookTitle: selectedBook?.title ?? null,
      topicId: topicId || null,
      topicTitle: availableTopics.find((topic) => topic.id === topicId)?.title ?? null,
      subtasks
    };

    if (editingTaskId) {
      updateTodoTask(editingTaskId, payload);
    } else {
      addTodoTask(payload);
    }

    resetForm();
  }

  function handleRemoveTask(taskId: string) {
    const confirmed = window.confirm("Осы міндетті өшіруге сенімдісіз бе?");
    if (!confirmed) {
      return;
    }

    removeTodoTask(taskId);
  }

  return (
    <RouteGuard role="USER">
      <div className="page-shell">
        <SiteHeader />

        <main id="juz-main" className="page-width py-10">
          <section className="glass-card p-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="intro-mask">
                  <p className="hero-line flex items-center gap-3 text-sm uppercase tracking-[0.12em] text-sky-700 dark:text-cyan-300" style={{ animationDelay: "0.06s" }}>
                    <span className="hero-rule inline-block h-[2px] w-8 bg-sky-600 dark:bg-cyan-400" style={{ animationDelay: "0.2s" }} />
                    Жоспар
                  </p>
                </div>
                <h1 className="intro-mask mt-3 text-5xl font-semibold">
                  <span className="hero-rise block" style={{ animationDelay: "0.14s" }}>Оқу жоспары</span>
                </h1>
                <p className="hero-line mt-4 max-w-3xl text-base leading-8 text-slate-600 dark:text-zinc-400" style={{ animationDelay: "0.4s" }}>
                  Міндеттерді қосып, орындарын ауыстырып, тақырыппен байланыстырып, бір жерден басқара аласыз.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-600 dark:text-zinc-300">Сортировка</span>
                  <SelectMenu
                    size="sm"
                    className="w-52"
                    ariaLabel="Сортировка тәртібі"
                    value={sortMode}
                    onChange={(next) => setSortMode(next as SortMode)}
                    options={[
                      { value: "manual", label: "Қолмен" },
                      { value: "latest", label: "Соңғы өзгергендер" },
                      { value: "alphabet", label: "Әліпби бойынша" },
                      { value: "time", label: "Уақыт бойынша" },
                      { value: "active", label: "Белсенділер алдымен" }
                    ]}
                  />
                </div>
                <div className="rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-700 dark:border-cyan-500/30 dark:bg-cyan-500/10 dark:text-cyan-200">
                  Барлығы: {todoTasks.length}
                </div>
              </div>
            </div>
          </section>

          <section className="mt-8 grid gap-6 xl:grid-cols-[1.12fr_0.88fr]">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                {([
                  ["all", `Барлығы · ${statusCounts.all}`],
                  ["todo", `${statusMeta.todo.label} · ${statusCounts.todo}`],
                  ["doing", `${statusMeta.doing.label} · ${statusCounts.doing}`],
                  ["done", `${statusMeta.done.label} · ${statusCounts.done}`]
                ] as [StatusFilter, string][]).map(([value, label]) => {
                  const active = statusFilter === value;
                  const accent =
                    value === "doing"
                      ? "border-amber-300 bg-amber-500 text-white dark:border-amber-400/60"
                      : value === "done"
                        ? "border-emerald-300 bg-emerald-500 text-white dark:border-emerald-400/60"
                        : "border-sky-300 bg-sky-700 text-white dark:border-cyan-400/60";
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setStatusFilter(value)}
                      className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold transition ${
                        active
                          ? accent
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              {todoTasks.length > 0 ? (
                (statusFilter === "all" ? STATUS_ORDER : ([statusFilter] as TodoStatus[])).map((groupStatus) => (
                <section
                  key={groupStatus}
                  onDragOver={(event) => {
                    if (!draggedTaskId) {
                      return;
                    }
                    event.preventDefault();
                    setDragOverStatus(groupStatus);
                  }}
                  onDragLeave={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                      setDragOverStatus((current) => (current === groupStatus ? null : current));
                    }
                  }}
                  onDrop={() => {
                    // Басқа топқа тасталса — міндеттің күйі сол топтікіне ауысады
                    if (draggedTaskId) {
                      setTodoTaskStatus(draggedTaskId, groupStatus);
                    }
                    setDragOverStatus(null);
                  }}
                  className={`rounded-panel border border-dashed p-2.5 transition ${
                    dragOverStatus === groupStatus
                      ? "border-sky-400 bg-sky-50/70 dark:border-cyan-400/60 dark:bg-cyan-500/10"
                      : "border-transparent"
                  }`}
                >
                  <div className="mb-2 flex items-center gap-2 px-1">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${statusBadge[groupStatus]}`}
                    >
                      {groupStatus === "done" ? (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      ) : groupStatus === "doing" ? (
                        <CircleDot className="h-3.5 w-3.5" />
                      ) : (
                        <Circle className="h-3.5 w-3.5" />
                      )}
                      {statusMeta[groupStatus].label}
                    </span>
                    <span className="text-xs font-semibold text-slate-400 dark:text-zinc-500">
                      {statusCounts[groupStatus]}
                    </span>
                  </div>
                  <div className="space-y-2">
                  {filteredTasks
                    .filter((item) => taskStatusOf(item) === groupStatus)
                    .map((task) => {
                  const isExpanded = expandedTaskIds.includes(task.id);
                  const isSubtasksExpanded = expandedSubtaskTaskIds.includes(task.id);
                  const linkedHref =
                    task.bookId && task.topicId && task.subjectId
                      ? `/books/${task.bookId}/chapters/${task.topicId}?subject=${task.subjectId}`
                      : null;

                  return (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={() => setDraggedTaskId(task.id)}
                      onDragEnd={() => {
                        setDraggedTaskId("");
                        setDropTarget(null);
                        setDragOverStatus(null);
                      }}
                      onDragOver={(event) => {
                        if (sortMode !== "manual" || !draggedTaskId || draggedTaskId === task.id) {
                          return;
                        }

                        event.preventDefault();
                        // Меңзер картаның жоғарғы жартысында ма, төменгі жартысында ма —
                        // соған қарай сызықты үстіне не астына саламыз.
                        const box = event.currentTarget.getBoundingClientRect();
                        const below = event.clientY > box.top + box.height / 2;
                        setDropTarget((current) =>
                          current?.id === task.id && current.below === below ? current : { id: task.id, below }
                        );
                      }}
                      onDragLeave={(event) => {
                        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                          setDropTarget((current) => (current?.id === task.id ? null : current));
                        }
                      }}
                      onDrop={() => {
                        if (sortMode === "manual" && draggedTaskId && draggedTaskId !== task.id) {
                          moveTodoTask(draggedTaskId, task.id, dropTarget?.below ?? false);
                        }
                        setDraggedTaskId("");
                        setDropTarget(null);
                      }}
                      className={`glass-card relative px-3 py-2.5 transition ${
                        rouletteTaskId === task.id
                          ? "border-amber-300 shadow-lg shadow-amber-100/70 dark:border-amber-400/50 dark:shadow-amber-500/10"
                          : draggedTaskId === task.id
                            ? "scale-[1.01] border-sky-300 opacity-60 shadow-lg shadow-sky-100/60 dark:border-cyan-500/40 dark:shadow-cyan-500/10"
                            : ""
                      }`}
                    >
                      {dropTarget?.id === task.id ? (
                        <span
                          aria-hidden="true"
                          className={`pointer-events-none absolute inset-x-2 z-10 flex items-center ${
                            dropTarget.below ? "-bottom-[7px]" : "-top-[7px]"
                          }`}
                        >
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-sky-500 dark:bg-cyan-400" />
                          <span className="h-[3px] flex-1 rounded-full bg-sky-500 dark:bg-cyan-400" />
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-sky-500 dark:bg-cyan-400" />
                        </span>
                      ) : null}
                      <div className="flex items-start gap-4">
                        <div className="flex items-center gap-2 pt-1">
                          <span className={`text-slate-300 dark:text-zinc-600 ${sortMode === "manual" ? "cursor-grab" : "cursor-not-allowed opacity-50"}`}>
                            <GripVertical className="h-5 w-5" />
                          </span>
                          {(() => {
                            const currentStatus = taskStatusOf(task);
                            const nextStatus: TodoStatus =
                              currentStatus === "todo" ? "doing" : currentStatus === "doing" ? "done" : "todo";
                            return (
                              <button
                                type="button"
                                onClick={() => setTodoTaskStatus(task.id, nextStatus)}
                                className="rounded-full text-slate-400 transition hover:text-emerald-600 dark:text-zinc-500 dark:hover:text-emerald-300"
                                aria-label={`Күйі: ${statusMeta[currentStatus].label}. Басу: ${statusMeta[nextStatus].label}`}
                                title={`Күйі: ${statusMeta[currentStatus].label} → ${statusMeta[nextStatus].label}`}
                              >
                                {currentStatus === "done" ? (
                                  <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                                ) : currentStatus === "doing" ? (
                                  <CircleDot className="h-6 w-6 text-amber-500" />
                                ) : (
                                  <Circle className="h-6 w-6" />
                                )}
                              </button>
                            );
                          })()}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <h2
                                className={`text-[15px] font-semibold leading-6 ${
                                  task.completed ? "text-slate-400 line-through dark:text-zinc-500" : "text-slate-900 dark:text-zinc-50"
                                }`}
                              >
                                {task.title}
                              </h2>
                              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-zinc-400">
                                {(() => {
                                  const s = taskStatusOf(task);
                                  const style =
                                    s === "doing"
                                      ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
                                      : s === "done"
                                        ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200"
                                        : "border-sky-200 bg-sky-50 text-sky-700 dark:border-cyan-500/30 dark:bg-cyan-500/10 dark:text-cyan-200";
                                  return (
                                    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-semibold ${style}`}>
                                      {s === "done" ? (
                                        <CheckCircle2 className="h-3.5 w-3.5" />
                                      ) : s === "doing" ? (
                                        <CircleDot className="h-3.5 w-3.5" />
                                      ) : (
                                        <Circle className="h-3.5 w-3.5" />
                                      )}
                                      {statusMeta[s].label}
                                    </span>
                                  );
                                })()}
                                <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 dark:border-zinc-800 dark:bg-zinc-900">
                                  <Clock3 className="h-3.5 w-3.5" />
                                  {formatDueTime(task.dueTime)}
                                </span>
                                {task.remindWhileReading ? (
                                  <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 font-medium text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                                    Оқып жатқанда еске салу
                                  </span>
                                ) : null}
                              </div>
                              {rouletteTaskId === task.id ? (
                                <p className="mt-2 text-xs font-semibold text-amber-600 dark:text-amber-300">
                                  Колесо фортуны осы міндетті таңдады
                                </p>
                              ) : null}
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => startEdit(task)}
                                className="rounded-full border border-slate-200 bg-white p-2 text-slate-500 transition hover:border-sky-300 hover:text-sky-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-cyan-500/40 dark:hover:text-cyan-300"
                                aria-label="Өңдеу"
                                title="Өңдеу"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveTask(task.id)}
                                className="rounded-full border border-rose-200 bg-white p-2 text-rose-600 transition hover:bg-rose-50 dark:border-rose-500/30 dark:bg-zinc-900 dark:text-rose-300 dark:hover:bg-rose-500/10"
                                aria-label="Өшіру"
                                title="Өшіру"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>

                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            {task.description ? (
                              <button
                                type="button"
                                onClick={() => toggleTaskExpanded(task.id)}
                                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:border-sky-300 hover:text-sky-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-cyan-500/40 dark:hover:text-cyan-300"
                              >
                                Ашу
                                <ChevronDown className={`h-3.5 w-3.5 transition ${isExpanded ? "rotate-180" : ""}`} />
                              </button>
                            ) : null}
                            {linkedHref ? (
                              <Link
                                href={linkedHref}
                                className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-[11px] font-semibold text-sky-700 transition hover:bg-sky-100 dark:border-cyan-500/30 dark:bg-cyan-500/10 dark:text-cyan-200 dark:hover:bg-cyan-500/20"
                              >
                                Тақырыпқа өту
                                <ChevronRight className="h-3.5 w-3.5" />
                              </Link>
                            ) : null}
                          </div>

                          {isExpanded ? (
                            <div className="mt-4 space-y-4">
                              {task.description ? (
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 dark:border-zinc-800 dark:bg-zinc-900/80">
                                  <p className="overflow-hidden break-all whitespace-pre-wrap text-sm leading-7 text-slate-600 dark:text-zinc-400">
                                    {task.description}
                                  </p>
                                </div>
                              ) : null}

                              {(task.subjectName || task.topicTitle) ? (
                                <div className="flex flex-wrap gap-2">
                                  {task.subjectName ? (
                                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 dark:bg-zinc-800 dark:text-zinc-300">
                                      {task.subjectName}
                                    </span>
                                  ) : null}
                                  {task.topicTitle ? (
                                    <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700 dark:bg-cyan-500/10 dark:text-cyan-200">
                                      {task.topicTitle}
                                    </span>
                                  ) : null}
                                </div>
                              ) : null}

                              {task.subtasks.length > 0 ? (
                                <div className="space-y-2">
                                  <button
                                    type="button"
                                    onClick={() => toggleSubtasksExpanded(task.id)}
                                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:border-sky-300 hover:text-sky-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-cyan-500/40 dark:hover:text-cyan-300"
                                  >
                                    Қосымша қадамдар
                                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500 dark:bg-zinc-800 dark:text-zinc-400">
                                      {task.subtasks.length}
                                    </span>
                                    <ChevronDown className={`h-3.5 w-3.5 transition ${isSubtasksExpanded ? "rotate-180" : ""}`} />
                                  </button>

                                  {isSubtasksExpanded ? (
                                    <div className="space-y-2">
                                      {task.subtasks.map((subtask) => (
                                        <button
                                          key={subtask.id}
                                          type="button"
                                          onClick={() =>
                                            updateTodoTask(task.id, {
                                              subtasks: task.subtasks.map((item) =>
                                                item.id === subtask.id ? { ...item, completed: !item.completed } : item
                                              )
                                            })
                                          }
                                          className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-3 text-left transition hover:border-sky-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-cyan-500/40"
                                        >
                                          {subtask.completed ? (
                                            <Check className="h-4 w-4 text-emerald-500" />
                                          ) : (
                                            <Circle className="h-4 w-4 text-slate-400" />
                                          )}
                                          <span
                                            className={`text-sm ${
                                              subtask.completed ? "text-slate-400 line-through dark:text-zinc-500" : "text-slate-700 dark:text-zinc-200"
                                            }`}
                                          >
                                            {subtask.title}
                                          </span>
                                        </button>
                                      ))}
                                    </div>
                                  ) : null}
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
                  {filteredTasks.filter((item) => taskStatusOf(item) === groupStatus).length === 0 ? (
                    <p className="rounded-2xl border border-dashed border-slate-200 px-3 py-4 text-center text-xs text-slate-400 dark:border-zinc-800 dark:text-zinc-500">
                      Бос — міндетті осында сүйреп әкеліңіз
                    </p>
                  ) : null}
                  </div>
                </section>
                ))
              ) : (
                <div className="glass-card p-8 text-center">
                  <ListTodo className="mx-auto h-10 w-10 text-sky-600 dark:text-cyan-300" />
                  <h2 className="mt-4 text-2xl font-semibold">Жоспар бос</h2>
                  <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-zinc-400">
                    Алдымен бір міндет қосыңыз. Кейін оны кітап тақырыбымен байланыстыра аласыз.
                  </p>
                </div>
              )}
            </div>

            <aside className="glass-card h-fit min-w-0 overflow-hidden p-6 xl:sticky xl:top-24">
              <h2 className="text-2xl font-semibold">{editingTaskId ? "Міндетті өңдеу" : "Жаңа міндет"}</h2>

              <div className="mt-4 rounded-3xl border border-slate-200/80 bg-slate-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
                <button
                  type="button"
                  onClick={() => setIsWheelOpen((current) => !current)}
                  className="flex w-full items-center justify-between gap-3"
                >
                  <div className="text-left">
                    <p className="text-sm font-semibold">Колесо фортуны</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-zinc-400">
                      Қай тапсырмадан бастау керегін түсті дөңгелек таңдап береді.
                    </p>
                  </div>
                  <ChevronDown className={`h-4 w-4 text-slate-500 transition ${isWheelOpen ? "rotate-180" : ""}`} />
                </button>

                {isWheelOpen ? (
                  <>
                    <div className="relative mx-auto mt-4 h-[19rem] w-[19rem] max-w-full">
                      <div className="absolute right-0 top-1/2 z-20 h-0 w-0 -translate-y-1/2 border-b-[12px] border-l-[18px] border-t-[12px] border-b-transparent border-l-rose-500 border-t-transparent" />
                      <div
                        className="absolute inset-0 overflow-hidden rounded-full border-4 border-white shadow-[0_24px_60px_-30px_rgba(15,23,42,0.45)] transition-transform duration-[4200ms] ease-[cubic-bezier(0.16,1,0.3,1)] dark:border-zinc-900"
                        style={{
                          transform: `rotate(${rouletteRotation}deg)`,
                          background: (() => {
                            if (!rouletteCandidates.length) {
                              return "conic-gradient(from -90deg, #cbd5e1 0deg 360deg)";
                            }

                            const sliceSize = 360 / rouletteCandidates.length;
                            return `conic-gradient(from -90deg, ${rouletteCandidates
                              .map((_, index) => {
                                const start = index * sliceSize;
                                const end = (index + 1) * sliceSize;
                                return `${wheelColors[index % wheelColors.length]} ${start}deg ${end}deg`;
                              })
                              .join(", ")})`;
                          })()
                        }}
                      >
                        {rouletteCandidates.map((task, index) => {
                          const angle = 360 / Math.max(rouletteCandidates.length, 1);
                          const segmentAngle = index * angle + angle / 2;
                          // conic-gradient "from -90deg" болғандықтан, сектор ортасы
                          // экранда (segmentAngle - 90) градуста тұрады. rotate(θ) кезінде
                          // элементтің өз X осі (90 + θ) градусқа бағытталады, сондықтан
                          // жазуды дәл сол секторға қою үшін θ = segmentAngle - 180.
                          const spokeAngle = segmentAngle - 180;
                          const centerDeg = ((segmentAngle - 90) % 360 + 360) % 360;
                          // Сол жақ жартыда жазу төңкеріліп кетеді — оны 180° аударамыз.
                          const flipped = centerDeg > 180;

                          return (
                            <div
                              key={task.id}
                              className="pointer-events-none absolute left-1/2 top-1/2 z-10 h-0 w-0"
                              style={{ transform: `rotate(${spokeAngle}deg)` }}
                            >
                              <div
                                className="flex w-[6.4rem] -translate-y-1/2 items-center justify-center"
                                style={{ transform: `translateX(2.6rem) rotate(${flipped ? 180 : 0}deg)` }}
                              >
                                <span className="line-clamp-2 max-w-[5.8rem] break-words text-center text-[13px] font-semibold leading-4 text-slate-950">
                                  {task.title}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div className="absolute left-1/2 top-1/2 z-20 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-white bg-slate-900 shadow-lg dark:border-zinc-900 dark:bg-zinc-100" />
                    </div>

                    <button
                      type="button"
                      onClick={spinRoulette}
                      disabled={isRouletteSpinning || rouletteCandidates.length === 0}
                      className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-sky-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-800 disabled:opacity-50 dark:bg-cyan-400 dark:text-zinc-950 dark:hover:bg-cyan-300"
                    >
                      <Dices className={`h-4 w-4 ${isRouletteSpinning ? "animate-spin" : ""}`} />
                      {isRouletteSpinning ? "Айналып жатыр..." : "Колесоны жіберу"}
                    </button>

                    {rouletteTaskId ? (
                      <p className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm font-medium text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                        Таңдалған міндет: {todoTasks.find((task) => task.id === rouletteTaskId)?.title}
                      </p>
                    ) : null}
                  </>
                ) : null}
              </div>

              <div className="mt-5 grid gap-4">
                <label className="grid gap-2">
                  <span className="text-sm font-medium text-slate-600 dark:text-zinc-300">Атауы</span>
                  <input
                    value={title}
                    spellCheck={false}
                    onChange={(event) => {
                      setTitle(event.target.value || "");
                      setFormError("");
                    }}
                    placeholder="Міндет атауы"
                    className="h-12 rounded-2xl border border-slate-200 bg-white px-4 outline-none transition focus:border-sky-300 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-cyan-500/50"
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-medium text-slate-600 dark:text-zinc-300">Сипаттама</span>
                  <textarea
                    value={description}
                    spellCheck={false}
                    onChange={(event) => setDescription(event.target.value || "")}
                    placeholder="Қысқаша сипаттама"
                    className="min-h-[120px] rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-sky-300 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-cyan-500/50"
                  />
                </label>

                <div className="grid gap-3">
                  <label className="grid gap-2">
                    <span className="text-sm font-medium text-slate-600 dark:text-zinc-300">Уақыт</span>
                    <input
                      type="time"
                      value={dueTime}
                      onChange={(event) => setDueTime(event.target.value || "")}
                      className="h-12 rounded-2xl border border-slate-200 bg-white px-4 outline-none transition focus:border-sky-300 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-cyan-500/50"
                    />
                  </label>

                  <label className="flex min-w-0 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
                    <input
                      type="checkbox"
                      checked={remindWhileReading}
                      onChange={(event) => setRemindWhileReading(event.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                    />
                    <span className="min-w-0">Оқып жатқанда еске салу</span>
                  </label>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  <div className="grid gap-2">
                    <span className="text-sm font-medium text-slate-600 dark:text-zinc-300">Пән</span>
                    <SelectMenu
                      ariaLabel="Пән"
                      placeholder="Таңдалмаған"
                      value={subjectId}
                      onChange={(next) => {
                        setSubjectId(next);
                        setBookId("");
                        setTopicId("");
                      }}
                      options={[
                        { value: "", label: "Таңдалмаған" },
                        ...subjects.map((subject) => ({
                          value: subject.id,
                          label: subject.name,
                          badge: subject.books.length
                        }))
                      ]}
                    />
                  </div>

                  <div className="grid gap-2">
                    <span className="text-sm font-medium text-slate-600 dark:text-zinc-300">Кітап</span>
                    <SelectMenu
                      ariaLabel="Кітап"
                      placeholder="Таңдалмаған"
                      disabled={!selectedSubject}
                      value={bookId}
                      onChange={(next) => {
                        setBookId(next);
                        setTopicId("");
                      }}
                      options={[
                        { value: "", label: "Таңдалмаған" },
                        ...(selectedSubject?.books ?? []).map((book) => ({
                          value: book.id,
                          label: book.title,
                          badge: book.chapters.length
                        }))
                      ]}
                    />
                  </div>

                  <div className="grid gap-2">
                    <span className="text-sm font-medium text-slate-600 dark:text-zinc-300">Тақырып</span>
                    <SelectMenu
                      ariaLabel="Тақырып"
                      placeholder="Таңдалмаған"
                      disabled={!selectedBook}
                      value={topicId}
                      onChange={(next) => setTopicId(next)}
                      options={[
                        { value: "", label: "Таңдалмаған" },
                        ...availableTopics.map((topic) => ({ value: topic.id, label: topic.title }))
                      ]}
                    />
                  </div>
                </div>

                {formError ? (
                  <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
                    {formError}
                  </p>
                ) : null}

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={submitTask}
                    className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-sky-700 px-5 text-sm font-semibold text-white transition hover:bg-sky-800 dark:bg-cyan-400 dark:text-zinc-950 dark:hover:bg-cyan-300"
                  >
                    <Check className="h-4 w-4" />
                    {editingTaskId ? "Сақтау" : "Қосу"}
                  </button>
                  <button
                    type="button"
                    onClick={resetForm}
                    className="inline-flex h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-700"
                  >
                    Тазалау
                  </button>
                </div>
              </div>
            </aside>
          </section>
        </main>
      </div>
    </RouteGuard>
  );
}
