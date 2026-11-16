import { useEffect, useState } from "react";

/** Below this width the board overlays its side panels on the canvas instead of placing them beside it. */
export const COMPACT_MEDIA_QUERY = "(max-width: 899px)";
/** Storybook hides its sidebar below this width (its MEDIA_DESKTOP_BREAKPOINT is 600px). */
export const MOBILE_MEDIA_QUERY = "(max-width: 599px)";

const matches = (query: string): boolean => {
  try {
    return globalThis.matchMedia(query).matches;
  } catch {
    return false;
  }
};

export const useMediaQuery = (query: string): boolean => {
  const [matched, setMatched] = useState(() => matches(query));
  useEffect(() => {
    let list: MediaQueryList;
    try {
      list = globalThis.matchMedia(query);
    } catch {
      return undefined;
    }
    const onChange = () => setMatched(list.matches);
    onChange();
    list.addEventListener("change", onChange);
    return () => list.removeEventListener("change", onChange);
  }, [query]);
  return matched;
};
