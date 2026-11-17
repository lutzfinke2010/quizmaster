import { writeFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";

/**
 * Quiz zum Mitmachen: Quiz-Code, kurzer Link, gemeinsame Codeeingabe, kompakte Karten und die screenshotfähige
 * 16:9-Einladung. Das Backend wird im Browser simuliert; Screenshots landen unter test-results/.
 */
const LONG_TITLE = "Tierisch unglaubliche Fakten aus Wald, Wiese und Ozean – das große Familienquiz zum Jahresende";
const FIXED_END = Date.UTC(2030, 11, 24, 17, 0);

type MockOptions = { title?: string; failFirstInfo?: boolean; expiresInMs?: number; status?: string };

async function mockCloud(page: Page, options: MockOptions = {}) {
  await page.route("**/src/AdminAuth.tsx", (route) => route.fulfill({
    contentType: "application/javascript", body: "export function AdminGate({children}) { return children; }",
  }));
  await page.route("**/src/cloud.ts", (route) => route.fulfill({
    contentType: "application/javascript",
    body: `
      const TITLE = ${JSON.stringify(options.title ?? "Tierisch unglaubliche Fakten")};
      const FAIL_FIRST_INFO = ${options.failFirstInfo ? "true" : "false"};
      const EXPIRES_IN = ${options.expiresInMs ?? "null"};
      const STATUS = ${JSON.stringify(options.status ?? "ACTIVE")};
      const expiresAt = EXPIRES_IN === null ? ${FIXED_END} : Date.now() + EXPIRES_IN;
      const count = (key) => sessionStorage.setItem(key, String(Number(sessionStorage.getItem(key) || "0") + 1));
      const LEGACY_TOKEN = "Lq3w9ZxT0vYkP2mN8sR4tU6bC1dE5fG7hJ9kL0nM2pQ";
      const scoring = { scoringVersion: "ASYNC_SPEED_V1", basePoints: 1000, maxBonusPoints: 500, bonusWindowMs: 30000 };
      const info = (joinCode, status = STATUS) => ({ title: TITLE, description: "Fünf Fragen über Tiere.", questionCount: 5, expiresAt,
        timeZone: "Europe/Berlin", status, retentionAt: expiresAt + 30 * 86400000, endedAt: status === "ENDED" ? expiresAt - 86400000 : null,
        maxParticipants: 100, serverTime: Date.now(), joinCode, ...scoring });
      const publications = [
        { publicationId: "p-active", quizId: "q1", title: TITLE, token: LEGACY_TOKEN, joinCode: "004281", createdAt: Date.now() - 3600000,
          expiresAt, timeZone: "Europe/Berlin", status: "ACTIVE", endedAt: null, participantCount: 12, maxParticipants: 100,
          completedCount: 9, partialCount: 3, retentionAt: expiresAt + 30 * 86400000 },
        { publicationId: "p-legacy", quizId: "q2", title: "Altes Quiz ohne Code", token: "Old" + LEGACY_TOKEN.slice(3), joinCode: null,
          createdAt: Date.now() - 7200000, expiresAt, timeZone: "Europe/Berlin", status: "ACTIVE", endedAt: null, participantCount: 0,
          maxParticipants: 100, completedCount: 0, partialCount: 0, retentionAt: expiresAt + 30 * 86400000 },
        { publicationId: "p-ended", quizId: "q3", title: "Sommerquiz", token: "End" + LEGACY_TOKEN.slice(3), joinCode: "555123",
          createdAt: Date.now() - 9 * 86400000, expiresAt: Date.now() - 86400000, timeZone: "Europe/Berlin", status: "ENDED",
          endedAt: Date.now() - 2 * 86400000, participantCount: 30, maxParticipants: 100, completedCount: 28, partialCount: 2,
          retentionAt: Date.now() + 28 * 86400000 },
      ];
      export async function configureCloud() { return true; }
      export const client = {};
      const impl = {
        listQuizzes: async () => [],
        listSessions: async () => [],
        listAsyncPublications: async () => publications,
        ensureAsyncJoinCode: async (publicationId) => {
          count("ensure-calls");
          await new Promise((resolve) => setTimeout(resolve, 300));
          return { publicationId, joinCode: "482619" };
        },
        asyncPublicInfo: async (token) => {
          count("info-calls");
          if (FAIL_FIRST_INFO && sessionStorage.getItem("info-null") !== "off") return info(null);
          if (token === "004281" || token === LEGACY_TOKEN) return info("004281");
          if (token === "482619") return info("482619");
          if (token === "555123") return info("555123", "ENDED");
          throw new Error("Diese Quizrunde gibt es nicht oder sie ist nicht mehr verfügbar.");
        },
        resolveJoinCode: async (code) => {
          count("resolve-calls");
          if (code === "004281") return { mode: "ASYNC", joinCode: code };
          if (code === "123456") return { mode: "LIVE", joinCode: code };
          throw new Error("Diesen Quiz-Code gibt es nicht. Bitte prüfe die Ziffern.");
        },
        join: async (code) => { sessionStorage.setItem("joined", code); return { sessionId: "live-1", participantId: "pp", displayName: "Kluger Koala", avatarId: "avatar-001" }; },
        myAsyncState: async () => null,
        subscribe: () => ({ unsubscribe() {} }),
        startAsyncQuiz: async () => { count("start-calls"); throw new Error("nicht erwartet"); },
      };
      export const cloud = new Proxy(impl, { get: (target, key) => key in target ? target[key] : async () => null });
    `,
  }));
}

async function shot(page: Page, name: string, fullPage = false) {
  const path = test.info().outputPath(name);
  await page.screenshot({ path, fullPage, animations: "disabled" });
  return path;
}

async function counter(page: Page, key: string) {
  return page.evaluate((name) => Number(sessionStorage.getItem(name) || "0"), key);
}

/** Erwartete öffentliche Basisadresse: konfigurierte VITE_PUBLIC_BASE_URL, sonst die tatsächliche Herkunft. */
function publicBase(page: Page) {
  const configured = process.env.VITE_PUBLIC_BASE_URL;
  return configured ? new URL(configured).origin : new URL(page.url()).origin;
}

const forbidden = /\b(Async|Asynchron|Deadline)\b|Quiz per Link/i;

test.describe("Verwaltung: kompakte Karten", () => {
  test("zeigen Quiz-Code, kurze Kopieraktionen und vergeben fehlende Codes serverseitig", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await mockCloud(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Veröffentlichte Quizrunden" })).toBeVisible();
    await expect(page.getByText("QUIZ ZUM MITMACHEN").first()).toBeVisible();
    const active = page.locator(".async-publication-card").filter({ hasText: "Tierisch unglaubliche Fakten" });
    await expect(active.locator(".join-code-digits")).toHaveText("004 281");
    await expect(active).toContainText("Mitspielen bis");
    await expect(active).toContainText(/24\.12\.2030, 18:00 Uhr MEZ/);
    await expect(active.locator("input")).toHaveCount(0);
    const invitation = active.getByRole("link", { name: "Einladung anzeigen" });
    await expect(invitation).toHaveAttribute("href", "/einladung/004281");
    await expect(invitation).toHaveAttribute("target", "_blank");
    await active.getByRole("button", { name: "Code kopieren" }).click();
    await expect(active.getByRole("status").filter({ hasText: "Code kopiert." })).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("004281");
    await active.getByRole("button", { name: "Link kopieren" }).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(`${publicBase(page)}/q/004281`);
    await expect(active.getByRole("button", { name: "Vorzeitig beenden" })).toBeHidden();

    const legacy = page.locator(".async-publication-card").filter({ hasText: "Altes Quiz ohne Code" });
    await expect(legacy.locator(".join-code-digits")).toHaveText("482 619");
    // Nachvergabe läuft serverseitig und idempotent; React StrictMode (Entwicklung) darf den Effekt doppelt auslösen.
    expect(await counter(page, "ensure-calls")).toBeGreaterThanOrEqual(1);
    expect(await counter(page, "ensure-calls")).toBeLessThanOrEqual(2);

    const ended = page.locator(".async-publication-card").filter({ hasText: "Sommerquiz" });
    await expect(ended.locator(".badge")).toHaveText("Vorzeitig beendet");
    await expect(ended).toContainText("Beendet am");
    await expect(ended.getByRole("link", { name: "Einladung anzeigen" })).toHaveCount(0);
    await expect(ended.locator(".join-code-digits")).toHaveCount(0);
    await expect(ended.getByRole("link", { name: "Ergebnisse ansehen" })).toBeVisible();

    const text = await page.locator("main").innerText();
    expect(text).not.toMatch(forbidden);
    await shot(page, "admin-quizrunden-1440.png", true);
  });

  test("ohne Zwischenablage erscheint ein markierter Text statt einer Erfolgsmeldung", async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(Navigator.prototype, "clipboard", { get: () => undefined }));
    await mockCloud(page);
    await page.goto("/admin");
    const active = page.locator(".async-publication-card").filter({ hasText: "Tierisch unglaubliche Fakten" });
    await active.getByRole("button", { name: "Code kopieren" }).click();
    const field = active.getByLabel("Quiz-Code für Tierisch unglaubliche Fakten");
    await expect(field).toHaveValue("004281");
    await expect(field).toBeFocused();
    expect(await field.evaluate((input: HTMLInputElement) => input.value.slice(input.selectionStart ?? 0, input.selectionEnd ?? 0))).toBe("004281");
    await expect(page.getByText("Code kopiert.")).toHaveCount(0);
    await active.getByRole("button", { name: "Link kopieren" }).click();
    await expect(active.getByLabel("Teilnahmelink für Tierisch unglaubliche Fakten")).toHaveValue(/\/q\/004281$/);
    await expect(page.getByText("Link kopiert.")).toHaveCount(0);
  });
});

