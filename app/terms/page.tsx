import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SiteHeader } from "@/components/site/site-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = {
  title: "Пайдаланушылық келісім"
};

export default function TermsPage() {
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
              <span className="hero-rise block" style={{ animationDelay: "0.14s" }}>Пайдаланушылық келісім</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 text-sm leading-7 text-slate-700 dark:text-zinc-300">
            <section className="space-y-3">
              <h2 className="text-base font-semibold text-slate-950 dark:text-white">1. Жалпы ережелер</h2>
              <p>
                Осы Пайдаланушылық келісім JUZBOOK білім беру платформасын пайдалану шарттарын, тараптардың құқықтары
                мен міндеттерін, сондай-ақ сервисті қолдану шектерін айқындайды.
              </p>
              <p>
                Платформада тіркелу, жүйеге кіру немесе оның кез келген функциясын пайдалану арқылы пайдаланушы осы
                келісімнің талаптарын толық көлемде қабылдайды.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-semibold text-slate-950 dark:text-white">2. Платформаны пайдалану тәртібі</h2>
              <p>
                Пайдаланушы платформаны тек білім алу, тестілеу, конспект жүргізу, оқу прогресін бақылау және ҰБТ-ға
                дайындалу мақсатында пайдалануға міндеттенеді.
              </p>
              <p>
                Пайдаланушы жүйеге заңсыз араласуға, үшінші тұлғалардың құқықтарын бұзуға, жалған деректер енгізуге,
                сервистің тұрақты жұмысына кедергі келтіруге немесе платформаны заңнамаға қайшы мақсаттарда
                пайдалануға құқылы емес.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-semibold text-slate-950 dark:text-white">3. Ақпарат көздері және авторлық құқық</h2>
              <p>
                JUZBOOK платформасындағы оқу материалдары тек білім беру және ҰБТ-ға дайындалу мақсатында, ашық
                дереккөздер мен қолданыстағы мектеп оқулықтары негізінде ақпараттық-қосымша материал ретінде
                құрастырылған.
              </p>
              <p>
                Платформада көрсетілетін кітап атаулары, баспа туралы мәліметтер, үзінділер, түсіндірмелер және оқу
                мазмұны тек таныстыру, жүйелеу және оқу процесін жеңілдету мақсатына арналады. Материалдарға деген
                барлық авторлық құқықтар олардың заңды иелеріне, соның ішінде авторларға, баспаларға және өзге құқық
                иеленушілерге тиесілі.
              </p>
              <p>
                Пайдаланушыға платформада ұсынылған материалдарды көшіріп алу, қайта жариялау, үшінші тұлғаларға
                тарату, коммерциялық айналымға енгізу немесе құқық иесінің рұқсатынсыз өзге цифрлық ресурстарға жүктеу
                қатаң түрде тыйым салынады.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-semibold text-slate-950 dark:text-white">4. Аккаунт қауіпсіздігі</h2>
              <p>
                Пайдаланушы өзінің аккаунтына қатысты кіру деректерінің, оның ішінде электронды пошта мекенжайы мен
                құпия сөзінің құпия сақталуына өзі жауапты болады.
              </p>
              <p>
                Пайдаланушы өз аккаунты арқылы жүзеге асырылған барлық әрекеттер үшін дербес жауап береді және
                қауіпсіздікке қатысты күмән туындаған жағдайда құпия сөзін дереу өзгертуге міндетті.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-semibold text-slate-950 dark:text-white">5. Шағымдарды қабылдау және материалдарды алып тастау тәртібі</h2>
              <p>
                Егер сіз платформада орналасқан қандай да бір контенттің заңды құқық иесі болсаңыз және оның жариялануы
                сіздің құқықтарыңызды бұзады деп есептесеңіз, juzbook@gmail.com электронды поштасы арқылы жазбаша
                түрде хабарласуыңызды сұраймыз.
              </p>
              <p>
                Шағымда құқық иеленушінің деректері, даулы материалдың нақты сипаттамасы, оған сілтеме және құқықты
                растайтын мәліметтер көрсетілуі тиіс. Шағым негізді деп танылған жағдайда, даулы материал 48 сағат
                ішінде платформадан толықтай жойылады немесе оған қолжетімділік шектеледі.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-semibold text-slate-950 dark:text-white">6. Жауапкершілікті шектеу</h2>
              <p>
                Платформа иесі сервистің үздіксіз және қауіпсіз жұмысын қамтамасыз етуге барынша күш салады, алайда
                техникалық іркілістер, үшінші тарап сервистерінің ақауы немесе пайдаланушы құрылғысына байланысты
                туындайтын қиындықтар үшін шектеулі жауапкершілік шегінде әрекет етеді.
              </p>
              <p>
                Платформа иесі пайдаланушының заңсыз әрекеттері, қате енгізілген деректері немесе осы келісім
                талаптарын бұзуынан туындаған құқықтық салдарлар үшін жауапты болмайды.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-semibold text-slate-950 dark:text-white">7. Қорытынды ережелер</h2>
              <p>
                Осы келісім платформаны дамыту барысына қарай жаңартылуы мүмкін. Жаңартылған нұсқа сайтта жарияланған
                күннен бастап күшіне енеді.
              </p>
              <p>
                Платформаны пайдалануды жалғастыру арқылы пайдаланушы келісімнің өзекті редакциясымен келісетінін
                растайды.
              </p>
            </section>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
