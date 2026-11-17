import { defaultStorage, type KeyValueStorageInterface } from "aws-amplify/utils";

/** Standardlebensdauer; aktive Quiz-per-Link-Versuche verlängern sie bis zur Ergebnislöschung. */
export const guestIdentityMaxAgeMs = 24 * 60 * 60 * 1000;
const expiryPrefix = "quizrush.expiry.";
const maxTimeoutMs = 2_147_483_647;

type ExpiryScheduler = {
  setTimeout(callback: () => void | Promise<void>, delay: number): number;
  clearTimeout(timer: number): void;
};

export type ExpiringIdentityStorage = KeyValueStorageInterface & {
  extendIdentityUntil(expiry: number): Promise<void>;
};

function browserScheduler(): ExpiryScheduler | undefined {
  if (typeof window === "undefined") return undefined;
  return {
    setTimeout: (callback, delay) => window.setTimeout(() => { void callback(); }, delay),
    clearTimeout: (timer) => window.clearTimeout(timer),
  };
}

function isIdentityKey(key: string): boolean {
  return /^com\.amplify\.Cognito\..+\.identityId$/.test(key);
}

/**
 * Gast-Kennungen verfallen standardmäßig nach 24 Stunden. Ein bestätigter Async-Versuch darf die
 * Frist gezielt bis zum Ende seiner Aufbewahrung verlängern; Lesezugriffe selbst verlängern nichts.
 */
export function createExpiringIdentityStorage(
  inner: KeyValueStorageInterface = defaultStorage, now: () => number = Date.now,
  scheduler = browserScheduler(),
  onExpire?: () => Promise<void> | void,
): ExpiringIdentityStorage {
  const identityKeys = new Set<string>();
  const timers = new Map<string, number>();
  const expiries = new Map<string, number>();
  const identityValues = new Map<string, string>();

  function cancelExpiry(key: string) {
    const timer = timers.get(key);
    if (timer !== undefined) scheduler?.clearTimeout(timer);
    timers.delete(key);
  }

  async function removeIdentity(key: string, expired = false) {
    cancelExpiry(key);
    expiries.delete(key);
    identityValues.delete(key);
    await inner.removeItem(key);
    await inner.removeItem(expiryPrefix + key);
    if (expired) await onExpire?.();
  }

  async function checkExpiry(key: string): Promise<void> {
    const [value, rawExpiry] = await Promise.all([
      inner.getItem(key), inner.getItem(expiryPrefix + key),
    ]);
    const expiry = Number(rawExpiry);
    if (value === null || !(expiry > now())) {
      await removeIdentity(key, true);
      return;
    }
    if (identityValues.has(key) && identityValues.get(key) !== value) await onExpire?.();
    expiries.set(key, expiry);
    identityValues.set(key, value);
    if (!scheduler) return;
    cancelExpiry(key);
    const delay = Math.min(expiry - now(), maxTimeoutMs);
    timers.set(key, scheduler.setTimeout(async () => {
      timers.delete(key);
      await checkExpiry(key);
    }, delay));
  }

  function refreshTrackedIdentities() {
    if (typeof document !== "undefined" && document.visibilityState !== "visible") return Promise.resolve();
    return Promise.all([...identityKeys].map((key) => checkExpiry(key))).then(() => undefined);
  }

  async function extendIdentityUntil(expiry: number): Promise<void> {
    if (!Number.isSafeInteger(expiry) || expiry <= now()) throw new Error("Ungültige Frist für die Gast-Kennung.");
    if (identityKeys.size === 0) throw new Error("Die Gast-Kennung ist noch nicht verfügbar.");
    await Promise.all([...identityKeys].map(async (key) => {
      const value = await inner.getItem(key);
      if (value === null) return;
      const previous = Number(await inner.getItem(expiryPrefix + key));
      const nextExpiry = Math.max(Number.isSafeInteger(previous) ? previous : now(), expiry);
      await inner.setItem(expiryPrefix + key, String(nextExpiry));
      expiries.set(key, nextExpiry);
      identityValues.set(key, value);
      cancelExpiry(key);
      if (scheduler) timers.set(key, scheduler.setTimeout(async () => {
        timers.delete(key);
        await checkExpiry(key);
      }, Math.min(nextExpiry - now(), maxTimeoutMs)));
    }));
  }

  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", refreshTrackedIdentities);
  }
  if (typeof window !== "undefined") {
    window.addEventListener("storage", async (event) => {
      if (!event.key) return;
      const key = isIdentityKey(event.key) ? event.key :
        event.key.startsWith(expiryPrefix) ? event.key.slice(expiryPrefix.length) : "";
      if (key && identityKeys.has(key)) await checkExpiry(key);
    });
  }

  return {
    extendIdentityUntil,
    setItem(key, value) {
      if (!isIdentityKey(key)) {
        return inner.setItem(key, value);
      }

      identityKeys.add(key);
      const currentExpiry = expiries.get(key);
      const currentValue = identityValues.get(key);
      if (currentExpiry !== undefined && currentExpiry <= now() && currentValue === value) {
        return removeIdentity(key, true);
      }

      const expiry = currentExpiry !== undefined && currentExpiry > now()
        ? currentExpiry : now() + guestIdentityMaxAgeMs;
      expiries.set(key, expiry);
      identityValues.set(key, value);
      cancelExpiry(key);
      if (scheduler) {
        timers.set(key, scheduler.setTimeout(async () => {
          timers.delete(key);
          await checkExpiry(key);
        }, Math.min(expiry - now(), maxTimeoutMs)));
      }
      const writes = [inner.setItem(key, value)];
      if (currentExpiry === undefined || currentExpiry <= now()) {
        writes.push(inner.setItem(expiryPrefix + key, String(expiry)));
      }
      // Amplify's identity store does not await setItem; start both underlying writes before returning.
      return Promise.all(writes).then(() => undefined, (caught: unknown) => {
        cancelExpiry(key);
        expiries.delete(key);
        identityValues.delete(key);
        throw caught;
      });
    },
    async getItem(key) {
      if (isIdentityKey(key)) {
        identityKeys.add(key);
        await checkExpiry(key);
        if (!identityValues.has(key)) return null;
      }
      return inner.getItem(key);
    },
    removeItem(key) {
      if (!isIdentityKey(key)) return inner.removeItem(key);
      identityKeys.add(key);
      cancelExpiry(key);
      expiries.delete(key);
      identityValues.delete(key);
      return Promise.all([inner.removeItem(key), inner.removeItem(expiryPrefix + key)]).then(() => undefined);
    },
    async clear() {
      // The wrapped defaultStorage is shared with auth tokens and drafts; clear only identities seen here.
      await Promise.all([...identityKeys].map((key) => removeIdentity(key)));
      identityKeys.clear();
    },
  };
}
