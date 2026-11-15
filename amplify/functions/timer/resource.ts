import { defineFunction } from "@aws-amplify/backend";

export const timerStep = defineFunction({
  name: "quizrush-timer-step",
  entry: "./step.ts",
  resourceGroupName: "game",
  timeoutSeconds: 120,
  logging: { retention: "2 weeks" },
});

export const timerDispatch = defineFunction({
  name: "quizrush-timer-dispatch",
  entry: "./dispatch.ts",
  resourceGroupName: "game",
  timeoutSeconds: 120,
  logging: { retention: "2 weeks" },
});

export const timerSweep = defineFunction({
  name: "quizrush-timer-sweep",
  entry: "./sweep.ts",
  resourceGroupName: "game",
  timeoutSeconds: 50,
  logging: { retention: "2 weeks" },
  schedule: "every 1m",
});
