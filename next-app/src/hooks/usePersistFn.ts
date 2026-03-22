import { useCallback, useEffect, useRef } from "react";

type AnyFn = (...args: never[]) => unknown;

/**
 * usePersistFn instead of useCallback to reduce cognitive load
 */
export function usePersistFn<T extends AnyFn>(fn: T) {
  const fnRef = useRef<T>(fn);
  useEffect(() => {
    fnRef.current = fn;
  }, [fn]);

  const persistFn = useCallback((...args: Parameters<T>) => {
    return fnRef.current(...args);
  }, []);

  return persistFn as T;
}
