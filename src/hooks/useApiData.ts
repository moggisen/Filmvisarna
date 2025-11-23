const API_PREFIX = import.meta.env.VITE_API_PREFIX || "/api";

import { useEffect, useState } from "react";

export default function useApiData<T>(
  url: string,
  initialValue: T,
  normalizer?: (data: any) => T
) {
  const [data, setData] = useState<T>(initialValue);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`${API_PREFIX}${url}`);
        if (!res.ok)
          throw new Error(
            `Kunde inte hämta ${url}: ${res.status} ${res.statusText}`
          );
        const result = await res.json();
        if (alive) {
          setData(normalizer ? normalizer(result) : result);
          setError(null);
        }
      } catch (e: any) {
        if (alive) {
          console.error(`Error fetching ${url}:`, e);
          setError(e?.message || "Något gick fel");
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [url, normalizer]);

  return { data, loading, error };
}
