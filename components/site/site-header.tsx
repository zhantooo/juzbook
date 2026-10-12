"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { BookOpen, ChartColumnBig, Layers, LogOut, Menu, Settings, ShieldCheck, Sprout, SquareCheckBig, Users, X } from "lucide-react";
import { useAuth } from "@/components/state/auth-context";
import { ReadingModeControl } from "@/components/reader/reading-mode";
import { ThemeToggle } from "@/components/ui/theme-toggle";

type HeaderIcon = typeof BookOpen;

type HeaderLink = {
  href: string;
  label: string;
  icon?: HeaderIcon;
};

const TASK_REMINDER_KEY = "juzbook-task-reminders";

const userLinks: HeaderLink[] = [
  { href: "/catalog", label: "Кітаптар" },
  { href: "/profile", label: "Кабинетім" },
  { href: "/notes", label: "Конспект" },
  { href: "/flashcards", label: "Флешкарта", icon: Layers },
  { href: "/planner", label: "Жоспар", icon: SquareCheckBig },
  { href: "/garden", label: "Ағаш бағы", icon: Sprout }
];

const adminLinks: HeaderLink[] = [
  { href: "/admin", label: "Каталог", icon: Settings },
  { href: "/admin?panel=stats", label: "Статистика", icon: ChartColumnBig }
];

const superAdminLinks: HeaderLink[] = [
  { href: "/admin/users", label: "Пайдаланушылар", icon: Users },
  { href: "/admin", label: "Каталог", icon: ShieldCheck },
  { href: "/admin?panel=stats", label: "Статистика", icon: ChartColumnBig }
];

function getTodayReminderKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getCurrentTimeValue() {
  const now = new Date();
  return `${`${now.getHours()}`.padStart(2, "0")}:${`${now.getMinutes()}`.padStart(2, "0")}`;
}

function playReminderSound() {
  if (typeof window === "undefined") {
    return;
  }

  const AudioContextClass =
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!AudioContextClass) {
    return;
  }

  const context = new AudioContextClass();
  const notes = [
    { frequency: 523.25, start: 0, duration: 0.12 },
    { frequency: 659.25, start: 0.13, duration: 0.14 },
    { frequency: 783.99, start: 0.3, duration: 0.22 }
  ];

  notes.forEach((note) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = "triangle";
    oscillator.frequency.value = note.frequency;
    gain.gain.setValueAtTime(0.0001, context.currentTime + note.start);
    gain.gain.exponentialRampToValueAtTime(0.18, context.currentTime + note.start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + note.start + note.duration);

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(context.currentTime + note.start);
    oscillator.stop(context.currentTime + note.start + note.duration + 0.02);
  });

  window.setTimeout(() => {
    void context.close().catch(() => undefined);
  }, 900);
}

function BrandLogo() {
  return (
    <div className="flex items-center gap-4">
      <div className="relative h-12 w-[160px]">
        <Image src="/brand/juz40-light.svg" alt="JUZ40 логотипі" fill className="object-contain dark:hidden" priority />
        <Image src="/brand/juz40-dark.svg" alt="JUZ40 логотипі" fill className="hidden object-contain dark:block" priority />
      </div>
    </div>
  );
}

function getRoleLinks(role?: string | null) {
  if (role === "SUPERADMIN") {
    return superAdminLinks;
  }

  if (role === "ADMIN") {
    return adminLinks;
  }

  return userLinks;
}

function getHomeLink(role?: string | null) {
  if (role === "SUPERADMIN") {
    return "/admin/users";
  }

  if (role === "ADMIN") {
    return "/admin";
  }

  return "/";
}

function getRoleBadge(role?: string | null) {
  if (role === "SUPERADMIN") {
    return "SUPERADMIN";
  }

  if (role === "ADMIN") {
    return "ӘКІМШІ";
  }

  return null;
}

