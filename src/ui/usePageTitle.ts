import { useEffect } from "react";

let originalTitle: string | null = null;

export function usePageTitle(title: string) {
  useEffect(() => {
    originalTitle ??= document.title;
    document.title = `${title} – RateLama`;
    return () => { document.title = originalTitle ?? document.title; };
  }, [title]);
}
