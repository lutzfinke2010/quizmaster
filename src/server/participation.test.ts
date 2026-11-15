import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient, GetCommand, QueryCommand, TransactGetCommand, TransactWriteCommand,
  type GetCommandInput, type QueryCommandInput, type TransactGetCommandInput, type TransactWriteCommandInput,
} from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import { beforeEach, describe, expect, it } from "vitest";
import avatars from "../domain/avatars.json";
import { joinSession } from "./participation";

const database = mockClient(DynamoDBDocumentClient);
const db = DynamoDBDocumentClient.from(new DynamoDBClient({ region: "eu-central-1" }));
const records = new Map<string, Record<string, unknown>>();
const now = 1_000;

const keyOf = (pk: string, sk: string) => `${pk}#${sk}`;
function addSession(sessionId: string, joinCode: string) {
  const pk = `SESSION#${sessionId}`;
  records.set(keyOf(pk, "META"), {
    pk, sk: "META", status: "LOBBY", version: 1, expiresAt: 10_000, ttl: 10,
    participantCount: 0, maxParticipants: 100, joinCode,
  });
  records.set(keyOf(`CODE#${joinCode}`, "META"), { sessionId, expiresAt: 10_000 });
}

function conditionalFailure() {
  return Object.assign(new Error("conditional failure"), {
    name: "TransactionCanceledException", CancellationReasons: [{ Code: "ConditionalCheckFailed" }],
  });
}

describe("Avatarvergabe beim Beitritt", () => {
  beforeEach(() => {
    database.reset();
    records.clear();
    addSession("s1", "123456");
    addSession("s2", "654321");
    database.on(GetCommand).callsFake((input: GetCommandInput) => {
      if (!input.Key) throw new Error("Missing key.");
      return { Item: records.get(keyOf(String(input.Key.pk), String(input.Key.sk))) };
    });
    database.on(TransactGetCommand).callsFake((input: TransactGetCommandInput) => ({
      Responses: (input.TransactItems ?? []).map((entry) => {
        const get = entry.Get;
        if (!get?.Key) return {};
        const item = records.get(keyOf(String(get.Key.pk), String(get.Key.sk)));
        return item ? { Item: { ...item } } : {};
      }),
    }));
    database.on(QueryCommand).callsFake((input: QueryCommandInput) => {
      const pk = String(input.ExpressionAttributeValues?.[":pk"]);
      const prefix = String(input.ExpressionAttributeValues?.[":prefix"]);
      return { Items: [...records.values()].filter((item) =>
        item.pk === pk && typeof item.sk === "string" && item.sk.startsWith(prefix)) };
    });
    database.on(TransactWriteCommand).callsFake((input: TransactWriteCommandInput) => {
      const items = input.TransactItems ?? [];
      const update = items.find((item) => "Update" in item);
      const updateInput = update?.Update;
      if (!updateInput?.Key) throw new Error("Missing session update.");
      const metaKey = keyOf(String(updateInput.Key.pk), String(updateInput.Key.sk));
      const meta = records.get(metaKey);
      const values = updateInput.ExpressionAttributeValues ?? {};
      const requiresVersion = updateInput.ConditionExpression?.includes("#version = :version") ?? false;
      const expectedVersion = values[":version"];
      const puts = items.flatMap((item) => {
        const put = item.Put;
        return put?.Item ? [{ put, data: put.Item }] : [];
      });
      if (!meta || meta.status !== "LOBBY" || meta.joinCode !== values[":code"] ||
          Number(meta.expiresAt) <= Number(values[":now"]) || Number(meta.participantCount) >= Number(meta.maxParticipants) ||
          (requiresVersion && meta.version !== expectedVersion) ||
          puts.some(({ data }) => records.has(keyOf(String(data.pk), String(data.sk))))) {
        throw conditionalFailure();
      }
      records.set(metaKey, { ...meta, participantCount: Number(meta.participantCount) + 1,
        version: Number(meta.version) + 1 });
      for (const { data } of puts) records.set(keyOf(String(data.pk), String(data.sk)), data);
      return {};
    });
  });

  it("vergibt in einer Runde die ersten 50 Icons ohne Duplikate", async () => {
    const joined = await Promise.all(Array.from({ length: 50 }, (_, index) =>
      joinSession(db, "table", "123456", `guest-${index}`, now)));
    const ids = joined.map((participant) => participant.avatarId);
    expect(new Set(ids).size).toBe(50);
    expect(new Set(ids)).toEqual(new Set(avatars.avatars.map((avatar) => avatar.id)));
    expect(joined.every((participant) => {
      const label = avatars.avatars.find((avatar) => avatar.id === participant.avatarId)?.label;
      return label !== undefined && participant.displayName.includes(label);
    })).toBe(true);
    expect([...records.keys()].filter((key) => key.includes("#AVATAR#"))).toHaveLength(50);
    await expect(joinSession(db, "table", "123456", "guest-0", now)).resolves.toEqual(joined[0]);
  });

  it("lässt weitere Gäste teilnehmen und verteilt Wiederholungen möglichst ausgeglichen", async () => {
    await Promise.all(Array.from({ length: 50 }, (_, index) =>
      joinSession(db, "table", "123456", `guest-${index}`, now)));
    const more = await Promise.all(Array.from({ length: 50 }, (_, index) =>
      joinSession(db, "table", "123456", `guest-more-${index}`, now)));
    expect(more).toHaveLength(50);
    const counts = new Map(avatars.avatars.map((avatar) => [avatar.id, 0]));
    for (const item of records.values()) {
      if (typeof item.sk === "string" && item.sk.startsWith("PARTICIPANT#") && typeof item.avatarId === "string") {
        counts.set(item.avatarId, (counts.get(item.avatarId) ?? 0) + 1);
      }
    }
    expect(Math.max(...counts.values()) - Math.min(...counts.values())).toBeLessThanOrEqual(1);
  });

  it("macht parallele Join-Retries derselben Identität idempotent", async () => {
    const joined = await Promise.all(Array.from({ length: 10 }, () =>
      joinSession(db, "table", "123456", "same-guest", now)));
    expect(new Set(joined.map((participant) => participant.participantId)).size).toBe(1);
    expect(new Set(joined.map((participant) => participant.avatarId)).size).toBe(1);
    expect(records.get(keyOf("SESSION#s1", "META"))?.participantCount).toBe(1);
    expect(records.get(keyOf("SESSION#s1", "IDENTITY#same-guest"))?.participantId).toBe(joined[0].participantId);
  });

  it("vergibt dieselben Avatar-IDs unabhängig pro Sitzung", async () => {
    const first = await joinSession(db, "table", "123456", "guest-one", now);
    for (const avatar of avatars.avatars.filter((entry) => entry.id !== first.avatarId)) {
      records.set(keyOf("SESSION#s2", `AVATAR#${avatar.id}`), {
        pk: "SESSION#s2", sk: `AVATAR#${avatar.id}`, participantId: "other-session", ttl: 10,
      });
    }
    const second = await joinSession(db, "table", "654321", "guest-two", now);
    expect(second.avatarId).toBe(first.avatarId);
    expect(records.get(keyOf("SESSION#s1", `AVATAR#${first.avatarId}`))).toBeDefined();
    expect(records.get(keyOf("SESSION#s2", `AVATAR#${second.avatarId}`))).toBeDefined();
  });
});