function HeaderNav({
  links,
  pathname,
  currentPanel
}: {
  links: HeaderLink[];
  pathname: string;
  currentPanel: string | null;
}) {
  return (
    <nav className="hidden items-center gap-1 lg:flex xl:gap-2">
      {links.map((link) => {
        const active =
          link.href === "/admin?panel=stats"
            ? pathname === "/admin" && currentPanel === "stats"
            : pathname === link.href || pathname.startsWith(`${link.href}/`);

        return (
          <Link
            key={link.href}
            href={link.href}
            className={`group relative whitespace-nowrap rounded-full px-2.5 py-2 text-sm font-semibold transition-all duration-300 xl:px-4 xl:py-2.5 xl:text-base ${
              active
                ? "bg-slate-900 text-white dark:bg-zinc-100 dark:text-zinc-950"
                : "text-slate-700 hover:bg-slate-100 hover:text-slate-950 dark:text-zinc-200 dark:hover:bg-zinc-900 dark:hover:text-zinc-50"
            }`}
          >
            <span className="relative z-10 inline-flex items-center gap-2">
              {/* Орташа экранда 6 сілтеме сыйып тұруы үшін белгішелер тек кең экранда */}
              {link.icon ? <link.icon className="hidden h-4 w-4 xl:inline-block" /> : null}
              {link.label}
            </span>
            <span
              className={`absolute bottom-1 left-1/2 h-[2px] w-[calc(100%-1.8rem)] -translate-x-1/2 rounded-full bg-sky-500 transition-transform duration-300 dark:bg-cyan-400 ${
                active ? "scale-x-100" : "origin-center scale-x-0 group-hover:scale-x-100"
              }`}
            />
          </Link>
        );
      })}
    </nav>
  );
}

function HeaderNavWithPanel({ links, pathname }: { links: HeaderLink[]; pathname: string }) {
  const searchParams = useSearchParams();

  return <HeaderNav links={links} pathname={pathname} currentPanel={searchParams.get("panel")} />;
}

