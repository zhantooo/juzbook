#!/bin/sh
# Контейнер іске қосылғандағы дайындық.
#
# `prisma migrate deploy` емес, `db push`: репозиторийдегі ескі көші-қон
# бұзылған, сондықтан жобада әрқашан push қолданылады (AGENTS.md).
set -e

echo "[entrypoint] Postgres күтілуде…"
i=0
until node -e "
  const net = require('node:net');
  const u = new URL(process.env.DATABASE_URL);
  const s = net.connect(Number(u.port || 5432), u.hostname);
  s.on('connect', () => { s.end(); process.exit(0); });
  s.on('error', () => process.exit(1));
" 2>/dev/null; do
  i=$((i + 1))
  if [ "$i" -ge 60 ]; then
    echo "[entrypoint] Postgres 60 әрекеттен кейін де жауап бермеді" >&2
    exit 1
  fi
  sleep 2
done
echo "[entrypoint] Postgres дайын"

echo "[entrypoint] оқу бөлігінің схемасы шығарылуда…"
node ./node_modules/prisma/build/index.js db push --schema=prisma/schema.prisma --skip-generate

echo "[entrypoint] Arena схемасы шығарылуда…"
node ./node_modules/prisma/build/index.js db push --schema=prisma/arena.prisma --skip-generate

echo "[entrypoint] сервер іске қосылуда"
exec "$@"
