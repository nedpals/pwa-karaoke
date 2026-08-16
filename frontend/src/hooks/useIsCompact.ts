import { useEffect, useState } from "react";

const COMPACT_QUERY = "(max-width: 640px)";

export function useIsCompact(): boolean {
  const [isCompact, setIsCompact] = useState(
    () => typeof window !== "undefined" && window.matchMedia(COMPACT_QUERY).matches,
  );

  useEffect(() => {
    const query = window.matchMedia(COMPACT_QUERY);
    const update = () => setIsCompact(query.matches);

    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return isCompact;
}
