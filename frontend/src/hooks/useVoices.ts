import { useCallback, useEffect, useState } from "react";
import { getVoices, type Voice } from "@/lib/api";

export function useVoices(): {
  voices: Voice[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
} {
  const [voices, setVoices] = useState<Voice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const refetch = useCallback(() => {
    setRefreshTrigger((t) => t + 1);
  }, []);

  useEffect(() => {
    setLoading(true);
    getVoices()
      .then((data) => {
        setVoices(data.voices);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load voices"))
      .finally(() => setLoading(false));
  }, [refreshTrigger]);

  return { voices, loading, error, refetch };
}
