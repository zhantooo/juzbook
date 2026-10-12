import { notFound } from "next/navigation";
import { Layers3 } from "lucide-react";
import { SpecificationDetailClient } from "@/components/specifications/specification-detail-client";
import { SiteHeader } from "@/components/site/site-header";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export default async function SpecificationPage({
  params
}: {
  params: Promise<{ specificationId: string }>;
}) {
  const { specificationId } = await params;
  const specification = await prisma.specification.findUnique({
    where: { id: specificationId },
    select: {
      id: true,
      title: true,
      description: true,
      subject: { select: { id: true, name: true } },
      topics: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          topic: {
            select: {
              id: true,
              title: true,
              excerpt: true,
              bookId: true,
              book: { select: { title: true } }
            }
          }
        }
      }
    }
  });

  if (!specification) {
    notFound();
  }

  return (
    <div className="page-shell">
      <SiteHeader />
      <main id="juz-main" className="page-width py-10">
        <section className="glass-card p-8">
          <div className="hero-line inline-flex items-center gap-2 rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700 dark:bg-cyan-500/10 dark:text-cyan-300" style={{ animationDelay: "0.06s" }}>
            <Layers3 className="h-4 w-4" />
            Спецификация
          </div>
          <h1 className="intro-mask mt-4 text-5xl font-semibold">
            <span className="hero-rise block" style={{ animationDelay: "0.14s" }}>{specification.title}</span>
          </h1>
          <p className="hero-line mt-4 text-base leading-8 text-slate-600 dark:text-zinc-400" style={{ animationDelay: "0.4s" }}>
            {specification.description || `${specification.subject.name} пәні бойынша таңдалған дайындық бағыты.`}
          </p>
        </section>

        <SpecificationDetailClient
          specificationId={specification.id}
          subjectId={specification.subject.id}
          items={specification.topics}
        />
      </main>
    </div>
  );
}
