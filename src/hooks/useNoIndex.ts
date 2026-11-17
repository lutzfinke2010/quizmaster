import { useEffect } from "react";

/** Teilnahme- und Einladungsseiten sollen nicht in Suchmaschinen landen. */
export function useNoIndex() {
  useEffect(() => {
    let tag = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    const existed = Boolean(tag);
    const previous = tag?.content;
    if (!tag) {
      tag = document.createElement("meta");
      tag.name = "robots";
      document.head.append(tag);
    }
    tag.content = "noindex,nofollow";
    return () => {
      if (!tag) return;
      if (existed && previous !== undefined) tag.content = previous;
      else tag.remove();
    };
  }, []);
}
