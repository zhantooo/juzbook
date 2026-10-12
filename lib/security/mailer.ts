import nodemailer from "nodemailer";

function getMailerConfig() {
  return {
    host: (process.env.SMTP_HOST || "").trim(),
    port: Number(process.env.SMTP_PORT || "587"),
    user: (process.env.SMTP_USER || "").trim(),
    pass: (process.env.SMTP_PASS || "").trim(),
    from: (process.env.SMTP_FROM || process.env.SMTP_USER || "").trim()
  };
}

export async function sendPasswordResetMail(email: string, resetLink: string) {
  const config = getMailerConfig();

  if (!config.host || !config.user || !config.pass || !config.from) {
    throw new Error("Пошта сервері бапталмаған. SMTP деректерін толтырыңыз.");
  }

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    auth: {
      user: config.user,
      pass: config.pass
    }
  });

  await transporter.sendMail({
    from: config.from,
    to: email,
    subject: "JUZBOOK құпиясөзін қалпына келтіру",
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.7;color:#0f172a">
        <h2>Құпиясөзді қалпына келтіру</h2>
        <p>Төмендегі батырма арқылы жаңа құпиясөз орната аласыз:</p>
        <p>
          <a href="${resetLink}" style="display:inline-block;padding:12px 18px;border-radius:12px;background:#0284c7;color:#ffffff;text-decoration:none;font-weight:600">
            Құпиясөзді жаңарту
          </a>
        </p>
        <p>Егер бұл сұранысты өзіңіз жібермесеңіз, бұл хатты елемей қойыңыз.</p>
      </div>
    `
  });
}

export async function sendRoleUpdatedMail(email: string, role: "USER" | "ADMIN") {
  const config = getMailerConfig();

  if (!config.host || !config.user || !config.pass || !config.from) {
    throw new Error("Пошта сервері бапталмаған. SMTP деректерін толтырыңыз.");
  }

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    auth: {
      user: config.user,
      pass: config.pass
    }
  });

  const roleLabel = role === "ADMIN" ? "әкімші" : "оқушы";

  await transporter.sendMail({
    from: config.from,
    to: email,
    subject: "JUZBOOK рөлі жаңартылды",
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.7;color:#0f172a">
        <h2>Рөліңіз жаңартылды</h2>
        <p>Сіздің JUZBOOK жүйесіндегі рөліңіз <strong>${roleLabel}</strong> болып өзгертілді.</p>
        <p>Енді жүйеге қайта кіріп, жаңа қолжетімділіктеріңізді пайдалана аласыз.</p>
      </div>
    `
  });
}
