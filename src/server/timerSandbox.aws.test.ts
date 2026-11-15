import { createHash } from "node:crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DeleteCommand, DynamoDBDocumentClient, GetCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { describe, expect, it } from "vitest";
import { QuizStore } from "./quizStore";
import { createSession } from "./createSession";
import { joinSession } from "./participation";
import { startQuestion } from "./startQuestion";
import { DynamoAnswerStore, submitAnswer } from "./submitAnswer";
import { getGameState } from "./gameState";

const tableName = process.env.QUIZRUSH_TIMER_SANDBOX_TABLE;

describe.skipIf(!tableName)("Automatischer Timer in Amplify-Sandbox", () => {
  it("öffnet und wertet eine Frage ohne Browser aus", async () => {
    if (!tableName) throw new Error("Missing sandbox table");
    const raw = new DynamoDBClient({ region: process.env.AWS_REGION || "eu-central-1" });
    const client = DynamoDBDocumentClient.from(raw);
    const owner = { subject: "timer-sandbox-test", groups: ["Quizmasters"] };
    const quiz = await new QuizStore(client, tableName).createQuiz(owner, {
      title: "Timertest", description: "",
      questions: [{ text: "Richtig?", durationSeconds: 5, explanation: "",
        answers: [{ text: "Ja", correct: true }, { text: "Nein", correct: false }] }],
    }, Date.now());
    let session: Awaited<ReturnType<typeof createSession>> | undefined;
    try {
      session = await createSession(client, tableName, { quizId: quiz.quizId }, owner, { retentionDays: 1 }, Date.now());
      await joinSession(client, tableName, session.joinCode, "timer-sandbox-guest", Date.now());
      const pk = `SESSION#${session.sessionId}`;
      const metadata = async () => (await client.send(new GetCommand({
        TableName: tableName, Key: { pk, sk: "META" }, ConsistentRead: true,
      }))).Item;
      const questionItems = await client.send(new QueryCommand({
        TableName: tableName, ConsistentRead: true, KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
        ExpressionAttributeValues: { ":pk": pk, ":prefix": "QUESTION#" },
      }));
      const questionId = questionItems.Items?.[0]?.questionId;
      const version = (await metadata())?.version;
      if (typeof questionId !== "string" || typeof version !== "number") throw new Error("Missing fixture");
      const started = await startQuestion(client, tableName, { sessionId: session.sessionId, questionId, expectedVersion: version }, owner, Date.now());
      const maxWait = Date.now() + 90_000;
      while ((await metadata())?.status !== "QUESTION_OPEN") {
        if (Date.now() > maxWait) throw new Error("Die Frage wurde nicht automatisch geöffnet.");
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
      const open = await getGameState(client, tableName, session.sessionId, "timer-sandbox-guest", Date.now());
      expect(open.reveal).toBeNull();
      await submitAnswer(new DynamoAnswerStore(client, tableName),
        { sessionId: session.sessionId, questionId, choiceId: "a0" }, "timer-sandbox-guest", Date.now());
      while ((await metadata())?.status !== "REVEAL") {
        if (Date.now() > maxWait) throw new Error("Die Frage wurde nicht automatisch ausgewertet.");
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
      const revealed = await getGameState(client, tableName, session.sessionId, "timer-sandbox-guest", Date.now());
      expect(revealed.reveal?.correctChoiceId).toBe("a0");
      const timerKey = { pk, sk: `TIMER#${questionId}#${started.timerId}` };
      while ((await client.send(new GetCommand({ TableName: tableName, Key: timerKey, ConsistentRead: true }))).Item?.status !== "COMPLETE") {
        if (Date.now() > maxWait) throw new Error("Der Timerauftrag wurde nicht abgeschlossen.");
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    } finally {
      if (session) {
        const pk = `SESSION#${session.sessionId}`;
        let cursor: Record<string, unknown> | undefined;
        do {
          const page = await client.send(new QueryCommand({
            TableName: tableName, KeyConditionExpression: "pk = :pk",
            ExpressionAttributeValues: { ":pk": pk }, ExclusiveStartKey: cursor,
          }));
          for (const item of page.Items ?? []) {
            if (typeof item.pk !== "string" || typeof item.sk !== "string") throw new Error("Invalid test item key");
            await client.send(new DeleteCommand({ TableName: tableName, Key: { pk: item.pk, sk: item.sk } }));
          }
          cursor = page.LastEvaluatedKey;
        } while (cursor);
        await client.send(new DeleteCommand({ TableName: tableName, Key: { pk: `CODE#${session.joinCode}`, sk: "META" },
          ConditionExpression: "sessionId = :session", ExpressionAttributeValues: { ":session": session.sessionId } }));
        const hash = createHash("sha256").update(session.presentationToken).digest("hex");
        await client.send(new DeleteCommand({ TableName: tableName, Key: { pk: `PRESENT#${hash}`, sk: "META" } }));
        await client.send(new DeleteCommand({
          TableName: tableName, Key: { pk: `OWNER#${owner.subject}`, sk: `SESSIONTOKEN#${session.sessionId}` },
        }));
      }
      await client.send(new DeleteCommand({
        TableName: tableName, Key: { pk: `OWNER#${owner.subject}`, sk: `QUIZ#${quiz.quizId}` },
      }));
      raw.destroy();
    }
  }, 120_000);
});
