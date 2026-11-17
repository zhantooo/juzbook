/**
 * OpenTelemetry-ді іске қосады.
 *
 * Next.js бұл файлды сервер басталғанда бір рет шақырады (қосымша
 * баптау қажет емес). Осы жерден шыққан өлшемдер, іздер мен журналдар
 * OTLP арқылы жинаушыға жіберіледі.
 *
 * Жинаушының мекенжайы `OTEL_EXPORTER_OTLP_ENDPOINT` айнымалысымен
 * беріледі. Ол берілмесе, OTel ештеңе жібермейді де, қолданба
 * бұрынғыдай жұмыс істей береді — яғни бақылау жүйесі құласа, оқушыға
 * әсер етпейді.
 *
 * Қызмет атауына орта қосылады (`juzbook-development`, `juzbook-production`),
 * сондықтан бір тақтада екі орта араласып кетпейді.
 */
export async function register() {
  // Жинаушы көрсетілмесе, OTel мүлде қосылмайды: бос экспорттаушы әр
  // сұранымда қатені журналға жазып, шуыл тудырар еді.
  if (!process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
    return;
  }

  // Edge орындалу ортасында Node API-лері жоқ, сондықтан тек серверде.
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  const { registerOTel } = await import("@vercel/otel");
  const { resolveEnvironment } = await import("@/lib/runtime-env");

  const { environment } = resolveEnvironment();

  registerOTel({
    serviceName: `juzbook-${environment}`,
    attributes: {
      "deployment.environment": environment,
      "service.namespace": "juzbook"
    }
  });
}
