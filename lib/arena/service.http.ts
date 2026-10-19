/**
 * `ArenaService`-тің нағыз іске асырылуы: бәрі сервердегі API арқылы.
 *
 * Мок нұсқасымен бірдей интерфейсті ұстайды, сондықтан экран кодын өзгертудің
 * қажеті жоқ — тек қай қызметті алатынын таңдау жеткілікті.
 *
 * `subscribe` — сауалнама (polling) арқылы: күй жиі сұралып, өзгерісі
 * оқиғаға айналдырылады. SSE-ден гөрі қарапайым әрі serverless ортада
 * сенімді жұмыс істейді (ұзақ ашық байланыс керек емес).
 */
import type {
  ArenaService,
  HistoryRow,
  LeaderboardRow,
  MatchEvent,
  MatchOutcome,
  MatchState,
  QueueResult,
  SubjectRating
} from "@/lib/arena/service";

/** Күйді сұрау аралығы */
const POLL_MS = 800;

async function call<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    cache: "no-store"
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error || "Серверге сұраныс сәтсіз болды.");
  }

  return (await response.json()) as T;
}

export const httpArenaService: ArenaService = {
  async joinQueue(subjectId) {
    return call<QueueResult>("/api/arena/queue", {
      method: "POST",
      body: JSON.stringify({ subjectId })
    });
  },

  async leaveQueue() {
    await call<{ ok: boolean }>("/api/arena/queue", { method: "DELETE" });
  },

  async pollQueue(subjectId) {
    return call<QueueResult>(`/api/arena/queue?subjectId=${encodeURIComponent(subjectId)}`);
  },

  async createPrivateMatch(subjectId) {
    return call<{ matchId: string; code: string }>("/api/arena/private", {
      method: "POST",
      body: JSON.stringify({ subjectId })
    });
  },

  async joinByCode(code) {
    return call<{ matchId: string }>("/api/arena/private", {
      method: "POST",
      body: JSON.stringify({ code })
    });
  },

  async getMatch(matchId) {
    return call<MatchState>(`/api/arena/match/${encodeURIComponent(matchId)}`);
  },

  async submitAnswer(matchId, position, chosenIndex) {
    await call<{ ok: boolean }>(`/api/arena/match/${encodeURIComponent(matchId)}/answer`, {
      method: "POST",
      body: JSON.stringify({ position, chosenIndex })
    });
  },

  async getOutcome(matchId) {
    return call<MatchOutcome>(`/api/arena/match/${encodeURIComponent(matchId)}/outcome`);
  },

  subscribe(matchId, onEvent) {
    let stopped = false;
    let timer: number | null = null;
    // Қайталанған оқиға жібермеу үшін соңғы көрсетілген күйді есте сақтаймыз
    let lastQuestionPosition = -1;
    let lastResultPosition = -1;
    let ended = false;

    const emit = (event: MatchEvent) => {
      if (!stopped) {
        onEvent(event);
      }
    };

    const poll = async () => {
      if (stopped) {
        return;
      }

      try {
        const state = await httpArenaService.getMatch(matchId);
        emit({ type: "state", state });

        if (state.lastResult && state.lastResult.position !== lastResultPosition) {
          lastResultPosition = state.lastResult.position;
          emit({ type: "answer-result", result: state.lastResult, state });
        }

        if (state.question && state.question.position !== lastQuestionPosition) {
          lastQuestionPosition = state.question.position;
          emit({ type: "question", question: state.question, state });
        }

        if ((state.status === "finished" || state.status === "abandoned") && !ended) {
          ended = true;
          const outcome = await httpArenaService.getOutcome(matchId);
          emit({ type: "match-end", outcome });
          return;
        }
      } catch {
        // Желі үзілсе үнсіз қайталаймыз: келесі сұраныс күйді қалпына келтіреді
      }

      if (!stopped && !ended) {
        timer = window.setTimeout(() => void poll(), POLL_MS);
      }
    };

    void poll();

    return () => {
      stopped = true;
      if (timer !== null) {
        window.clearTimeout(timer);
      }
    };
  },

  async getRatings() {
    const payload = await call<{ rows: SubjectRating[] }>("/api/arena/ratings?view=ratings");
    return payload.rows;
  },

  async getLeaderboard(subjectId, limit) {
    const payload = await call<{ rows: LeaderboardRow[] }>(
      `/api/arena/ratings?view=leaderboard&subjectId=${encodeURIComponent(subjectId)}${
        limit ? `&limit=${limit}` : ""
      }`
    );
    return payload.rows;
  },

  async getHistory(subjectId, limit) {
    const payload = await call<{ rows: HistoryRow[] }>(
      `/api/arena/ratings?view=history${subjectId ? `&subjectId=${encodeURIComponent(subjectId)}` : ""}${
        limit ? `&limit=${limit}` : ""
      }`
    );
    return payload.rows;
  }
};
