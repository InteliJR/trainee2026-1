import { useCallback, useEffect, useRef, useState, type DependencyList } from 'react';
import { TASK_POLL_MS } from '../config';
import { api, type CollectorTask } from './index';

interface AsyncState<T> {
  data?: T;
  error?: unknown;
  loading: boolean;
}

interface AsyncOptions<T> {
  /** Recarrega em silêncio a cada N ms (pausa com a aba oculta). */
  pollMs?: number;
  /** Só continua o polling enquanto retornar true. */
  pollWhile?: (data: T | undefined) => boolean;
}

// Carrega dados mantendo o que já estava na tela se uma atualização falhar (o coletor não fica sem tela).
export function useAsync<T>(fn: () => Promise<T>, deps: DependencyList, options: AsyncOptions<T> = {}) {
  const [state, setState] = useState<AsyncState<T>>({ loading: true });
  const stateRef = useRef(state);
  stateRef.current = state;
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const seq = useRef(0);

  const load = useCallback((silent: boolean) => {
    const id = ++seq.current;
    if (!silent) setState((s) => ({ data: s.data, loading: true }));
    fnRef
      .current()
      .then((data) => id === seq.current && setState({ data, loading: false }))
      .catch((error: unknown) => id === seq.current && setState((s) => ({ data: s.data, error, loading: false })));
  }, []);

  useEffect(() => {
    load(false);
    return () => {
      seq.current++;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const { pollMs, pollWhile } = options;
  const pollWhileRef = useRef(pollWhile);
  pollWhileRef.current = pollWhile;
  useEffect(() => {
    if (!pollMs) return;
    const timer = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      if (pollWhileRef.current && !pollWhileRef.current(stateRef.current.data)) return;
      load(true);
    }, pollMs);
    return () => clearInterval(timer);
  }, [pollMs, load]);

  const reload = useCallback(() => load(false), [load]);
  const refresh = useCallback(() => load(true), [load]);
  return { ...state, reload, refresh };
}

export const useTasks = (opts?: { poll?: boolean; pollWhile?: (data: CollectorTask[] | undefined) => boolean }) =>
  useAsync(() => api.listTasks(), [], {
    pollMs: opts?.poll ? TASK_POLL_MS : undefined,
    pollWhile: opts?.pollWhile,
  });