export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { logout, session, todoTasks, continueReadingSettings } = useAuth();
  const [taskReminder, setTaskReminder] = useState<(typeof todoTasks)[number] | null>(null);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const isGarden = (pathname || "").startsWith("/garden");
  const reminderTimeoutRef = useRef<number | null>(null);

  const links = getRoleLinks(session?.role);
  const roleBadge = getRoleBadge(session?.role);

  useEffect(() => {
    return () => {
      if (reminderTimeoutRef.current) {
        window.clearTimeout(reminderTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    // Кітап оқып отырғанда профильде жоспар өшірілсе, еске салу терезесі шықпайды
    const isReaderPage = (pathname || "").startsWith("/books/");
    if (!session || (isReaderPage && !continueReadingSettings.plannerEnabled)) {
      setTaskReminder(null);
      return;
    }

    const checkReminder = () => {
      const currentTime = getCurrentTimeValue();
      const todayKey = getTodayReminderKey();
      const shownMap = JSON.parse(window.localStorage.getItem(TASK_REMINDER_KEY) || "{}") as Record<string, string>;

      const nextTask =
        todoTasks.find((task) => {
          if (task.completed || !task.remindWhileReading) {
            return false;
          }

          const shownKey = `${task.id}:${task.updatedAt}:${todayKey}`;
          const duePassed = !task.dueTime || task.dueTime <= currentTime;
          return duePassed && shownMap[shownKey] !== "shown";
        }) ?? null;

      if (!nextTask) {
        return;
      }

      shownMap[`${nextTask.id}:${nextTask.updatedAt}:${todayKey}`] = "shown";
      window.localStorage.setItem(TASK_REMINDER_KEY, JSON.stringify(shownMap));
      setTaskReminder(nextTask);
      playReminderSound();

      if ("Notification" in window) {
        if (Notification.permission === "granted") {
          new Notification("JUZBOOK еске салуы", { body: nextTask.title });
        } else if (Notification.permission === "default") {
          Notification.requestPermission()
            .then((permission) => {
              if (permission === "granted") {
                new Notification("JUZBOOK еске салуы", { body: nextTask.title });
              }
            })
            .catch(() => undefined);
        }
      }

      if (reminderTimeoutRef.current) {
        window.clearTimeout(reminderTimeoutRef.current);
      }

      reminderTimeoutRef.current = window.setTimeout(() => {
        setTaskReminder(null);
        reminderTimeoutRef.current = null;
      }, 12000);
    };

    checkReminder();
    const intervalId = window.setInterval(checkReminder, 30000);
    return () => window.clearInterval(intervalId);
  }, [session, todoTasks, pathname, continueReadingSettings.plannerEnabled]);

  // z-60: помодоро виджеті z-50 болғандықтан, оқу режимі панелі оның астында қалмауы керек
  return (
    <header className="sticky top-0 z-[60] border-b border-slate-200/80 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
      <div className="page-width relative flex items-center justify-between gap-4 px-0 py-4">
        <Link href={getHomeLink(session?.role)} className="flex items-center">
          <BrandLogo />
        </Link>

        <Suspense fallback={<HeaderNav links={links} pathname={pathname} currentPanel={null} />}>
          <HeaderNavWithPanel links={links} pathname={pathname} />
        </Suspense>

        <div className="flex items-center gap-3">
          {/* Телефонда жоғарғы мәзір сыймайды — гамбургер батырмасы арқылы ашылады */}
          <button
            type="button"
            onClick={() => setIsMobileNavOpen((current) => !current)}
            aria-label={isMobileNavOpen ? "Мәзірді жабу" : "Мәзірді ашу"}
            aria-expanded={isMobileNavOpen}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200/80 bg-white text-slate-700 transition hover:border-sky-300 hover:text-sky-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 lg:hidden"
          >
            {isMobileNavOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          {roleBadge ? (
            <div className="hidden rounded-full border border-slate-200/80 bg-white px-4 py-2 text-xs font-semibold tracking-[0.12em] text-slate-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 lg:inline-flex">
              {roleBadge}
            </div>
          ) : null}

          {!session ? (
            <Link
              href="/login"
              className="hidden rounded-full border border-slate-200/80 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-all duration-300 hover:border-sky-300 hover:text-sky-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-cyan-500/50 dark:hover:text-cyan-300 sm:inline-flex"
            >
              <span className="inline-flex items-center gap-2">
                <BookOpen className="h-4 w-4" />
                Кіру
              </span>
            </Link>
          ) : null}

          <ReadingModeControl />
          {/* Ағаш бағының өз пиксель дизайны бар — түс режимі оған әсер етпейді,
              сондықтан ол бетте батырма көрсетілмейді. */}
          {isGarden ? null : <ThemeToggle />}

          {session ? (
            <button
              type="button"
              onClick={async () => {
                await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
                logout();
                router.push("/login");
              }}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-all duration-300 hover:border-rose-300 hover:text-rose-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-rose-500/50 dark:hover:text-rose-300"
            >
              <LogOut className="h-4 w-4" />
              Шығу
            </button>
          ) : null}
        </div>

        {isMobileNavOpen ? (
          <div
            data-header-popup="true"
            className="absolute left-0 right-0 top-[calc(100%+0.6rem)] z-50 rounded-3xl border border-slate-200/80 bg-white/95 p-2.5 shadow-[0_24px_80px_-28px_rgba(14,165,233,0.35)] backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-900/95 lg:hidden"
          >
            {links.map((link) => {
              const active = pathname === link.href || pathname.startsWith(`${link.href}/`);

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsMobileNavOpen(false)}
                  className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-base font-semibold transition ${
                    active
                      ? "bg-sky-50 text-sky-800 dark:bg-cyan-500/10 dark:text-cyan-200"
                      : "text-slate-700 hover:bg-slate-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  }`}
                >
                  {link.icon ? <link.icon className="h-4 w-4" /> : null}
                  {link.label}
                </Link>
              );
            })}

            {!session ? (
              <Link
                href="/login"
                onClick={() => setIsMobileNavOpen(false)}
                className="flex items-center gap-3 rounded-2xl px-4 py-3 text-base font-semibold text-slate-700 hover:bg-slate-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                <BookOpen className="h-4 w-4" />
                Кіру
              </Link>
            ) : null}
          </div>
        ) : null}

        {taskReminder ? (
          <div className="absolute right-0 top-[calc(100%+0.75rem)] z-[60] w-[min(92vw,22rem)] rounded-3xl border border-amber-200 bg-white/95 p-4 shadow-xl shadow-amber-100/60 backdrop-blur dark:border-amber-500/30 dark:bg-zinc-950/95 dark:shadow-amber-500/10">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-[0.12em] text-amber-600 dark:text-amber-300">Еске салу</p>
                <h3 className="mt-2 text-base font-semibold text-slate-900 dark:text-zinc-50">{taskReminder.title}</h3>
                {taskReminder.description ? (
                  <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-zinc-400">{taskReminder.description}</p>
                ) : null}
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-zinc-400">
                  <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-700 dark:bg-amber-500/10 dark:text-amber-200">
                    {taskReminder.dueTime ? `Уақыт: ${taskReminder.dueTime}` : "Уақыт еркін"}
                  </span>
                  {taskReminder.topicTitle ? (
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 dark:bg-zinc-800">
                      {taskReminder.topicTitle}
                    </span>
                  ) : null}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTaskReminder(null)}
                className="rounded-full border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 transition hover:border-slate-300 dark:border-zinc-800 dark:text-zinc-300"
              >
                Жабу
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </header>
  );
}
