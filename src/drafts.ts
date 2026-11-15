import { z } from "zod";
import { quizSchema, type Quiz } from "./domain/quiz";

const storageKey = "quizrush.local-drafts.v1";
const draftSchema = z.object({ id: z.string().uuid(), quiz: quizSchema });
const draftsSchema = z.array(draftSchema);
export type Draft = z.infer<typeof draftSchema>;

export function readDrafts(): Draft[] {
  const raw = localStorage.getItem(storageKey);
  if (raw === null) return [];
  try {
    return draftsSchema.parse(JSON.parse(raw));
  } catch {
    throw new Error("Die lokalen Entwürfe konnten nicht gelesen werden. Bitte Browserspeicher prüfen.");
  }
}

export function saveDrafts(drafts: Draft[]): void {
  try {
    localStorage.setItem(storageKey, JSON.stringify(draftsSchema.parse(drafts)));
  } catch {
    throw new Error("Die lokalen Entwürfe konnten nicht gespeichert werden. Bitte Browserspeicher prüfen.");
  }
}

export function newDraft(quiz: Quiz): Draft {
  return { id: crypto.randomUUID(), quiz: structuredClone(quiz) };
}
