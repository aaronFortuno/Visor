import { useState, useCallback } from "react";

const STORAGE_KEY = "visor-input-history";
const MAX_ENTRIES = 50;

export function useInputHistory() {
  const [history, setHistory] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); }
    catch { return []; }
  });
  const [historyIdx, setHistoryIdx] = useState(-1);

  const addToHistory = useCallback((text: string) => {
    setHistory(prev => {
      const next = [text, ...prev.filter(h => h !== text)].slice(0, MAX_ENTRIES);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
    setHistoryIdx(-1);
  }, []);

  const navigateUp = useCallback((currentText: string): string | null => {
    if (currentText && historyIdx < 0) return null; // Don't navigate if typing
    const next = Math.min(historyIdx + 1, history.length - 1);
    if (next >= 0 && next < history.length) {
      setHistoryIdx(next);
      return history[next];
    }
    return null;
  }, [history, historyIdx]);

  const navigateDown = useCallback((): string | null => {
    if (historyIdx < 0) return null;
    const next = historyIdx - 1;
    if (next < 0) {
      setHistoryIdx(-1);
      return "";
    }
    setHistoryIdx(next);
    return history[next];
  }, [history, historyIdx]);

  const resetNavigation = useCallback(() => setHistoryIdx(-1), []);

  return { history, historyIdx, addToHistory, navigateUp, navigateDown, resetNavigation };
}
