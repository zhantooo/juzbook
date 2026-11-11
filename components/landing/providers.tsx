"use client";

import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";
import { Toaster } from "sonner";
import { AuthProvider } from "@/components/state/auth-context";
import { CatalogProvider } from "@/components/state/catalog-context";
import { PomodoroProvider } from "@/components/state/pomodoro-context";

/**
 * Сайт жарық режимде ашылады. Бұрын әдепкісі қараңғы еді де, бірінші рет
 * кірген оқушы түнгі түсті көретін.
 *
 * `enableSystem` қосулы: құрылғысында қараңғы режим тұрған оқушы «Жүйе»
 * нұсқасын таңдай алады. Әдепкісі бәрібір жарық — себебі `defaultTheme`
 * «system» емес, «light». Бұрын түсті өзі ауыстырған оқушының таңдауы
 * localStorage-та сақталған, сондықтан оған тиіспейді.
 */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <CatalogProvider>
        <AuthProvider>
          <PomodoroProvider>
            {children}
            <Toaster richColors position="top-right" />
          </PomodoroProvider>
        </AuthProvider>
      </CatalogProvider>
    </ThemeProvider>
  );
}
