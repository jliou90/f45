import { useCallback, useEffect, useRef, useState } from "react";

type QueryStatus = "idle" | "loading" | "success" | "error";

export type QueryState<TData, TError = unknown> = {
  data: TData | null;
  error: TError | null;
  status: QueryStatus;
  isLoading: boolean;
  isSuccess: boolean;
  isError: boolean;
  refetch: () => Promise<void>;
};

export function useQuery<TData, TError = unknown>(
  fn: () => Promise<TData>,
  options?: { enabled?: boolean; deps?: unknown[]; debugLabel?: string },
): QueryState<TData, TError> {
  const enabled = options?.enabled ?? true;
  const deps = options?.deps ?? [];
  const debugLabel = options?.debugLabel ?? fn.name ?? "anonymous_query";
  const fnRef = useRef(fn);
  const depsRef = useRef(deps);
  const debugLabelRef = useRef(debugLabel);
  const executionRef = useRef<number[]>([]);
  const lastWarnAtRef = useRef(0);
  const [status, setStatus] = useState<QueryStatus>("idle");
  const [data, setData] = useState<TData | null>(null);
  const [error, setError] = useState<TError | null>(null);

  useEffect(() => {
    fnRef.current = fn;
  }, [fn]);

  useEffect(() => {
    depsRef.current = deps;
    debugLabelRef.current = debugLabel;
  }, [deps, debugLabel]);

  const execute = useCallback(async () => {
    if (import.meta.env.DEV) {
      const now = Date.now();
      executionRef.current = executionRef.current.filter((ts) => now - ts <= 10_000);
      executionRef.current.push(now);
      if (executionRef.current.length > 8 && now - lastWarnAtRef.current > 10_000) {
        lastWarnAtRef.current = now;
        console.warn(`[useQuery] High refetch rate detected for "${debugLabelRef.current}"`, {
          count10s: executionRef.current.length,
          deps: depsRef.current,
        });
      }
    }
    setStatus("loading");
    setError(null);
    try {
      const result = await fnRef.current();
      setData(result);
      setStatus("success");
    } catch (err) {
      setError(err as TError);
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    void execute();
  }, [enabled, execute, ...deps]);

  return {
    data,
    error,
    status,
    isLoading: status === "loading",
    isSuccess: status === "success",
    isError: status === "error",
    refetch: execute,
  };
}

type MutationStatus = "idle" | "loading" | "success" | "error";

export type MutationState<TData, TVars, TError = unknown> = {
  data: TData | null;
  error: TError | null;
  status: MutationStatus;
  isLoading: boolean;
  isSuccess: boolean;
  isError: boolean;
  mutate: (vars: TVars) => Promise<TData>;
  reset: () => void;
};

export function useMutation<TData, TVars = void, TError = unknown>(
  fn: (vars: TVars) => Promise<TData>,
): MutationState<TData, TVars, TError> {
  const [status, setStatus] = useState<MutationStatus>("idle");
  const [data, setData] = useState<TData | null>(null);
  const [error, setError] = useState<TError | null>(null);

  const mutate = useCallback(
    async (vars: TVars) => {
      setStatus("loading");
      setError(null);
      try {
        const result = await fn(vars);
        setData(result);
        setStatus("success");
        return result;
      } catch (err) {
        setError(err as TError);
        setStatus("error");
        throw err;
      }
    },
    [fn],
  );

  const reset = useCallback(() => {
    setStatus("idle");
    setData(null);
    setError(null);
  }, []);

  return {
    data,
    error,
    status,
    isLoading: status === "loading",
    isSuccess: status === "success",
    isError: status === "error",
    mutate,
    reset,
  };
}
