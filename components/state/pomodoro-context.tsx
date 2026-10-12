"use client";

import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { loadFromStorage, saveToStorage } from "@/lib/storage";
import type { PomodoroMode } from "@/lib/types";

type PomodoroState = {
  mode: PomodoroMode;
  isRunning: boolean;
  secondsLeft: number;
  cycleCount: number;
  notification: string | null;
  isMinimized: boolean;
  canMove: boolean;
  position: {
    x: number;
    y: number;
  };
  hasCustomPosition: boolean;
};

type PomodoroContextValue = PomodoroState & {
  start: () => void;
  pause: () => void;
  reset: () => void;
  clearNotification: () => void;
  toggleMinimized: () => void;
  setCanMove: (enabled: boolean) => void;
  setPosition: (position: { x: number; y: number }) => void;
};

const STORAGE_KEY = "juzbook-pomodoro";
const FOCUS_SECONDS = 25 * 60;
const BREAK_SECONDS = 5 * 60;

const defaultState: PomodoroState = {
  mode: "focus",
  isRunning: false,
  secondsLeft: FOCUS_SECONDS,
  cycleCount: 0,
  notification: null,
  isMinimized: false,
  canMove: false,
  position: { x: 0, y: 0 },
  hasCustomPosition: false
};

const PomodoroContext = createContext<PomodoroContextValue | null>(null);

export function PomodoroProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PomodoroState>(defaultState);

  useEffect(() => {
    setState(loadFromStorage<PomodoroState>(STORAGE_KEY, defaultState));
  }, []);

  useEffect(() => {
    saveToStorage(STORAGE_KEY, state);
  }, [state]);

  useEffect(() => {
    if (!state.isRunning) {
      return;
    }

    const timer = window.setInterval(() => {
      setState((current) => {
        if (current.secondsLeft > 1) {
          return {
            ...current,
            secondsLeft: current.secondsLeft - 1
          };
        }

        const nextMode: PomodoroMode = current.mode === "focus" ? "break" : "focus";
        const nextSeconds = nextMode === "focus" ? FOCUS_SECONDS : BREAK_SECONDS;
        const nextCycleCount = current.mode === "break" ? current.cycleCount + 1 : current.cycleCount;

        return {
          ...current,
          mode: nextMode,
          secondsLeft: nextSeconds,
          cycleCount: nextCycleCount,
          notification:
            current.mode === "focus"
              ? "Оқу кезеңі аяқталды. Енді 5 минут демалыс уақыты басталды."
              : "Демалыс уақыты аяқталды. Жаңа 25 минуттық оқу кезеңіне кірісе аласыз.",
          isRunning: true
        };
      });
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [state.isRunning]);

  const value = useMemo<PomodoroContextValue>(
    () => ({
      ...state,
      start: () => setState((current) => ({ ...current, isRunning: true })),
      pause: () => setState((current) => ({ ...current, isRunning: false })),
      reset: () =>
        setState((current) => ({
          ...current,
          isRunning: false,
          mode: "focus",
          secondsLeft: FOCUS_SECONDS,
          notification: null
        })),
      clearNotification: () => setState((current) => ({ ...current, notification: null })),
      toggleMinimized: () => setState((current) => ({ ...current, isMinimized: !current.isMinimized })),
      setCanMove: (enabled) =>
        setState((current) => ({
          ...current,
          canMove: enabled,
          hasCustomPosition: enabled ? current.hasCustomPosition : false
        })),
      setPosition: (position) =>
        setState((current) => ({
          ...current,
          position,
          hasCustomPosition: true
        }))
    }),
    [state]
  );

  return <PomodoroContext.Provider value={value}>{children}</PomodoroContext.Provider>;
}

export function usePomodoro() {
  const context = useContext(PomodoroContext);

  if (!context) {
    throw new Error("usePomodoro must be used inside PomodoroProvider");
  }

  return context;
}
