import { useCallback, useEffect, useState } from 'react';
export function useFetch(fetcher, fallback = null) {
  const [state, setState] = useState({ data: fallback, loading: true, error: '' });
  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: '' }));
    try {
      const data = await fetcher();
      setState({ data, loading: false, error: '' });
    } catch (error) {
      setState({ data: fallback, loading: false, error: error.message });
    }
  }, [fetcher, fallback]);
  useEffect(() => {
    load();
  }, [load]);
  return { ...state, retry: load };
}
