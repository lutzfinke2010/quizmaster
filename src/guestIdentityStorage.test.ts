import { describe, expect, it } from "vitest";
import { createExpiringIdentityStorage, guestIdentityMaxAgeMs } from "./guestIdentityStorage";

function memory() {
  const data = new Map<string, string>();
  return { data, storage: {
    setItem: async (key: string, value: string) => { data.set(key, value); },
    getItem: async (key: string) => data.get(key) ?? null,
    removeItem: async (key: string) => { data.delete(key); },
    clear: async () => data.clear(),
  } };
}
const identityKey = "com.amplify.Cognito.eu-central-1:pool.identityId";

describe("Gast-Kennung im Browser", () => {
  it("verwirft die Kennung nach 24 Stunden", async () => {
    const { data, storage } = memory();
    let time = 1_000;
    const expiring = createExpiringIdentityStorage(storage, () => time);
    await expiring.setItem(identityKey, "id-1");
    time += guestIdentityMaxAgeMs - 1;
    expect(await expiring.getItem(identityKey)).toBe("id-1");
    time += 2;
    expect(await expiring.getItem(identityKey)).toBeNull();
    expect(data.size).toBe(0);
  });

  it("lässt andere Schlüssel unverändert", async () => {
    const { data, storage } = memory();
    const expiring = createExpiringIdentityStorage(storage, () => 1);
    await expiring.setItem("CognitoIdentityServiceProvider.client.idToken", "token");
    expect(await expiring.getItem("CognitoIdentityServiceProvider.client.idToken")).toBe("token");
    expect(data.size).toBe(1);
  });

  it("behandelt Kennungen ohne Ablaufzeit als abgelaufen", async () => {
    const { data, storage } = memory();
    data.set(identityKey, "legacy");
    expect(await createExpiringIdentityStorage(storage).getItem(identityKey)).toBeNull();
  });
});
