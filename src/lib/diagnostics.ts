import { create } from 'zustand';

export interface LogEntry {
  id: number;
  level: 'warn' | 'error';
  message: string;
  time: number;
}

interface LogState {
  logs: LogEntry[];
  add: (level: LogEntry['level'], message: string) => void;
  clear: () => void;
}

let nextId = 0;
const MAX_LOGS = 100;

export const useLogStore = create<LogState>((set) => ({
  logs: [],
  add: (level, message) =>
    set((s) => {
      const next = [...s.logs, { id: nextId++, level, message, time: Date.now() }];
      if (next.length > MAX_LOGS) next.splice(0, next.length - MAX_LOGS);
      return { logs: next };
    }),
  clear: () => set({ logs: [] }),
}));

export function installConsoleCapture() {
  const orig = { warn: console.warn, error: console.error };
  console.warn = (...args: unknown[]) => {
    useLogStore.getState().add('warn', args.map(formatArg).join(' '));
    orig.warn(...args);
  };
  console.error = (...args: unknown[]) => {
    useLogStore.getState().add('error', args.map(formatArg).join(' '));
    orig.error(...args);
  };
}

function formatArg(v: unknown): string {
  if (typeof v === 'string') return v;
  if (v instanceof Error) return `${v.name}: ${v.message}`;
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}
