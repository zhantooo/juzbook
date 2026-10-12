"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { SiteHeader } from "@/components/site/site-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { resetPasswordRequestSchema } from "@/lib/security/auth-validation";

type ResetPasswordInput = {
  password: string;
};

export default function ResetPasswordPage() {
  const router = useRouter();
  const token = useMemo(() => {
    if (typeof window === "undefined") {
      return "";
    }

    return new URLSearchParams(window.location.search).get("token") || "";
  }, []);

  const form = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordRequestSchema.pick({ password: true })),
    defaultValues: {
      password: ""
    }
  });

  async function onSubmit(values: ResetPasswordInput) {
    if (!token) {
      toast.error("Қалпына келтіру сілтемесі жарамсыз.");
      return;
    }

    const response = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        token,
        password: values.password
      })
    });

    const payload = (await response.json().catch(() => ({}))) as { error?: string; message?: string };
    if (!response.ok) {
      toast.error(payload.error || "Құпия сөзді жаңарту мүмкін болмады.");
      return;
    }

    toast.success(payload.message || "Құпия сөз сәтті жаңартылды.");
    router.push("/login");
  }

  return (
    <div className="page-shell">
      <SiteHeader />
      <main id="juz-main" className="page-width py-10">
        <Link
          href="/login"
          className="inline-flex items-center gap-2 text-sm text-slate-600 transition hover:text-sky-700 dark:text-zinc-400 dark:hover:text-cyan-300"
        >
          <ArrowLeft className="h-4 w-4" />
          Кіру бетіне оралу
        </Link>

        <div className="mx-auto mt-8 max-w-xl">
          <Card>
            <CardHeader>
              <CardTitle className="intro-mask">
                <span className="hero-rise block" style={{ animationDelay: "0.08s" }}>Жаңа құпия сөз орнату</span>
              </CardTitle>
              <CardDescription className="hero-line" style={{ animationDelay: "0.26s" }}>Құпия сөз кемінде 8 таңбадан тұрып, ішінде кемінде бір сан болуы керек.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-5" onSubmit={form.handleSubmit(onSubmit)}>
                <div className="space-y-2">
                  <label className="text-sm text-slate-600 dark:text-zinc-400">Жаңа құпия сөз</label>
                  <Input type="password" placeholder="Кемінде 8 таңба және 1 сан" {...form.register("password")} />
                  {form.formState.errors.password ? (
                    <p className="text-sm text-rose-600 dark:text-rose-300">{form.formState.errors.password.message}</p>
                  ) : null}
                </div>

                <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? (
                    <>
                      <Spinner />
                      Жаңартылып жатыр...
                    </>
                  ) : (
                    "Құпия сөзді жаңарту"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
