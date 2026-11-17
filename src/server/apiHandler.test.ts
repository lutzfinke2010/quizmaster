import { beforeAll, describe, expect, it, vi } from "vitest";

describe("API-Handler publishGameEvent", () => {
  let handler: (raw: unknown) => Promise<unknown>;
  beforeAll(async () => {
    process.env.TABLE_NAME = "table";
    process.env.IDENTITY_POOL_ID = "eu-central-1:00000000-0000-0000-0000-000000000000";
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    ({ handler } = await import("../../amplify/functions/api/handler"));
  });

  it("lehnt Gast-Identitäten aus dem Identity Pool ab", async () => {
    await expect(handler({ fieldName: "publishGameEvent", arguments: { sessionId: "s", version: 1 },
      identity: { userArn: "arn:aws:sts::1:assumed-role/unauth/CognitoIdentityCredentials", cognitoIdentityId: "eu-central-1:abc" } }))
      .rejects.toThrow(/Keine Berechtigung/);
    await expect(handler({ fieldName: "publishGameEvent", arguments: { sessionId: "s", version: 1 }, identity: null }))
      .rejects.toThrow(/Keine Berechtigung/);
  });

  it("akzeptiert IAM-signierte Publisher-Aufrufe inklusive Zählerständen", async () => {
    await expect(handler({ fieldName: "publishGameEvent", arguments: { sessionId: "s", version: 2, answerCount: 5 },
      identity: { userArn: "arn:aws:sts::1:assumed-role/publisher/fn" } }))
      .resolves.toEqual({ sessionId: "s", version: 2, participantCount: null, answerCount: 5 });
  });

  it("meldet Validierungsfehler ohne interne Details", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    await expect(handler({ fieldName: "publishGameEvent", arguments: { sessionId: "s", version: -1 },
      identity: { userArn: "arn:aws:sts::1:assumed-role/publisher/fn" } })).rejects.toThrow("Ungültige Anfrage.");
  });
});
