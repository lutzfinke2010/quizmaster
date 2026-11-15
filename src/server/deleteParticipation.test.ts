import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  BatchWriteCommand, DynamoDBDocumentClient, QueryCommand, TransactGetCommand, TransactWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import { beforeEach, describe, expect, it } from "vitest";
import { deleteMyParticipation } from "./participation";

const database = mockClient(DynamoDBDocumentClient);
const db = DynamoDBDocumentClient.from(new DynamoDBClient({ region: "eu-central-1" }));
const identity = "eu-central-1:guest-1";
const now = 1_000;

function meta(status: string) {
  return { status, expiresAt: 10_000, ttl: 10, participantCount: 2, maxParticipants: 100, joinCode: "123456" };
}

function stubMembership(status: string, member = true) {
  database.on(TransactGetCommand).callsFake((input) => {
    const keys = input.TransactItems.map((item: { Get: { Key: { sk: string } } }) => item.Get.Key.sk);
    return { Responses: keys.map((sk: string) => {
      if (sk === "META") return { Item: meta(status) };
      if (sk.startsWith("IDENTITY#")) return member ? { Item: { participantId: "p1" } } : {};
      return { Item: { participantId: "p1", displayName: "Flotter Otter", avatarId: "otter", joinedAt: 1 } };
    }) };
  });
}

describe("Eigene Teilnahme löschen", () => {
  beforeEach(() => {
    database.reset();
    database.on(TransactWriteCommand).resolves({});
    database.on(QueryCommand).callsFake((input) => ({ Items: input.ExpressionAttributeValues[":prefix"] === "ANSWER#"
      ? [{ pk: "SESSION#s1", sk: "ANSWER#q1#p1" }, { pk: "SESSION#s1", sk: "ANSWER#q1#p2" }]
      : [{ pk: "SESSION#s1", sk: "RESULT#q1#p1" }, { pk: "SESSION#s1", sk: "RESULT#q1#p2" }] }));
    database.on(BatchWriteCommand).resolves({});
  });

  it("entfernt Zugriff, Namen und Teilnehmerdaten nur der eigenen Identität", async () => {
    stubMembership("REVEAL");
    expect(await deleteMyParticipation(db, "table", "s1", identity, now)).toBe(true);
    const items = database.commandCalls(TransactWriteCommand)[0].args[0].input.TransactItems ?? [];
    const keys = items.map((item) => (item.Update ?? item.Delete)?.Key);
    expect(keys).toEqual([
      { pk: "SESSION#s1", sk: "META" }, { pk: "SESSION#s1", sk: `IDENTITY#${identity}` },
      { pk: "SESSION#s1", sk: "NAME#Flotter Otter" }, { pk: "SESSION#s1", sk: "PARTICIPANT#p1" },
    ]);
    const batch = database.commandCalls(BatchWriteCommand)[0].args[0].input.RequestItems?.table;
    expect(batch).toEqual([
      { DeleteRequest: { Key: { pk: "SESSION#s1", sk: "ANSWER#q1#p1" } } },
      { DeleteRequest: { Key: { pk: "SESSION#s1", sk: "RESULT#q1#p1" } } },
    ]);
  });

  it("lehnt das Löschen während einer laufenden Frage ab", async () => {
    stubMembership("QUESTION_OPEN");
    await expect(deleteMyParticipation(db, "table", "s1", identity, now)).rejects.toThrow("laufenden Frage");
    expect(database.commandCalls(TransactWriteCommand)).toHaveLength(0);
  });

  it("ist wiederholbar, wenn keine Teilnahme mehr existiert", async () => {
    stubMembership("REVEAL", false);
    expect(await deleteMyParticipation(db, "table", "s1", identity, now)).toBe(true);
    expect(database.commandCalls(TransactWriteCommand)).toHaveLength(0);
  });

  it("verweigert ungültige Sitzungskennungen", async () => {
    await expect(deleteMyParticipation(db, "table", "../x", identity, now)).rejects.toThrow();
  });
});
