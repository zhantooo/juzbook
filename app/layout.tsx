import type { Metadata } from "next";
import { PT_Serif } from "next/font/google";
import localFont from "next/font/local";
import type { ReactNode } from "react";
import { PomodoroTimer } from "@/components/pomodoro/pomodoro-timer";
import { Providers } from "@/components/landing/providers";
import { READING_MODE_SCRIPT } from "@/components/reader/reading-mode";
import { SiteFooter } from "@/components/site/site-footer";
import "./globals.css";

const juzSans = localFont({
  src: [
    { path: "../public/fonts/JUZ40-Regular.otf", weight: "400", style: "normal" },
    { path: "../public/fonts/JUZ40-Medium.otf", weight: "500", style: "normal" },
    { path: "../public/fonts/JUZ40-Bold.otf", weight: "700", style: "normal" }
  ],
  variable: "--font-juz-sans",
  display: "swap"
});

// PT Serif — қазақ әліпбиінің барлық әрпін (ә, ғ, қ, ң, ө, ұ, ү, һ, і) толық
// қолдайды. Georgia мен Times оларды дұрыс көрсетпейді, сондықтан оқу режиміндегі
// "Кітап қарпі" осы қаріпке көшірілді.
const readingSerif = PT_Serif({
  subsets: ["latin", "cyrillic", "cyrillic-ext"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
  variable: "--font-reading-serif",
  display: "swap"
});

export const metadata: Metadata = {
  metadataBase: new URL("https://juzbook.kz"),
  title: "JUZBOOK | ҰБТ-ға арналған оқу платформасы",
  description: "JUZBOOK — пәндер, кітаптар, оқу бөлімі, конспекттер және басқару панелі бар заманауи оқу платформасы.",
  openGraph: {
    title: "JUZBOOK | ҰБТ-ға арналған оқу платформасы",
    description: "Пәндік каталог, оқу бөлімі, конспекттер, прогресс және басқару құралдары бір платформада жиналған.",
    url: "https://juzbook.kz",
    siteName: "JUZBOOK",
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title: "JUZBOOK",
    description: "ҰБТ-ға арналған заманауи оқу платформасы"
  }
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // Қаріп айнымалылары <html>-де тұруы керек: оқу режимі --reading-font мәнін
    // осы элементте құрайды, ал айнымалы body-де болса ол жерде көрінбей,
    // font-family ережесі толық жарамсыз болып қалады.
    <html lang="kk" suppressHydrationWarning className={`${juzSans.variable} ${readingSerif.variable}`}>
      <head>
        {/* Оқу баптаулары бет боялғанға дейін қолданылады — жыпылықтау болмайды */}
        <script dangerouslySetInnerHTML={{ __html: READING_MODE_SCRIPT }} />
      </head>
      <body className="bg-slate-50 font-sans text-slate-900 antialiased dark:bg-zinc-950 dark:text-zinc-50">
        <a href="#juz-main" className="skip-link">
          Негізгі мазмұнға өту
        </a>
        <Providers>
          {children}
          <SiteFooter />
          <PomodoroTimer />
        </Providers>
      </body>
    </html>
  );
}
