# syntax=docker/dockerfile:1
#
# JUZBOOK — frontend пен backend бір образда.
#
# Next.js-те екеуі бір қосымша: беттер де, `app/api/**` маршруттары да сол
# серверден беріледі. Сондықтан бөлек «static» контейнердің қажеті жоқ —
# статикалық файлдар (`.next/static`, `public/`) осы образдың ішінде тұрады.
#
# Debian (bookworm-slim) әдейі алынды, Alpine емес: Prisma қозғалтқышы мен
# libsql-дің нативті модулі glibc-ке жиналған дайын нұсқаларын қолданады,
# ал musl-да оларды өзің құрастыруға тура келер еді.

# ---------- 1-кезең: тәуелділіктер ----------
FROM node:22-bookworm-slim AS deps
WORKDIR /app

RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# Алдымен тек манифесттер: олар сирек өзгереді, сондықтан npm ci қабаты
# кэште қалады да, кодты өзгерткенде қайта жүрмейді.
COPY package.json package-lock.json ./
# postinstall екі схема бойынша prisma generate жүргізеді, сондықтан схемалар
# тәуелділіктерді орнатқанға дейін керек.
COPY prisma ./prisma

# generate кезінде қосылым ашылмайды, бірақ айнымалының болғаны тыныш.
ENV DATABASE_URL="postgresql://postgres:postgres@db:5432/juzbook?schema=public"
ENV ARENA_DATABASE_URL="file:/app/data/arena.db"
RUN npm ci

# ---------- 2-кезең: құрастыру ----------
FROM node:22-bookworm-slim AS builder
WORKDIR /app

RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# next.config.ts осы айнымалыны көргенде ғана standalone режимін қосады.
# Vercel оны ешқашан орнатпайды, сондықтан ондағы құрастыру өзгеріссіз қалады.
ENV DOCKER_BUILD=1
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Құрастыру кезінде дерекқорға қосылу қажет емес, бірақ Prisma клиенті
# жолдың пішімін тексереді. Нағыз мәні жұмыс кезінде compose-тан беріледі.
ENV DATABASE_URL="postgresql://postgres:postgres@db:5432/juzbook?schema=public"
ENV ARENA_DATABASE_URL="file:/app/data/arena.db"

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/generated ./generated
COPY . .

RUN npm run build

# ---------- 3-кезең: жұмыс образы ----------
FROM node:22-bookworm-slim AS runner
WORKDIR /app

RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates wget \
 && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
# 0.0.0.0 болмаса сервер тек контейнердің ішінен көрінеді.
ENV HOSTNAME=0.0.0.0

# standalone шығысы тек шынымен қажет модульдерді алып қалады.
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Prisma: клиент `generated/` ішінде (schema.prisma-дағы output), ал контейнер
# іске қосылғанда схеманы бос дерекқорға шығару үшін CLI де керек.
COPY --from=builder /app/generated ./generated
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma


COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# Arena-ның SQLite файлы осында жазылады (compose-та бұл — тұрақты том).
RUN mkdir -p /app/data && chown -R node:node /app/data /app/.next

USER node
EXPOSE 3000

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["node", "server.js"]
