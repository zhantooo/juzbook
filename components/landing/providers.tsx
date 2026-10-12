"use client";

import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";
import { Toaster } from "sonner";
import { AuthProvider } from "@/components/state/auth-context";
import { CatalogProvider } from "@/components/state/catalog-context";
import { PomodoroProvider } from "@/components/state/pomodoro-context";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
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
