"use client";

import Link from "next/link";
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
import { forgotPasswordRequestSchema } from "@/lib/security/auth-validation";

type ForgotPasswordInput = {
  email: string;
};

export default function ForgotPasswordPage() {
  const router = useRouter();
  const form = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordRequestSchema),
    defaultValues: {
      email: ""
    }
  });

  async function onSubmit(values: ForgotPasswordInput) {
    const response = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(values)
    });

    const payload = (await response.json().catch(() => ({}))) as { error?: string; message?: string };
    if (!response.ok) {
      toast.error(payload.error || "Хатты жіберу мүмкін болмады.");
      return;
    }

    toast.success(payload.message || "Қалпына келтіру хаты жіберілді.");
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
                <span className="hero-rise block" style={{ animationDelay: "0.08s" }}>Құпия сөзді қалпына келтіру</span>
              </CardTitle>
              <CardDescription className="hero-line" style={{ animationDelay: "0.26s" }}>Тіркелген email адресіңізді енгізіңіз. Қалпына келтіру сілтемесі поштаңызға жіберіледі.</CardDescription>
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

                <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? (
                    <>
                      <Spinner />
                      Хат жіберіліп жатыр...
                    </>
                  ) : (
                    "Хат жіберу"
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
