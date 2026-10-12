# JUZBOOK PostgreSQL Жоғары Жүктеме Үлгісі

## Prisma үшін ұсынылатын орта айнымалылары

```env
# PgBouncer арқылы өтетін негізгі URL
DATABASE_URL="postgresql://juzbook_app:strong_password@pgbouncer:6432/juzbook?pgbouncer=true&connection_limit=20&pool_timeout=30"

# Prisma migrate және әкімшілік операциялар үшін тікелей URL
DIRECT_DATABASE_URL="postgresql://juzbook_admin:strong_password@postgres:5432/juzbook?connection_limit=5&pool_timeout=30"

# Next.js сервері үшін айқын pooled URL
DATABASE_URL_POOLED="postgresql://juzbook_app:strong_password@pgbouncer:6432/juzbook?pgbouncer=true&connection_limit=20&pool_timeout=30"

# FastAPI үшін async URL
FASTAPI_DATABASE_URL="postgresql+asyncpg://juzbook_app:strong_password@pgbouncer:6432/juzbook"
```

## FastAPI үшін SQLAlchemy async engine үлгісі

```python
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool
import os

# PgBouncer қолданылғанда қолданбаның өз ішінде артық pool өсірмеу маңызды.
DATABASE_URL = os.getenv("FASTAPI_DATABASE_URL", "")

engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    pool_pre_ping=True,
    pool_recycle=1800,
    pool_timeout=30,
    max_overflow=0,
    pool_size=20,
    poolclass=NullPool,
)

SessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)
```

## Next.js үшін негізгі қағида

- Оқу каталогы сияқты жеңіл беттерде `view=navigation` режимін қолдану керек.
- Ауыр `content` өрісін тек нақты оқу бетіне кіргенде ғана сұрау керек.
- `PrismaClient` әр сервер процесінде бір рет қана ашылуы тиіс.
- `DATABASE_URL_POOLED` әрдайым PgBouncer-ге бағытталуы тиіс.
