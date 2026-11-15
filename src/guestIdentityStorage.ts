import { defaultStorage, type KeyValueStorageInterface } from "aws-amplify/utils";

/** Maximale Lebensdauer der anonymen Gast-Kennung im Browser. */
export const guestIdentityMaxAgeMs = 24 * 60 * 60 * 1000;
const expiryPrefix = "quizrush.expiry.";

function isIdentityKey(key: string): boolean {
  return /^com\.amplify\.Cognito\..+\.identityId$/.test(key);
}

/**
 * Speicher für die Cognito-Identitäts-ID: Gast-Kennungen werden nach 24 Stunden verworfen,
 * damit ein Browser nicht dauerhaft wiedererkannt wird. Alle anderen Schlüssel bleiben unverändert.
 */
export function createExpiringIdentityStorage(
  inner: KeyValueStorageInterface = defaultStorage, now: () => number = Date.now,
): KeyValueStorageInterface {
  return {
    async setItem(key, value) {
      await inner.setItem(key, value);
      if (isIdentityKey(key)) await inner.setItem(expiryPrefix + key, String(now() + guestIdentityMaxAgeMs));
    },
    async getItem(key) {
      if (isIdentityKey(key)) {
        const expiry = Number(await inner.getItem(expiryPrefix + key));
        if (!(expiry > now())) {
          await inner.removeItem(key);
          await inner.removeItem(expiryPrefix + key);
          return null;
        }
      }
      return inner.getItem(key);
    },
    async removeItem(key) {
      await inner.removeItem(key);
      if (isIdentityKey(key)) await inner.removeItem(expiryPrefix + key);
    },
    clear: () => inner.clear(),
  };
}

/** Entfernt die lokal gespeicherte Gast-Kennung (z. B. nach dem Löschen der eigenen Spieldaten). */
export function clearGuestIdentity(storage: Storage = window.localStorage): void {
  for (const key of Object.keys(storage)) {
    if (isIdentityKey(key) || (key.startsWith(expiryPrefix) && isIdentityKey(key.slice(expiryPrefix.length)))) {
      storage.removeItem(key);
    }
  }
}
