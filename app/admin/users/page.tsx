"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Search, ShieldCheck, Users } from "lucide-react";
import { toast } from "sonner";
import { RouteGuard } from "@/components/auth/route-guard";
import { SiteHeader } from "@/components/site/site-header";
import { useAuth } from "@/components/state/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SelectMenu } from "@/components/ui/select-menu";

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: "USER" | "ADMIN" | "SUPERADMIN";
  createdAt: string;
  source?: "database" | "demo";
};

export default function AdminUsersPage() {
  const { session } = useAuth();
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<UserRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState("");

  async function loadUsers(searchQuery = query) {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/users?query=${encodeURIComponent(searchQuery)}`, {
        credentials: "same-origin"
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string; users?: UserRow[] };

      if (!response.ok) {
        toast.error(payload.error || "Пайдаланушыларды жүктеу мүмкін болмады.");
        setUsers([]);
        return;
      }

      setUsers(payload.users || []);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadUsers(query);
    }, 200);

    return () => window.clearTimeout(timer);
  }, [query]);

  const totalUsers = users.length;
  const totalAdmins = users.filter((user) => user.role === "ADMIN").length;
  const totalStudents = users.filter((user) => user.role === "USER").length;
  const totalSuperAdmins = users.filter((user) => user.role === "SUPERADMIN").length;
  const visibleUsers = useMemo(() => users, [users]);

  async function updateRole(userId: string, newRole: "USER" | "ADMIN") {
    setUpdatingId(userId);
    try {
      const response = await fetch("/api/users/role", {
        method: "PATCH",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ userId, newRole })
      });

      const payload = (await response.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!response.ok) {
        toast.error(payload.error || "Рөлді өзгерту мүмкін болмады.");
        return;
      }

      toast.success(payload.message || "Пайдаланушы рөлі жаңартылды.");
      await loadUsers(query);
    } finally {
      setUpdatingId("");
    }
  }

  return (
    <RouteGuard role="SUPERADMIN">
      <div className="page-shell">
        <div className="page-glow">
          <div className="glow-drift-a absolute left-[-8rem] top-12 h-72 w-72 rounded-full bg-sky-200/35 blur-3xl dark:bg-cyan-500/15" />
          <div className="glow-drift-b absolute bottom-8 right-[-12rem] h-80 w-80 rounded-full bg-cyan-200/30 blur-3xl dark:bg-sky-500/12" />
        </div>
        <SiteHeader />

        <main id="juz-main" className="page-width py-10">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <div className="intro-mask">
                    <p className="hero-line flex items-center gap-3 text-sm uppercase tracking-[0.12em] text-sky-700 dark:text-cyan-300" style={{ animationDelay: "0.06s" }}>
                      <span className="hero-rule inline-block h-[2px] w-8 bg-sky-600 dark:bg-cyan-400" style={{ animationDelay: "0.2s" }} />
                      SUPERADMIN басқару орталығы
                    </p>
                  </div>
                  <CardTitle className="intro-mask">
                    <span className="hero-rise block" style={{ animationDelay: "0.14s" }}>Пайдаланушыларды басқару</span>
                  </CardTitle>
                  <CardDescription className="hero-line" style={{ animationDelay: "0.4s" }}>
                    Бұл бетте барлық аккаунттар көрінеді. Осында іздеу, рөл ауыстыру және әкімшілерді бақылау жүзеге асады.
                  </CardDescription>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Link
                    href="/admin"
                    className="inline-flex h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 text-sm font-medium text-slate-700 transition hover:border-sky-300 hover:text-sky-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-cyan-500/50 dark:hover:text-cyan-300"
                  >
                    Каталог
                  </Link>
                  <Link
                    href="/admin?panel=stats"
                    className="inline-flex h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 text-sm font-medium text-slate-700 transition hover:border-sky-300 hover:text-sky-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-cyan-500/50 dark:hover:text-cyan-300"
                  >
                    Статистика
                  </Link>
                  <span className="inline-flex h-12 items-center justify-center rounded-2xl bg-sky-700 px-5 text-sm font-medium text-white dark:bg-cyan-400 dark:text-zinc-950">
                    Пайдаланушылар
                  </span>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-4">
                <div className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
                  <p className="text-sm uppercase tracking-[0.12em] text-slate-500 dark:text-zinc-400">Барлық аккаунттар</p>
                  <p className="mt-3 text-3xl font-semibold text-slate-900 dark:text-zinc-100">{totalUsers}</p>
                </div>
                <div className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
                  <p className="text-sm uppercase tracking-[0.12em] text-slate-500 dark:text-zinc-400">Суперәкімшілер</p>
                  <p className="mt-3 text-3xl font-semibold text-slate-900 dark:text-zinc-100">{totalSuperAdmins}</p>
                </div>
                <div className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
                  <p className="text-sm uppercase tracking-[0.12em] text-slate-500 dark:text-zinc-400">Әкімшілер</p>
                  <p className="mt-3 text-3xl font-semibold text-slate-900 dark:text-zinc-100">{totalAdmins}</p>
                </div>
                <div className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
                  <p className="text-sm uppercase tracking-[0.12em] text-slate-500 dark:text-zinc-400">Оқушылар</p>
                  <p className="mt-3 text-3xl font-semibold text-slate-900 dark:text-zinc-100">{totalStudents}</p>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
                <label className="relative block">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Аты немесе email арқылы іздеу"
                    className="pl-11"
                  />
                </label>
                <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
                  <ShieldCheck className="h-4 w-4 text-sky-600 dark:text-cyan-300" />
                  Қазір кіріп тұрғаныңыз: <span className="font-semibold text-slate-900 dark:text-zinc-100">{session?.email}</span>
                </div>
              </div>

              <div className="overflow-hidden rounded-3xl border border-slate-200 dark:border-zinc-800">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-zinc-800">
                    <thead className="bg-slate-50 dark:bg-zinc-900">
                      <tr className="text-left text-slate-500 dark:text-zinc-400">
                        <th className="px-4 py-3 font-medium">Аты</th>
                        <th className="px-4 py-3 font-medium">Email</th>
                        <th className="px-4 py-3 font-medium">Рөлі</th>
                        <th className="px-4 py-3 font-medium">Түрі</th>
                        <th className="px-4 py-3 font-medium">Тіркелген күні</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white dark:divide-zinc-800 dark:bg-zinc-950">
                      {visibleUsers.map((user) => (
                        <tr key={user.id}>
                          <td className="px-4 py-4 font-medium text-slate-900 dark:text-zinc-100">
                            <div className="inline-flex items-center gap-2">
                              <Users className="h-4 w-4 text-sky-600 dark:text-cyan-300" />
                              {user.name}
                            </div>
                          </td>
                          <td className="px-4 py-4 text-slate-600 dark:text-zinc-300">{user.email}</td>
                          <td className="px-4 py-4">
                            {user.role === "SUPERADMIN" ? (
                              <span className="inline-flex rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                                SUPERADMIN
                              </span>
                            ) : user.source === "demo" ? (
                              <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                                {user.role === "ADMIN" ? "Әкімші" : "Оқушы"}
                              </span>
                            ) : (
                              <SelectMenu
                                size="sm"
                                className="w-40"
                                ariaLabel="Рөл"
                                disabled={updatingId === user.id}
                                value={user.role}
                                onChange={(next) => void updateRole(user.id, next as "USER" | "ADMIN")}
                                options={[
                                  { value: "USER", label: "Оқушы" },
                                  { value: "ADMIN", label: "Әкімші" }
                                ]}
                              />
                            )}
                          </td>
                          <td className="px-4 py-4 text-slate-600 dark:text-zinc-300">
                            {user.source === "demo" ? "Демо" : "Нақты"}
                          </td>
                          <td className="px-4 py-4 text-slate-600 dark:text-zinc-300">
                            {new Date(user.createdAt).toLocaleString("kk-KZ")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {!isLoading && !visibleUsers.length ? (
                  <div className="px-4 py-10 text-center text-sm text-slate-500 dark:text-zinc-400">
                    Іздеу шарты бойынша пайдаланушылар табылмады.
                  </div>
                ) : null}
              </div>

              <div className="flex justify-end">
                <Button variant="secondary" onClick={() => void loadUsers(query)}>
                  Тізімді жаңарту
                </Button>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    </RouteGuard>
  );
}
