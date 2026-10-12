import { Suspense } from "react";
import { AdminPage } from "@/components/admin/admin-page";

export default function Page() {
  return (
    <Suspense>
      <AdminPage />
    </Suspense>
  );
}
