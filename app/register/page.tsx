"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useAuth } from "@/components/state/auth-context";
import { SiteHeader } from "@/components/site/site-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ComboPicker } from "@/components/ui/combo-picker";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { comboOptions } from "@/lib/combo-options";
import { registerRequestSchema, type RegisterRequestInput } from "@/lib/security/auth-validation";

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refreshSession, session, isReady, setSelectedCombo } = useAuth();
  const redirectPath = useMemo(() => searchParams.get("redirect") || "", [searchParams]);

  const form = useForm<RegisterRequestInput>({
    resolver: zodResolver(registerRequestSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      selectedCombo: undefined,
      isAgreedToTerms: false
    }
  });

  const isAgreedToTerms = form.watch("isAgreedToTerms");

  useEffect(() => {
    if (!isReady || !session) {
      return;
    }

    router.replace("/");
  }, [isReady, router, session]);

  async function onSubmit(values: RegisterRequestInput) {
    const response = await fetch("/api/auth/register", {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(values)
    });

    const payload = (await response.json().catch(() => ({}))) as { error?: string; message?: string };
    if (!response.ok) {
      toast.error(payload.error || "Тіркелу мүмкін болмады.");
      return;
    }

    setSelectedCombo(values.selectedCombo);
    await refreshSession();
    toast.success(payload.message || "Тіркелу сәтті аяқталды.");
    router.replace(redirectPath || "/");
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
          href="/login"
          className="inline-flex items-center gap-2 text-sm text-slate-600 transition hover:text-sky-700 dark:text-zinc-400 dark:hover:text-cyan-300"
        >
          <ArrowLeft className="h-4 w-4" />
          Кіру бетіне оралу
        </Link>

        <div className="mx-auto mt-8 max-w-3xl">
          <Card className="overflow-hidden">
            <CardHeader className="space-y-4">
              <div className="space-y-2">
                <p className="hero-line text-xs font-semibold uppercase tracking-[0.12em] text-sky-700 dark:text-cyan-300" style={{ animationDelay: "0.06s" }}>
                  JUZBOOK
                </p>
                <div className="hero-line bg-gradient-to-r from-slate-950 via-sky-700 to-emerald-500 bg-clip-text text-transparent dark:from-white dark:via-cyan-200 dark:to-emerald-300" style={{ animationDelay: "0.16s" }}>
                  <CardTitle>Жаңа аккаунт ашу</CardTitle>
                </div>
              </div>
              <CardDescription className="hero-line" style={{ animationDelay: "0.3s" }}>
                Аты-жөніңізді, email, құпия сөз және ҰБТ комбинациясын толтырыңыз.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-5" onSubmit={form.handleSubmit(onSubmit)}>
                <div className="space-y-2">
                  <label className="text-sm text-slate-600 dark:text-zinc-400">Аты-жөні</label>
                  <Input type="text" placeholder="Аты-жөніңіз" {...form.register("name")} />
                  {form.formState.errors.name ? (
                    <p className="text-sm text-rose-600 dark:text-rose-300">{form.formState.errors.name.message}</p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <label className="text-sm text-slate-600 dark:text-zinc-400">Электронды пошта</label>
                  <Input type="email" placeholder="mail@example.com" {...form.register("email")} />
                  {form.formState.errors.email ? (
                    <p className="text-sm text-rose-600 dark:text-rose-300">{form.formState.errors.email.message}</p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <label className="text-sm text-slate-600 dark:text-zinc-400">Құпия сөз</label>
                  <Input
                    type="password"
                    placeholder="Кемінде 8 таңба және 1 сан"
                    {...form.register("password")}
                  />
                  {form.formState.errors.password ? (
                    <p className="text-sm text-rose-600 dark:text-rose-300">{form.formState.errors.password.message}</p>
                  ) : null}
                </div>

                <div className="space-y-3">
                  <label className="text-sm text-slate-600 dark:text-zinc-400">ҰБТ комбинациясы</label>
                  <ComboPicker
                    value={form.watch("selectedCombo")}
                    options={comboOptions}
                    onChange={(combo) =>
                      form.setValue("selectedCombo", combo, {
                        shouldValidate: true,
                        shouldDirty: true
                      })
                    }
                    error={form.formState.errors.selectedCombo?.message}
                  />
                  {form.formState.errors.selectedCombo ? (
                    <p className="text-sm text-rose-600 dark:text-rose-300">
                      {form.formState.errors.selectedCombo.message}
                    </p>
                  ) : null}
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-900/70">
                  <label className="flex items-start gap-3">
                    <Checkbox
                      checked={Boolean(isAgreedToTerms)}
                      onChange={(event) =>
                        form.setValue("isAgreedToTerms", event.target.checked, {
                          shouldValidate: true,
                          shouldDirty: true
                        })
                      }
                    />
                    <span className="text-sm leading-7 text-slate-700 dark:text-zinc-200">
                      Мен{" "}
                      <Link
                        href="/terms"
                        target="_blank"
                        className="font-medium text-sky-700 underline underline-offset-4 hover:text-sky-800 dark:text-cyan-300 dark:hover:text-cyan-200"
                      >
                        Пайдаланушылық келісім шарттарымен
                      </Link>{" "}
                      және{" "}
                      <Link
                        href="/privacy"
                        target="_blank"
                        className="font-medium text-sky-700 underline underline-offset-4 hover:text-sky-800 dark:text-cyan-300 dark:hover:text-cyan-200"
                      >
                        Құпиялылық саясатымен
                      </Link>{" "}
                      келісемін және дербес деректерімді өңдеуге рұқсат беремін
                    </span>
                  </label>
                  {form.formState.errors.isAgreedToTerms ? (
                    <p className="mt-3 text-sm text-rose-600 dark:text-rose-300">
                      {form.formState.errors.isAgreedToTerms.message}
                    </p>
                  ) : null}
                </div>

                <Button type="submit" className="w-full" disabled={form.formState.isSubmitting || !isAgreedToTerms}>
                  {form.formState.isSubmitting ? (
                    <>
                      <Spinner />
                      Тіркеліп жатыр...
                    </>
                  ) : (
                    "Тіркелу"
                  )}
                </Button>
              </form>

              <p className="mt-5 text-sm text-slate-600 dark:text-zinc-400">
                Бұрыннан аккаунтыңыз бар ма?{" "}
                <Link
                  href="/login"
                  className="font-medium text-sky-700 hover:text-sky-800 dark:text-cyan-300 dark:hover:text-cyan-200"
                >
                  Кіру
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
        <div className="mx-auto mt-8 flex max-w-3xl justify-center">
          <Spinner />
        </div>
      </main>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<AuthPageFallback />}>
      <RegisterForm />
    </Suspense>
  );
}
