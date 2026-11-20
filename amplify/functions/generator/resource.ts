import { defineFunction, secret } from "@aws-amplify/backend";

export const quizGenerator = defineFunction({
  name: "quizrush-quiz-generator",
  entry: "./handler.ts",
  resourceGroupName: "game",
  timeoutSeconds: 900,
  memoryMB: 256,
  logging: { retention: "2 weeks" },
  environment: {
    OPENAI_API_KEY: secret("open_ai_key"),
    OPENAI_MODEL: process.env.QUIZRUSH_OPENAI_MODEL ?? "gpt-4.1-mini",
  },
});
