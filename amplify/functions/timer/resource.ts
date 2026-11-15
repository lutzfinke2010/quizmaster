import { defineFunction } from "@aws-amplify/backend";

export const timerStep = defineFunction({
  name: "quizrush-timer-step",
  entry: "./step.ts",
  resourceGroupName: "game",
  timeoutSeconds: 120,
});

export const timerDispatch = defineFunction({
  name: "quizrush-timer-dispatch",
  entry: "./dispatch.ts",
  resourceGroupName: "game",
  timeoutSeconds: 120,
});

export const timerSweep = defineFunction({
  name: "quizrush-timer-sweep",
  entry: "./sweep.ts",
  resourceGroupName: "game",
  timeoutSeconds: 50,
  schedule: "every 1m",
});
