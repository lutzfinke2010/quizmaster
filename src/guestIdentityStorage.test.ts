import { afterEach, describe, expect, it, vi } from "vitest";
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
afterEach(() => vi.unstubAllGlobals());

function controlledScheduler(now: () => number) {
  let nextId = 0;
  const jobs = new Map<number, { callback: () => void | Promise<void>; expiresAt: number }>();
  return {
    jobs,
    scheduler: {
      setTimeout(callback: () => void | Promise<void>, delay: number) {
        const id = ++nextId;
        jobs.set(id, { callback, expiresAt: now() + delay });
        return id;
      },
      clearTimeout(id: number) { jobs.delete(id); },
    },
  };
}

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

  it("speichert eine bereits abgelaufene Kennung nicht erneut", async () => {
    const { data, storage } = memory();
    let time = 1_000;
    const expiring = createExpiringIdentityStorage(storage, () => time);
    await expiring.setItem(identityKey, "id-1");
    time += guestIdentityMaxAgeMs;
    await expiring.setItem(identityKey, "id-1");
    expect(data.has(identityKey)).toBe(false);
    expect(data.has(`quizrush.expiry.${identityKey}`)).toBe(false);
  });

  it("verlängert die Gültigkeit nicht, wenn Amplify eine vorhandene Kennung erneut schreibt", async () => {
    const { data, storage } = memory();
    let time = 1_000;
    const expiring = createExpiringIdentityStorage(storage, () => time);
    await expiring.setItem(identityKey, "id-1");
    const firstExpiry = data.get(`quizrush.expiry.${identityKey}`);
    time += 18 * 60 * 60 * 1000;
    await expiring.setItem(identityKey, "id-1");
    expect(data.get(`quizrush.expiry.${identityKey}`)).toBe(firstExpiry);
    time += 6 * 60 * 60 * 1000 + 1;
    expect(await expiring.getItem(identityKey)).toBeNull();
    expect(data.size).toBe(0);
  });

  it("entfernt die Kennung im geöffneten Tab am Ablaufzeitpunkt", async () => {
    const { data, storage } = memory();
    let time = 1_000;
    const { jobs, scheduler } = controlledScheduler(() => time);
    let credentialsCleared = 0;
    const expiring = createExpiringIdentityStorage(storage, () => time, scheduler, () => { credentialsCleared++; });
    await expiring.setItem(identityKey, "id-1");
    time += guestIdentityMaxAgeMs;
    for (const job of jobs.values()) {
      if (job.expiresAt <= time) await job.callback();
    }
    expect(data.size).toBe(0);
    expect(credentialsCleared).toBe(1);
  });

  it("stößt die Speicherung unmittelbar an, auch wenn Amplify den Promise nicht abwartet", async () => {
    const { data, storage } = memory();
    const expiring = createExpiringIdentityStorage(storage, () => 1);
    const write = expiring.setItem(identityKey, "id-1");
    expect(data.get(identityKey)).toBe("id-1");
    expect(data.has(`quizrush.expiry.${identityKey}`)).toBe(true);
    await write;
  });

  it("löscht beim Leeren nur zuvor verwaltete Identitätsdaten", async () => {
    const { data, storage } = memory();
    data.set("CognitoIdentityServiceProvider.client.idToken", "token");
    data.set("quizrush.local-drafts.v1", "drafts");
    const expiring = createExpiringIdentityStorage(storage, () => 1);
    await expiring.setItem(identityKey, "id-1");
    await expiring.clear();
    expect(data.get("CognitoIdentityServiceProvider.client.idToken")).toBe("token");
    expect(data.get("quizrush.local-drafts.v1")).toBe("drafts");
    expect(data.has(identityKey)).toBe(false);
    expect(data.has(`quizrush.expiry.${identityKey}`)).toBe(false);
  });

  it("verwirft gecachte Zugangsdaten, wenn ein anderer Tab die Kennung entfernt", async () => {
    const { data, storage } = memory();
    let time = 1_000;
    const listeners = new Map<string, (event: { key: string }) => void | Promise<void>>();
    vi.stubGlobal("window", { addEventListener: (type: string, listener: (event: { key: string }) => void | Promise<void>) =>
      listeners.set(type, listener) });
    vi.stubGlobal("document", { visibilityState: "visible", addEventListener: () => {} });
    data.set(identityKey, "id-1");
    data.set(`quizrush.expiry.${identityKey}`, String(time + guestIdentityMaxAgeMs));
    let credentialsCleared = 0;
    const { scheduler } = controlledScheduler(() => time);
    const expiring = createExpiringIdentityStorage(storage, () => time, scheduler, () => { credentialsCleared++; });
    expect(await expiring.getItem(identityKey)).toBe("id-1");

    data.delete(identityKey);
    data.delete(`quizrush.expiry.${identityKey}`);
    await listeners.get("storage")?.({ key: identityKey });
    expect(credentialsCleared).toBe(1);
  });

  it("prüft die Frist erneut, wenn ein Tab sichtbar wird", async () => {
    const { data, storage } = memory();
    let time = 1_000;
    const listeners = new Map<string, () => void | Promise<void>>();
    const document = {
      visibilityState: "hidden",
      addEventListener: (type: string, listener: () => void | Promise<void>) => listeners.set(type, listener),
    };
    vi.stubGlobal("window", { addEventListener: () => {} });
    vi.stubGlobal("document", document);
    let credentialsCleared = 0;
    const { scheduler } = controlledScheduler(() => time);
    const expiring = createExpiringIdentityStorage(storage, () => time, scheduler, () => { credentialsCleared++; });
    await expiring.setItem(identityKey, "id-1");
    expect(await expiring.getItem(identityKey)).toBe("id-1");

    time += guestIdentityMaxAgeMs;
    document.visibilityState = "visible";
    await listeners.get("visibilitychange")?.();
    expect(data.size).toBe(0);
    expect(credentialsCleared).toBe(1);
  });
});
