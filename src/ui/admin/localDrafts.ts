import { readDrafts, type Draft } from "../../drafts";
import { message } from "../common/message";

export type DraftLibrary = { drafts: Draft[]; error: string };
export type DraftLookup = { draft?: Draft; error: string };

export const EMPTY_LIBRARY: DraftLibrary = { drafts: [], error: "" };

/** Reads all local drafts. Only call after the storage opt-in. */
export function loadDrafts(): DraftLibrary {
  try { return { drafts: readDrafts(), error: "" }; }
  catch (caught) { return { drafts: [], error: message(caught) }; }
}

/** Reads one local draft. Only call after the storage opt-in. */
export function loadDraft(id: string): DraftLookup {
  try {
    const draft = readDrafts().find((item) => item.id === id);
    return { draft, error: draft ? "" : "Dieser Entwurf wurde nicht gefunden." };
  } catch (caught) { return { draft: undefined, error: message(caught) }; }
}
