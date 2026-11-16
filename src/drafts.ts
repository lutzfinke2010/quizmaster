import { z } from "zod";
import { quizSchema, type Quiz } from "./domain/quiz";

export const localDraftStorageKey = "quizrush.local-drafts.v1";
const draftSchema = z.object({ id: z.string().uuid(), quiz: quizSchema });
const draftsSchema = z.array(draftSchema);
export type Draft = z.infer<typeof draftSchema>;

export function readDrafts(): Draft[] {
  try {
    const raw = localStorage.getItem(localDraftStorageKey);
    if (raw === null) return [];
    return draftsSchema.parse(JSON.parse(raw));
  } catch {
    throw new Error("Die lokalen Entwürfe konnten nicht gelesen werden. Bitte Browserspeicher prüfen.");
  }
}

export function saveDrafts(drafts: Draft[]): void {
  try {
    localStorage.setItem(localDraftStorageKey, JSON.stringify(draftsSchema.parse(drafts)));
  } catch {
    throw new Error("Die lokalen Entwürfe konnten nicht gespeichert werden. Bitte Browserspeicher prüfen.");
  }
}

export function clearDrafts(): void {
  try { localStorage.removeItem(localDraftStorageKey); }
  catch { throw new Error("Die lokalen Entwürfe konnten nicht gelöscht werden. Bitte Browserspeicher prüfen."); }
}

export function newDraft(quiz: Quiz): Draft {
  return { id: crypto.randomUUID(), quiz: structuredClone(quiz) };
}
