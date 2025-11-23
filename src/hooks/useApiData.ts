const API_PREFIX = import.meta.env.VITE_API_PREFIX || "/api";

import { useEffect, useState } from "react";

/**
 * useApiData<T>
 * Simple data-fetching hook with optional normalization and basic error/loading states.
 *
 * Params:
 * - url: resource path (appended to API_PREFIX)
 * - initialValue: initial state before data arrives
 * - normalizer?: optional mapping function to shape the fetched payload
 *
 * Returns:
 * - { data, loading, error }
 */

export default function useApiData<T>(
  url: string,
  initialValue: T,
  normalizer?: (data: any) => T
) {
  const [data, setData] = useState<T>(initialValue);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Guard to avoid setting state on unmounted components
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        // Build request URL: API prefix + relative path
        const res = await fetch(`${API_PREFIX}${url}`);
        // Surface HTTP errors as exceptions
        if (!res.ok)
          throw new Error(
            `Kunde inte hämta ${url}: ${res.status} ${res.statusText}`
          );
        const result = await res.json();
        // Apply optional normalizer before storing the data
        if (alive) {
          setData(normalizer ? normalizer(result) : result);
          setError(null);
        }
      } catch (e: any) {
        // Store a user-friendly error message
        if (alive) {
          console.error(`Error fetching ${url}:`, e);
          setError(e?.message || "Något gick fel");
        }
      } finally {
        // Always clear loading if still mounted
        if (alive) setLoading(false);
      }
    })();
    // Cleanup: mark as unmounted to ignore late responses
    return () => {
      alive = false;
    };
  }, [url, normalizer]);

  return { data, loading, error };
}
