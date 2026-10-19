"use client";

import { ArenaMatch } from "@/components/arena/arena-match";
import { RouteGuard } from "@/components/auth/route-guard";
import { SiteHeader } from "@/components/site/site-header";

export function ArenaMatchPage({ subjectId, subjectName }: { subjectId: string; subjectName: string }) {
  return (
    <RouteGuard>
      <ArenaMatchPageContent subjectId={subjectId} subjectName={subjectName} />
    </RouteGuard>
  );
}

/// Кіру тексерісінен бөлек: dev режимінде кірмей-ақ тексеруге мүмкіндік береді
export function ArenaMatchPageContent({ subjectId, subjectName }: { subjectId: string; subjectName: string }) {
  return (
    <div className="page-shell min-h-screen">
      <SiteHeader />
      <main id="juz-main" className="mx-auto w-full max-w-3xl px-5 pb-20 pt-8 sm:px-8">
        <ArenaMatch subjectId={subjectId} subjectName={subjectName} />
      </main>
    </div>
  );
}
