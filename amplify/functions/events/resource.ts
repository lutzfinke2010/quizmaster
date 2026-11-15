import { defineFunction } from "@aws-amplify/backend";

export const subscriptionAuth = defineFunction({
  name: "quizrush-subscription-auth", entry: "./authorize.ts", resourceGroupName: "game", timeoutSeconds: 30,
  logging: { retention: "2 weeks" },
});
export const eventPublisher = defineFunction({
  name: "quizrush-event-publisher", entry: "./publisher.ts", resourceGroupName: "events", timeoutSeconds: 60,
  logging: { retention: "2 weeks" },
});
