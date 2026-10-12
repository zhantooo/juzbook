# FastAPI қауіпсіздік үлгісі

Бұл репода FastAPI коды жоқ. Төмендегі үлгі `FastAPI + PostgreSQL + Redis` серверіне дәл осы JUZBOOK қауіпсіздік ережелерін көшіру үшін берілді.

## 1. JWT және рөл тексеруі

```python
from fastapi import Depends, HTTPException, Request
from jose import jwt, JWTError
from pydantic import BaseModel, EmailStr

SECRET_KEY = "production-та env арқылы беріледі"
ALGORITHM = "HS256"

class SessionPayload(BaseModel):
    sub: str
    email: EmailStr
    role: str
    exp: int

def parse_bearer_token(request: Request) -> str:
    header = request.headers.get("Authorization", "")
    if not header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Қайтадан жүйеге кіріп көріңіз.")
    return header.replace("Bearer ", "", 1).strip()

async def require_admin(request: Request, db=Depends(get_db)):
    token = parse_bearer_token(request)
    try:
        payload = SessionPayload.model_validate(jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM]))
    except JWTError as error:
        raise HTTPException(status_code=401, detail="Сессия дерегі жарамсыз. Қайта кіріңіз.") from error

    user = await db.user.find_unique(
        where={"id": payload.sub},
        select={"id": True, "email": True, "role": True},
    )
    if not user or user["email"] != payload.email or user["role"] != payload.role:
        raise HTTPException(status_code=401, detail="Сессия дерегі жарамсыз. Қайта кіріңіз.")

    if user["role"] != "ADMIN":
        raise HTTPException(status_code=403, detail="Бұл бөлімге кіруге құқығыңыз жоқ!")

    return user
```

## 2. Ownership тексеруі

```python
async def delete_note(note_id: str, current_user=Depends(require_user), db=Depends(get_db)):
    note = await db.note.find_unique(where={"id": note_id}, select={"id": True, "userId": True})
    if not note:
        raise HTTPException(status_code=404, detail="Конспект табылмады.")
    if note["userId"] != current_user["id"]:
        raise HTTPException(status_code=401, detail="Бұл әрекетті орындауға рұқсат жоқ!")

    await db.note.delete(where={"id": note_id})
    return {"message": "Конспект өшірілді."}
```

## 3. Redis rate limit

```python
import time
from fastapi import HTTPException
from redis.asyncio import Redis

redis = Redis.from_url("redis://localhost:6379/0", encoding="utf-8", decode_responses=True)

async def check_ai_limit(identity: str):
    bucket = int(time.time() // 60)
    key = f"juzbook:ai:{identity}:{bucket}"
    count = await redis.incr(key)
    await redis.expire(key, 60)
    if count > 3:
        raise HTTPException(
            status_code=429,
            detail="Сұраныс шегінен астыңыз. Жүйе шамалыдан кейін қайта іске қосылады (минутына 3 рет рұқсат етілген)"
        )
```

## 4. Pydantic валидациясы

```python
from pydantic import BaseModel, field_validator
import re

SCRIPT_PATTERN = re.compile(r"<script[\\s\\S]*?>[\\s\\S]*?</script>", re.IGNORECASE)

class GenerateTestBody(BaseModel):
    text: str
    topicTitle: str
    count: int
    difficulty: str

    @field_validator("text", "topicTitle")
    @classmethod
    def validate_script(cls, value: str) -> str:
        if SCRIPT_PATTERN.search(value):
            raise ValueError("Мәтінде қауіпті скрипт болмауы керек.")
        return value.strip()
```

## 5. PostgreSQL pooling

```env
DATABASE_URL=postgresql://app:password@db:5432/juzbook?pgbouncer=true&connection_limit=20&pool_timeout=30
DIRECT_DATABASE_URL=postgresql://app:password@db:5432/juzbook
REDIS_URL=redis://localhost:6379/0
```