test.describe("Gemeinsame Codeeingabe", () => {
  test("löst Quiz-Code mit Leerzeichen auf, startet aber keinen Versuch", async ({ page }) => {
    await mockCloud(page);
    await page.goto("/join");
    const input = page.getByLabel("Quiz-Code");
    await expect(input).toHaveAttribute("type", "text");
    await expect(input).toHaveAttribute("inputmode", "numeric");
    await expect(page.locator(".join-card .privacy-note")).toContainText("Ohne Name und E-Mail dabei.");
    await input.fill("004 281");
    await page.getByRole("button", { name: "Mitspielen" }).click();
    await expect(page).toHaveURL(/\/q\/004281$/);
    await expect(page.getByRole("heading", { name: "Tierisch unglaubliche Fakten" })).toBeVisible();
    await expect(page.getByText(/Mitspielen bis .*2030, 18:00 Uhr MEZ/).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Quiz starten" })).toBeVisible();
    expect(await counter(page, "start-calls")).toBe(0);
    expect(await page.locator("body").innerText()).not.toMatch(forbidden);
  });

  test("führt Live-Codes wie bisher in die Live-Runde", async ({ page }) => {
    await mockCloud(page);
    await page.goto("/join/123456");
    await expect(page.getByLabel("Quiz-Code")).toHaveValue("123456");
    await page.getByRole("button", { name: "Mitspielen" }).click();
    await expect(page).toHaveURL(/\/play\/live-1$/);
    expect(await page.evaluate(() => sessionStorage.getItem("joined"))).toBe("123456");
  });

  for (const [input, expected] of [
    ["12a456", "Der Quiz-Code besteht nur aus 6 Ziffern."],
    ["12345", "Der Quiz-Code hat genau 6 Ziffern."],
    ["1234567", "Der Quiz-Code hat genau 6 Ziffern."],
    ["999 999", "Diesen Quiz-Code gibt es nicht. Bitte prüfe die Ziffern."],
  ] as const) {
    test(`meldet „${input}“ verständlich`, async ({ page }) => {
      await mockCloud(page);
      await page.goto("/join");
      await page.getByLabel("Quiz-Code").fill(input);
      await page.getByRole("button", { name: "Mitspielen" }).click();
      await expect(page.getByRole("alert")).toHaveText(expected);
      await expect(page).toHaveURL(/\/join$/);
    });
  }

  test("alter langer Teilnahmelink öffnet weiterhin dieselbe Runde", async ({ page }) => {
    await mockCloud(page);
    await page.goto("/q/Lq3w9ZxT0vYkP2mN8sR4tU6bC1dE5fG7hJ9kL0nM2pQ");
    await expect(page.getByRole("heading", { name: "Tierisch unglaubliche Fakten" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Quiz starten" })).toBeVisible();
    expect(await counter(page, "start-calls")).toBe(0);
  });

  test("unbekannter Code im kurzen Link zeigt eine Endseite mit Weg zur Codeeingabe", async ({ page }) => {
    await mockCloud(page);
    await page.goto("/q/999999");
    await expect(page.getByRole("heading", { name: "Quizrunde nicht verfügbar" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Quiz-Code eingeben" })).toHaveAttribute("href", "/join");
  });
});

async function expectInvitationFits(page: Page) {
  const card = page.locator(".invitation-card");
  await expect(card).toHaveAttribute("data-ready", "true");
  const box = await card.boundingBox();
  if (!box) throw new Error("Einladungsfläche fehlt.");
  const metrics = await page.evaluate(() => {
    const element = document.querySelector<HTMLElement>(".invitation-card")!;
    const qr = document.querySelector<HTMLElement>(".invitation-qr-box")!.getBoundingClientRect();
    const svg = document.querySelector<SVGSVGElement>(".invitation-qr-box svg")!;
    const children = [...element.querySelectorAll<HTMLElement>(".invitation-brand, .invitation-title, .invitation-lead, .invitation-code, .invitation-qr, .invitation-footer")];
    const outer = element.getBoundingClientRect();
    const escaping = children.filter((child) => {
      const rect = child.getBoundingClientRect();
      return rect.left < outer.left - 0.5 || rect.right > outer.right + 0.5 || rect.top < outer.top - 0.5 || rect.bottom > outer.bottom + 0.5;
    }).map((child) => child.className);
    return {
      innerWidth: window.innerWidth, innerHeight: window.innerHeight,
      scrollHeight: document.documentElement.scrollHeight, scrollWidth: document.documentElement.scrollWidth,
      cardOverflow: element.scrollHeight - element.clientHeight, qrWidth: qr.width, qrHeight: qr.height,
      viewBox: svg.getAttribute("viewBox"), escaping,
    };
  });
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(metrics.innerWidth);
  expect(box.y + box.height).toBeLessThanOrEqual(metrics.innerHeight);
  expect(Math.abs(box.width / box.height - 16 / 9)).toBeLessThan(0.01);
  expect(metrics.scrollHeight).toBeLessThanOrEqual(metrics.innerHeight);
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.innerWidth);
  expect(metrics.cardOverflow).toBeLessThanOrEqual(0);
  expect(metrics.escaping).toEqual([]);
  expect(Math.abs(metrics.qrWidth - metrics.qrHeight)).toBeLessThan(1);
  return { box, metrics };
}

test.describe("Einladungsansicht", () => {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 1920, height: 1080 }]) {
    test(`16:9-Einladung passt vollständig bei ${viewport.width}×${viewport.height}`, async ({ page }) => {
      await mockCloud(page);
      await page.setViewportSize(viewport);
      await page.goto("/einladung/004281");
      const { box, metrics } = await expectInvitationFits(page);
      const card = page.locator(".invitation-card");
      await expect(card.getByText("QUIZ ZUM MITMACHEN")).toBeVisible();
      await expect(card.getByRole("heading", { name: "Tierisch unglaubliche Fakten" })).toBeVisible();
      await expect(card.getByText("Scannen oder Code eingeben. Spiele in deinem Tempo.")).toBeVisible();
      await expect(card.locator(".invitation-code-digits")).toHaveText("004 281");
      await expect(card.getByText("Scannen & mitspielen")).toBeVisible();
      await expect(card.locator(".invitation-footer")).toContainText("Mitspielen bis Dienstag, 24. Dezember 2030, 18:00 Uhr MEZ");
      const origin = publicBase(page);
      await expect(card.locator(".invitation-link")).toHaveText(`${origin.replace(/^https?:\/\//, "")}/q/004281`);
      await expect(card.locator(".invitation-code-how")).toHaveText(`${new URL(origin).host} öffnen → Mitspielen → Quiz-Code eingeben`);
      expect(await card.innerText()).not.toMatch(/admin|Ergebnisse|Teilnehmer|Async|Deadline/i);
      // QR mit echter Randzone von vier Modulen: viewBox = Module + 2 × 4.
      const viewBox = (metrics.viewBox ?? "").split(" ").map(Number);
      expect(viewBox[2]).toBe(viewBox[3]);
      expect(viewBox[2]).toBeGreaterThanOrEqual(21 + 8);
      expect(metrics.qrWidth).toBeGreaterThanOrEqual(300);
      expect(metrics.qrWidth).toBeLessThanOrEqual(440);
      const name = `einladung-${viewport.width}x${viewport.height}`;
      const full = await shot(page, `${name}.png`);
      const cardPath = test.info().outputPath(`${name}-flaeche.png`);
      await card.screenshot({ path: cardPath, animations: "disabled" });
      await writeFile(test.info().outputPath(`${name}.json`), JSON.stringify({
        expected: `${origin}/q/004281`, screenshots: [full, cardPath], card: box, qrCssPx: metrics.qrWidth,
      }, null, 2));
    });
  }

  test("langer Titel und langes Datum bleiben vollständig sichtbar (1440×900)", async ({ page }) => {
    await mockCloud(page, { title: LONG_TITLE });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/einladung/004281");
    await expectInvitationFits(page);
    const title = page.locator(".invitation-title");
    await expect(title).toHaveText(LONG_TITLE);
    expect(await title.evaluate((element) => getComputedStyle(element).textOverflow)).not.toBe("ellipsis");
    await shot(page, "einladung-langer-titel-1440x900.png");
  });

  test("Smartphone erhält eine gestapelte, lesbare Ansicht (390×844)", async ({ page }) => {
    await mockCloud(page, { title: LONG_TITLE });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/einladung/004281");
    await expect(page.locator(".invitation-card")).toHaveAttribute("data-ready", "true");
    const layout = await page.evaluate(() => {
      const rect = (selector: string) => document.querySelector(selector)!.getBoundingClientRect();
      return {
        code: rect(".invitation-code"), qr: rect(".invitation-qr-box"),
        codeFont: parseFloat(getComputedStyle(document.querySelector(".invitation-code-digits")!).fontSize),
        titleFont: parseFloat(getComputedStyle(document.querySelector(".invitation-title")!).fontSize),
        scrollWidth: document.documentElement.scrollWidth, width: window.innerWidth,
      };
    });
    expect(layout.qr.top).toBeGreaterThan(layout.code.bottom);
    expect(layout.codeFont).toBeGreaterThanOrEqual(40);
    expect(layout.titleFont).toBeGreaterThanOrEqual(26);
    expect(layout.qr.width).toBeGreaterThanOrEqual(240);
    expect(layout.scrollWidth).toBeLessThanOrEqual(layout.width);
    await shot(page, "einladung-mobil-390x844.png", true);
    // Textvergrößerung: doppelte Grundschrift darf nichts abschneiden oder horizontal überlaufen.
    await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await shot(page, "einladung-mobil-390x844-text200.png", true);
  });

  test("Vollbild blendet die Bedienleiste aus, Escape bringt sie zurück", async ({ page }) => {
    await mockCloud(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/einladung/004281");
    await expect(page.locator(".invitation-card")).toHaveAttribute("data-ready", "true");
    const toolbar = page.getByRole("toolbar", { name: "Einladung" });
    await expect(toolbar.getByRole("button", { name: "Schließen" })).toBeVisible();
    await toolbar.getByRole("button", { name: "Vollbild" }).click();
    await expect(page.locator(".invitation-page")).toHaveClass(/is-fullscreen/);
    await expect(toolbar).toBeHidden();
    await page.evaluate(() => document.exitFullscreen());
    await expect(toolbar).toBeVisible();
  });

  test("ohne Fullscreen-Unterstützung bleibt die Ansicht nutzbar", async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(Document.prototype, "fullscreenEnabled", { get: () => false }));
    await mockCloud(page);
    await page.goto("/einladung/004281");
    await page.getByRole("button", { name: "Vollbild" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Vollbild wird von diesem Browser nicht unterstützt" })).toBeVisible();
    await expect(page.locator(".invitation-card")).toHaveAttribute("data-ready", "true");
    await expect(page.getByRole("button", { name: "Schließen" })).toBeVisible();
  });

  test("ohne bestätigten Code gibt es keinen Platzhalter-QR, sondern Fehler mit Retry", async ({ page }) => {
    await mockCloud(page, { failFirstInfo: true });
    await page.goto("/einladung/004281");
    await expect(page.getByRole("alert")).toContainText("QR-Code konnte nicht erzeugt werden");
    await expect(page.locator(".invitation-qr-box svg")).toHaveCount(0);
    await page.evaluate(() => sessionStorage.setItem("info-null", "off"));
    await page.getByRole("button", { name: "Erneut versuchen" }).click();
    await expect(page.locator(".invitation-card")).toHaveAttribute("data-ready", "true");
    await expect(page.locator(".invitation-qr-box svg")).toHaveCount(1);
  });

  test("wechselt beim Ablauf ohne Reload in den Endzustand", async ({ page }) => {
    await mockCloud(page, { expiresInMs: 2500 });
    await page.goto("/einladung/004281");
    await expect(page.locator(".invitation-card")).toHaveAttribute("data-ready", "true");
    await expect(page.getByText("Diese Quizrunde ist beendet.")).toBeVisible({ timeout: 8000 });
    await expect(page.locator(".invitation-qr-box")).toHaveCount(0);
    await expect(page.locator(".invitation-code-digits")).toHaveCount(0);
  });

  test("beendete Runde zeigt keine aktive Einladung", async ({ page }) => {
    await mockCloud(page);
    await page.goto("/einladung/555123");
    await expect(page.getByText("Diese Quizrunde ist beendet.")).toBeVisible();
    await expect(page.getByText("Mitspielen ist nicht mehr möglich.", { exact: false })).toBeVisible();
    await expect(page.locator(".invitation-qr-box")).toHaveCount(0);
  });

  test("Direktaufruf mit ungültigem Code meldet einen verständlichen Fehler", async ({ page }) => {
    await mockCloud(page);
    await page.goto("/einladung/12ab56");
    await expect(page.getByRole("alert")).toContainText("Der Quiz-Code besteht nur aus 6 Ziffern.");
  });
});
