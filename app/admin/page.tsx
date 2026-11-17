import { Suspense } from "react";
import { AdminPage } from "@/components/admin/admin-page";
import { EnvironmentBanner } from "@/components/admin/environment-banner";

// Бет динамикалық: орта белгісі `process.env`-тен оқылады, сондықтан
// құрастыру кезінде бекітіліп қалмауы керек.
export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <Suspense>
      <div className="mx-auto w-full max-w-7xl px-4 pt-4 sm:px-6">
        <EnvironmentBanner />
      </div>
      <AdminPage />
    </Suspense>
  );
}
