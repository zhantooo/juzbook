"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LockKeyhole } from "lucide-react";
import { useAuth } from "@/components/state/auth-context";

function getAllowedRedirect(role?: "USER" | "ADMIN" | "SUPERADMIN" | string | null) {
  if (role === "SUPERADMIN") {
    return "/admin/users";
  }

  if (role === "ADMIN") {
    return "/admin";
  }

  return "/";
}

export function RouteGuard({
  children,
  role
}: {
  children: ReactNode;
  role?: "USER" | "ADMIN" | "SUPERADMIN";
}) {
  const router = useRouter();
  const { isReady, session } = useAuth();

  useEffect(() => {
    if (!isReady) {
      return;
    }

    if (!session) {
      router.push("/login");
      return;
    }

    if (role) {
      const hasAccess =
        role === "SUPERADMIN"
          ? session.role === "SUPERADMIN"
          : role === "ADMIN"
            ? session.role === "ADMIN" || session.role === "SUPERADMIN"
            : session.role === "USER";

      if (!hasAccess) {
        router.push(getAllowedRedirect(session.role));
      }
    }
  }, [isReady, role, router, session]);

  const hasAccess =
    !role || !session
      ? !role
      : role === "SUPERADMIN"
        ? session.role === "SUPERADMIN"
        : role === "ADMIN"
          ? session.role === "ADMIN" || session.role === "SUPERADMIN"
          : session.role === "USER";

  if (!isReady || !session || !hasAccess) {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-3xl items-center justify-center px-5 py-16">
        <div className="glass-card w-full p-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-sky-100 text-sky-700 dark:bg-cyan-500/10 dark:text-cyan-300">
            <LockKeyhole className="h-7 w-7" />
          </div>
          <h2 className="mt-5 text-3xl font-semibold">Қолжетімділікті тексеріп жатырмыз</h2>
          <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-zinc-400">
            Белсенді сессия табылмаса, жүйе сізді кіру бетіне автоматты түрде бағыттайды.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
