import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SiteHeader } from "@/components/site/site-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = {
  title: "Құпиялылық саясаты"
};

export default function PrivacyPage() {
  return (
    <div className="page-shell">
      <div className="page-glow">
        <div className="glow-drift-a absolute left-[-10rem] top-10 h-80 w-80 rounded-full bg-sky-200/35 blur-3xl dark:bg-cyan-500/15" />
        <div className="glow-drift-b absolute bottom-10 right-[-12rem] h-96 w-96 rounded-full bg-cyan-200/30 blur-3xl dark:bg-sky-500/12" />
      </div>
      <SiteHeader />

      <main id="juz-main" className="page-width py-10">
        <Link
          href="/register"
          className="inline-flex items-center gap-2 text-sm text-slate-600 transition hover:text-sky-700 dark:text-zinc-400 dark:hover:text-cyan-300"
        >
          <ArrowLeft className="h-4 w-4" />
          Тіркелу бетіне оралу
        </Link>

        <Card className="mx-auto mt-8 max-w-4xl">
          <CardHeader>
            <p className="hero-line text-xs font-semibold uppercase tracking-[0.12em] text-sky-700 dark:text-cyan-300" style={{ animationDelay: "0.06s" }}>
              JUZBOOK
            </p>
            <CardTitle className="intro-mask">
              <span className="hero-rise block" style={{ animationDelay: "0.14s" }}>Құпиялылық саясаты</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 text-sm leading-7 text-slate-700 dark:text-zinc-300">
            <section className="space-y-3">
              <h2 className="text-base font-semibold text-slate-950 dark:text-white">1. Жалпы қағидалар</h2>
              <p>
                Осы Құпиялылық саясаты Қазақстан Республикасының «Дербес деректер және оларды қорғау туралы» Заңына
                сәйкес әзірленді және JUZBOOK платформасы шеңберінде пайдаланушылардың дербес деректерін жинау,
                өңдеу, сақтау және қорғау тәртібін айқындайды.
              </p>
              <p>
                Платформада тіркелу және сервистерді пайдалану арқылы пайдаланушы осы саясатта көзделген тәртіппен
                өзінің дербес деректерін өңдеуге ерікті түрде келісім береді.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-semibold text-slate-950 dark:text-white">2. Жиналатын деректер құрамы</h2>
              <p>Платформа пайдаланушы туралы мынадай деректерді жинауы мүмкін:</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>аты-жөні;</li>
                <li>электронды пошта мекенжайы;</li>
                <li>жүйеге кірген уақыты мен сессияға қатысты техникалық белгілер.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-semibold text-slate-950 dark:text-white">3. Деректерді өңдеу мақсаты</h2>
              <p>Жиналған деректер мынадай мақсаттарда өңделеді:</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>оқушының оқу прогресін сақтау және қалпына келтіру;</li>
                <li>жеке оқу тәжірибесін баптау және ИИ-тесттерді теңшеу;</li>
                <li>аккаунтқа қауіпсіз кіруді қамтамасыз ету;</li>
                <li>платформаның тұрақтылығын, қауіпсіздігін және сапасын арттыру.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-semibold text-slate-950 dark:text-white">4. Құпиялылық және үшінші тұлғаларға бермеу</h2>
              <p>
                Пайдаланушының дербес деректері құпия сақталады және Қазақстан Республикасының заңнамасында тікелей
                көзделген жағдайларды қоспағанда, үшінші тұлғаларға берілмейді.
              </p>
              <p>
                Платформа иесі деректердің рұқсатсыз қол жеткізуден, жоғалудан, өзгертілуден немесе заңсыз таратылудан
                қорғалуына бағытталған ұйымдастырушылық және техникалық қауіпсіздік шараларын қолданады.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-semibold text-slate-950 dark:text-white">5. Деректерді сақтау мерзімі</h2>
              <p>
                Дербес деректер пайдаланушының аккаунты белсенді болған кезеңде және платформаның заңды мүдделерін
                қамтамасыз ету үшін қажетті мерзім ішінде сақталады, егер Қазақстан Республикасының заңнамасында өзге
                талаптар көзделмесе.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-semibold text-slate-950 dark:text-white">6. Пайдаланушының құқықтары</h2>
              <p>Пайдаланушы:</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>өзінің дербес деректерін өңдеу туралы ақпарат алуға;</li>
                <li>қате немесе ескірген деректерді түзетуді талап етуге;</li>
                <li>заңнамада көзделген жағдайларда деректерді жоюды немесе өңдеуді шектеуді сұрауға құқылы.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-semibold text-slate-950 dark:text-white">7. Қорытынды ережелер</h2>
              <p>
                Осы саясаттың жаңа редакциясы сайтта жарияланған күннен бастап күшіне енеді. Пайдаланушы платформаны
                пайдалануды жалғастыру арқылы саясаттың өзекті нұсқасымен келісетінін растайды.
              </p>
            </section>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
