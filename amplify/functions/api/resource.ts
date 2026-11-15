import { defineFunction } from "@aws-amplify/backend";

export const gameApi = defineFunction({
  name: "quizrush-game-api",
  entry: "./handler.ts",
  resourceGroupName: "game",
  timeoutSeconds: 120,
});
