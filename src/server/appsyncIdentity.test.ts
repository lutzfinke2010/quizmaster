import { describe, expect, it } from "vitest";
import { guestIdentity, quizmasterIdentity } from "./appsyncIdentity";

describe("AppSync-Identitäten", () => {
  it("bindet technische Identitäten an den konfigurierten Identity Pool", () => {
    const identity = { cognitoIdentityId: "eu-central-1:identity", cognitoIdentityPoolId: "pool",
      cognitoIdentityAuthType: "unauthenticated" };
    expect(guestIdentity(identity, "pool")).toBe("eu-central-1:identity");
    expect(guestIdentity({ ...identity, cognitoIdentityAuthType: "authenticated" }, "pool")).toBe("eu-central-1:identity");
    expect(() => guestIdentity(identity, "other")).toThrow();
    expect(() => guestIdentity({ ...identity, cognitoIdentityAuthType: "unknown" }, "pool")).toThrow();
    expect(() => guestIdentity({ ...identity, cognitoIdentityId: "" }, "pool")).toThrow();
  });
  it("liest Quizmasterrollen nur aus dem verifizierten Cognito-Kontext", () => {
    expect(quizmasterIdentity({ sub: "subject", claims: { "cognito:groups": ["Quizmasters"] } }))
      .toEqual({ subject: "subject", groups: ["Quizmasters"] });
    expect(quizmasterIdentity({ sub: "subject", claims: {} })).toEqual({ subject: "subject", groups: [] });
    expect(() => quizmasterIdentity({ sub: "subject", claims: { "cognito:groups": "Quizmasters" } })).toThrow();
    expect(() => quizmasterIdentity({ groups: ["Quizmasters"] })).toThrow();
  });
});
