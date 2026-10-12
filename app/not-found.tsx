import Link from "next/link";

export default function NotFound() {
  return (
    <div className="page-shell flex items-center justify-center px-5 py-20">
      <div className="glass-card max-w-xl p-10 text-center">
        <h1 className="intro-mask text-5xl font-semibold">
          <span className="hero-rise block" style={{ animationDelay: "0.08s" }}>Бет табылмады</span>
        </h1>
        <p className="hero-line mt-4 text-base leading-8 text-slate-600 dark:text-zinc-400" style={{ animationDelay: "0.28s" }}>
          Бұл бет әзірге жоқ немесе сұралған контент әлі жарияланбаған.
        </p>
        <Link
          href="/"
          className="hero-line mt-8 inline-flex rounded-full bg-sky-700 px-6 py-3 text-sm font-medium text-white dark:bg-cyan-400 dark:text-zinc-950"
          style={{ animationDelay: "0.4s" }}
        >
          Басты бетке оралу
        </Link>
      </div>
    </div>
  );
}
