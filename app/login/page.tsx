"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useAuth } from "@/components/state/auth-context";
import { SiteHeader } from "@/components/site/site-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { loginRequestSchema, type LoginRequestInput } from "@/lib/security/auth-validation";

function getPostLoginPath(role?: "USER" | "ADMIN" | "SUPERADMIN" | string | null) {
  if (role === "SUPERADMIN") {
    return "/admin/users";
  }

  if (role === "ADMIN") {
    return "/admin";
  }

  return "/";
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refreshSession, session, isReady } = useAuth();
  const redirectPath = useMemo(() => searchParams.get("redirect") || "", [searchParams]);
  const authError = searchParams.get("authError") || "";
  const [isJuz40Enabled, setIsJuz40Enabled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/auth/juz40/status", { credentials: "same-origin" })
      .then((response) => response.json())
      .then((payload: { enabled?: boolean }) => {
        if (!cancelled) {
          setIsJuz40Enabled(Boolean(payload.enabled));
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const form = useForm<LoginRequestInput>({
    resolver: zodResolver(loginRequestSchema),
    defaultValues: {
      email: "",
      password: ""
    }
  });

  useEffect(() => {
    if (!isReady || !session) {
      return;
    }

    router.replace(getPostLoginPath(session.role));
  }, [isReady, router, session]);

  useEffect(() => {
    if (!authError) {
      return;
    }

    toast.error(authError);
  }, [authError]);

  async function onSubmit(values: LoginRequestInput) {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(values)
    });

    const payload = (await response.json().catch(() => ({}))) as { error?: string; message?: string };
    if (!response.ok) {
      toast.error(payload.error || "Жүйеге кіру мүмкін болмады.");
      return;
    }

    const nextSession = await refreshSession();
    toast.success(payload.message || "Жүйеге кіру сәтті орындалды.");

    if (redirectPath) {
      router.replace(redirectPath);
      router.refresh();
      return;
    }

    router.replace(getPostLoginPath(nextSession?.role));
    router.refresh();
  }

  return (
    <div className="page-shell">
      <div className="page-glow">
        <div className="glow-drift-a absolute left-[-10rem] top-10 h-80 w-80 rounded-full bg-sky-200/35 blur-3xl dark:bg-cyan-500/15" />
        <div className="glow-drift-b absolute bottom-10 right-[-12rem] h-96 w-96 rounded-full bg-cyan-200/30 blur-3xl dark:bg-sky-500/12" />
      </div>
      <SiteHeader />

      <main id="juz-main" className="page-width py-10">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-slate-600 transition hover:text-sky-700 dark:text-zinc-400 dark:hover:text-cyan-300"
        >
          <ArrowLeft className="h-4 w-4" />
          Алдыңғы бетке оралу
        </Link>

        <div className="mx-auto mt-8 max-w-xl">
          <Card className="overflow-hidden">
            <CardHeader className="space-y-4">
              <div className="space-y-2">
                <p className="hero-line text-xs font-semibold text-sky-700 dark:text-cyan-300" style={{ animationDelay: "0.06s" }}>JUZBOOK</p>
                <div className="hero-line bg-gradient-to-r from-slate-950 via-sky-700 to-cyan-500 bg-clip-text text-transparent dark:from-white dark:via-cyan-200 dark:to-emerald-300" style={{ animationDelay: "0.16s" }}>
                  <CardTitle>Жүйеге кіру</CardTitle>
                </div>
              </div>
              <CardDescription className="hero-line" style={{ animationDelay: "0.3s" }}>Электронды пошта мен құпия сөзіңізді енгізіңіз.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-5" onSubmit={form.handleSubmit(onSubmit)}>
                <div className="space-y-2">
                  <label className="text-sm text-slate-600 dark:text-zinc-400">Электронды пошта</label>
                  <Input type="email" placeholder="mail@example.com" {...form.register("email")} />
                  {form.formState.errors.email ? (
                    <p className="text-sm text-rose-600 dark:text-rose-300">{form.formState.errors.email.message}</p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <label className="text-sm text-slate-600 dark:text-zinc-400">Құпия сөз</label>
                  <Input type="password" placeholder="Құпия сөз" {...form.register("password")} />
                  {form.formState.errors.password ? (
                    <p className="text-sm text-rose-600 dark:text-rose-300">{form.formState.errors.password.message}</p>
                  ) : null}
                </div>

                <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? (
                    <>
                      <Spinner />
                      Кіру тексеріліп жатыр...
                    </>
                  ) : (
                    "Кіру"
                  )}
                </Button>
              </form>

              {isJuz40Enabled ? (
                <div className="mt-5">
                  <div className="flex items-center gap-3 text-xs text-slate-400 dark:text-zinc-500">
                    <span className="h-px flex-1 bg-slate-200 dark:bg-zinc-800" />
                    немесе
                    <span className="h-px flex-1 bg-slate-200 dark:bg-zinc-800" />
                  </div>
                  <a
                    href={`/api/auth/juz40/start${redirectPath ? `?redirect=${encodeURIComponent(redirectPath)}` : ""}`}
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
                  >
                    <span className="grid h-6 w-6 place-items-center rounded-xl bg-gradient-to-br from-sky-500 to-cyan-500 text-xs font-black text-white">
                      j40
                    </span>
                    juz40 арқылы кіру
                  </a>
                </div>
              ) : null}

              <p className="mt-5 text-sm text-slate-600 dark:text-zinc-400">
                <Link
                  href="/forgot-password"
                  className="font-medium text-sky-700 hover:text-sky-800 dark:text-cyan-300 dark:hover:text-cyan-200"
                >
                  Құпия сөзді ұмыттыңыз ба?
                </Link>
              </p>

              <p className="mt-3 text-sm text-slate-600 dark:text-zinc-400">
                Аккаунтыңыз жоқ па?{" "}
                <Link
                  href="/register"
                  className="font-medium text-sky-700 hover:text-sky-800 dark:text-cyan-300 dark:hover:text-cyan-200"
                >
                  Тіркелу
                </Link>
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

function AuthPageFallback() {
  return (
    <div className="page-shell">
      <SiteHeader />
      <main id="juz-main" className="page-width py-10">
        <div className="mx-auto mt-8 flex max-w-xl justify-center">
          <Spinner />
        </div>
      </main>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<AuthPageFallback />}>
      <LoginForm />
    </Suspense>
  );
}
