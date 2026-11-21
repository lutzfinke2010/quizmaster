import { questionSchema, quizSchema } from "../../domain/quiz";

export type EditorStep = 1 | 2;

/** Fields shown in the first editor step; errors there send the user back to it. */
export const BASICS_FIELDS = ["title", "description", "category"] as const;

const basicsSchema = quizSchema.pick({ title: true, description: true, category: true });

export const answerLetter = (index: number) => String.fromCharCode(65 + index);

export const basicsComplete = (values: unknown) => basicsSchema.safeParse(values).success;

export const questionComplete = (question: unknown) => questionSchema.safeParse(question).success;
