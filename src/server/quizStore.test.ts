import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import { afterEach, describe, expect, it } from "vitest";
import { exampleQuiz } from "../domain/exampleQuiz";
import { QuizStore } from "./quizStore";

const database = mockClient(DynamoDBDocumentClient);
const store = new QuizStore(DynamoDBDocumentClient.from(new DynamoDBClient({ region: "eu-central-1" })), "table");
const principal = { subject: "owner-1", groups: ["Quizmasters"] };
const quizId = "2ba41d80-30b1-4ad0-9e3f-375cf07cf6f5";

afterEach(() => database.reset());

describe("QuizStore Kategorie", () => {
  it("speichert die Kategorie im Quiz und als Übersichtsattribut", async () => {
    database.on(PutCommand).resolves({});
    await store.createQuiz(principal, { ...exampleQuiz, category: "geografie" }, 1);
    const item = database.commandCalls(PutCommand)[0].args[0].input.Item;
    expect(item).toMatchObject({ summaryCategory: "geografie", quiz: { category: "geografie" } });
  });

  it("legt ohne Kategorie keine undefinierten Attribute an und toleriert null", async () => {
    database.on(PutCommand).resolves({});
    const { category: _category, ...legacy } = exampleQuiz;
    await store.createQuiz(principal, { ...legacy, category: null }, 1);
    const item = database.commandCalls(PutCommand)[0].args[0].input.Item ?? {};
    expect(item).not.toHaveProperty("summaryCategory");
    expect(item.quiz).not.toHaveProperty("category");
  });

  it("entfernt die Kategorie beim Speichern ohne Kategorie", async () => {
    database.on(UpdateCommand).resolves({});
    const { category: _category, ...legacy } = exampleQuiz;
    await store.updateQuiz(principal, quizId, 1, legacy, 2);
    const input = database.commandCalls(UpdateCommand)[0].args[0].input;
    expect(input.UpdateExpression).toContain("REMOVE summaryCategory");
    expect(input.ExpressionAttributeValues).not.toHaveProperty(":category");

    database.resetHistory();
    await store.updateQuiz(principal, quizId, 2, { ...legacy, category: "wissenschaft" }, 3);
    const next = database.commandCalls(UpdateCommand)[0].args[0].input;
    expect(next.UpdateExpression).toContain("summaryCategory = :category");
    expect(next.ExpressionAttributeValues).toMatchObject({ ":category": "wissenschaft" });
  });

  it("liefert die Kategorie in der Übersicht und ignoriert unbekannte Werte", async () => {
    database.on(QueryCommand).resolves({ Items: [
      { quizId, ownerId: "owner-1", version: 1, updatedAt: 1, summaryTitle: "A", summaryDescription: "", questionCount: 1,
        summaryCategory: "tiere-natur" },
      { quizId: "3ba41d80-30b1-4ad0-9e3f-375cf07cf6f5", ownerId: "owner-1", version: 1, updatedAt: 1, summaryTitle: "B",
        summaryDescription: "", questionCount: 1, summaryCategory: "sport" },
    ] });
    const page = await store.listQuizzes(principal);
    expect(page.items[0].category).toBe("tiere-natur");
    expect(page.items[1]).not.toHaveProperty("category");
    expect(database.commandCalls(QueryCommand)[0].args[0].input.ProjectionExpression).toContain("summaryCategory");
  });
});
