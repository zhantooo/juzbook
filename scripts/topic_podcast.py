import asyncio
import json
import re
import sys
from pathlib import Path

import edge_tts


MAX_CHUNK_LENGTH = 1200
# edge-tts тұрақты 48 кбит/с MP3 береді, сондықтан бір миллисекунд = 6 байт.
# Бөліктер біріктірілгенде уақыт осы арқылы дәл есептеледі.
BYTES_PER_MS = 6
RETRY_COUNT = 3
VOICE_FALLBACKS = [
    "kk-KZ-AigulNeural",
    "kk-KZ-DauletNeural",
]


def split_text(text: str, max_length: int = MAX_CHUNK_LENGTH) -> list[str]:
    normalized = re.sub(r"\s+", " ", text).strip()
    if not normalized:
        return []

    sentences = re.split(r"(?<=[\.\!\?])\s+", normalized)
    chunks: list[str] = []
    current = ""

    for sentence in sentences:
        sentence = sentence.strip()
        if not sentence:
            continue

        if len(sentence) > max_length:
            words = sentence.split(" ")
            partial = ""
            for word in words:
                candidate = f"{partial} {word}".strip()
                if len(candidate) <= max_length:
                    partial = candidate
                    continue

                if partial:
                    chunks.append(partial)
                partial = word

            if partial:
                if current:
                    chunks.append(current)
                    current = ""
                chunks.append(partial)
            continue

        candidate = f"{current} {sentence}".strip()
        if len(candidate) <= max_length:
            current = candidate
        else:
            if current:
                chunks.append(current)
            current = sentence

    if current:
        chunks.append(current)

    return chunks


async def synthesize_chunk(text: str, voices: list[str]) -> tuple[bytes, list[dict]]:
    """Мәтін бөлігін дыбысқа айналдырады және әр сөздің уақытын қайтарады."""
    last_error: Exception | None = None

    for _ in range(RETRY_COUNT):
        for voice in voices:
            try:
                try:
                    # edge-tts әдепкіде сөйлем шекарасын береді — бізге әр сөздің
                    # уақыты керек, сондықтан WordBoundary режимін сұраймыз.
                    communicate = edge_tts.Communicate(text, voice, boundary="WordBoundary")
                except TypeError:
                    # Ескі нұсқаларда бұл параметр жоқ
                    communicate = edge_tts.Communicate(text, voice)
                audio_parts: list[bytes] = []
                boundaries: list[dict] = []
                async for message in communicate.stream():
                    if message["type"] == "audio":
                        audio_parts.append(message["data"])
                    elif message["type"] == "WordBoundary":
                        # edge-tts уақытты 100 наносекундпен береді — миллисекундқа айналдырамыз
                        boundaries.append(
                            {
                                "t": int(message["offset"]) // 10000,
                                "d": int(message["duration"]) // 10000,
                                "w": str(message["text"]),
                            }
                        )

                if audio_parts:
                    return b"".join(audio_parts), boundaries
            except edge_tts.exceptions.NoAudioReceived as error:
                last_error = error
                await asyncio.sleep(1.2)
                continue
            except Exception as error:
                last_error = error
                await asyncio.sleep(1.2)
                continue

    if last_error is not None:
        raise last_error

    raise edge_tts.exceptions.NoAudioReceived("No audio was received.")


async def main() -> None:
    if len(sys.argv) < 4:
        raise SystemExit("Аргументтер жеткіліксіз")

    text = sys.argv[1]
    output_path = Path(sys.argv[2])
    requested_voice = sys.argv[3].strip()
    # Төртінші аргумент берілсе, сөздердің уақыт белгілері JSON болып жазылады
    marks_path = Path(sys.argv[4]) if len(sys.argv) > 4 and sys.argv[4].strip() else None

    output_path.parent.mkdir(parents=True, exist_ok=True)
    chunks = split_text(text)
    if not chunks:
        print("EDGE_TTS_EMPTY_TEXT", file=sys.stderr)
        raise SystemExit(24)

    voices = [voice for voice in [requested_voice, *VOICE_FALLBACKS] if voice]
    unique_voices = list(dict.fromkeys(voices))

    all_marks: list[dict] = []
    base_ms = 0
    total_bytes = 0

    try:
        output_path.write_bytes(b"")
        with output_path.open("ab") as output_file:
            for chunk in chunks:
                audio_bytes, boundaries = await synthesize_chunk(chunk, unique_voices)
                output_file.write(audio_bytes)

                for boundary in boundaries:
                    all_marks.append(
                        {"t": base_ms + boundary["t"], "d": boundary["d"], "w": boundary["w"]}
                    )

                # Келесі бөліктің уақыты осы бөліктің нақты ұзақтығынан кейін басталады
                total_bytes += len(audio_bytes)
                base_ms = total_bytes // BYTES_PER_MS
    except edge_tts.exceptions.NoAudioReceived:
        print("EDGE_TTS_NO_AUDIO", file=sys.stderr)
        raise SystemExit(21)
    except ModuleNotFoundError:
        print("EDGE_TTS_NOT_INSTALLED", file=sys.stderr)
        raise SystemExit(22)
    except Exception as error:
        print(f"EDGE_TTS_ERROR: {error}", file=sys.stderr)
        raise SystemExit(23)

    if marks_path is not None:
        marks_path.parent.mkdir(parents=True, exist_ok=True)
        marks_path.write_text(
            json.dumps({"durationMs": total_bytes // BYTES_PER_MS, "marks": all_marks}, ensure_ascii=False),
            encoding="utf-8",
        )


if __name__ == "__main__":
    asyncio.run(main())
