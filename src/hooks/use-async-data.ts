import { useCallback, useEffect, useRef, useState } from "react";

export function useAsyncData<T>(loader: () => Promise<T>, dependencyKey = "") {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loaderRef = useRef(loader);
  useEffect(() => {
    loaderRef.current = loader;
  }, [loader]);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await loaderRef.current());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Ocurrió un error inesperado.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Data fetching is the external synchronization owned by this hook.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
  }, [reload, dependencyKey]);

  return { data, loading, error, reload, setData };
}
