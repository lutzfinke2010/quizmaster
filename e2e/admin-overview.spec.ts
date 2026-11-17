import { expect, test, type Page } from "@playwright/test";

/**
 * Verwaltung: Laufende Sitzungen und aktive Quizrunden stehen oben, beendete bzw. abgelaufene liegen eingeklappt
 * darunter. Das Backend wird im Browser simuliert; Screenshots landen unter test-results/.
 */
const HOUR = 3600000;
const DAY = 24 * HOUR;
const LONG_TITLE = "Tierisch unglaubliche Fakten aus Wald, Wiese und Ozean – das große Familienquiz zum Jahresende";

type Session = { sessionId: string; title: string; status: string; createdAt: number };
type Publication = { publicationId: string; title: string; status: string; expiresAt: number; endedAt?: number | null; participantCount?: number; completedCount?: number };

function scenario(now = Date.now()) {
  const sessions: Session[] = [
    { sessionId: "s-lobby", title: "Weihnachtsquiz", status: "LOBBY", createdAt: now - HOUR },
    { sessionId: "s-open", title: "Teammeeting-Quiz", status: "QUESTION_OPEN", createdAt: now - 2 * HOUR },
    { sessionId: "s-done", title: "Herbstquiz", status: "FINISHED", createdAt: now - DAY },
    { sessionId: "s-cancel", title: "Testrunde", status: "CANCELLED", createdAt: now - 2 * DAY },
    { sessionId: "s-long", title: LONG_TITLE, status: "FINISHED", createdAt: now - 3 * DAY },
  ];
  const publications: Publication[] = [
    { publicationId: "p-active", title: "Tierisch unglaubliche Fakten", status: "ACTIVE", expiresAt: now + 5 * DAY, participantCount: 12, completedCount: 9 },
    { publicationId: "p-ended", title: "Sommerquiz", status: "ENDED", expiresAt: now + DAY, endedAt: now - 2 * DAY, participantCount: 30, completedCount: 28 },
    { publicationId: "p-expired", title: "Frühlingsquiz", status: "ACTIVE", expiresAt: now - HOUR, participantCount: 7, completedCount: 7 },
  ];
  return { sessions, publications };
}

async function mockCloud(page: Page, data: { sessions: Session[]; publications: Publication[] }) {
  await page.route("**/src/AdminAuth.tsx", (route) => route.fulfill({
    contentType: "application/javascript", body: "export function AdminGate({children}) { return children; }",
  }));
  await page.route("**/src/cloud.ts", (route) => route.fulfill({
    contentType: "application/javascript",
    body: `
      const data = ${JSON.stringify(data)};
      const sessions = data.sessions.map((session, index) => ({ joinCode: String(100000 + index), presentationToken: "t" + index, ...session }));
      const publications = data.publications.map((publication, index) => ({ quizId: "q" + index, token: "tok" + index,
        joinCode: String(200000 + index), createdAt: publication.expiresAt - 7 * ${DAY}, timeZone: "Europe/Berlin", endedAt: null,
        participantCount: 0, completedCount: 0, partialCount: 0, maxParticipants: 100, retentionAt: publication.expiresAt + 30 * ${DAY},
        ...publication }));
      export async function configureCloud() { return true; }
      export const client = {};
      const impl = {
        listQuizzes: async () => [],
        listSessions: async () => sessions,
        listAsyncPublications: async () => publications,
        ensureAsyncJoinCode: async (publicationId) => ({ publicationId, joinCode: "482619" }),
        subscribe: () => ({ unsubscribe() {} }),
      };
      export const cloud = new Proxy(impl, { get: (target, key) => key in target ? target[key] : async () => null });
    `,
  }));
}

async function shot(page: Page, name: string) {
  await page.screenshot({ path: test.info().outputPath(name), fullPage: true, animations: "disabled" });
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

/** „Anzeigen“/„Ausblenden“ ist rein visuell (CSS), der Zustand selbst kommt über das native details-Element. */
async function toggleText(archive: ReturnType<Page["locator"]>) {
  return archive.locator(".archive-toggle").evaluate((element) => getComputedStyle(element, "::before").content);
}

const sessionArchive = (page: Page) => page.locator("details.archive-section").filter({ hasText: "Beendete Sitzungen" });
const publicationArchive = (page: Page) => page.locator("details.archive-section").filter({ hasText: "Beendete Quizrunden" });

test.describe("Verwaltung: beendete Einträge eingeklappt", () => {
  test("laufende Einträge bleiben oben, beendete liegen geschlossen mit Anzahl darunter", async ({ page }) => {
    await mockCloud(page, scenario());
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Sitzungen", exact: true })).toBeVisible();

    const sessionCards = page.locator(".grid > article.card").filter({ has: page.getByRole("link", { name: "Sitzung öffnen" }) });
    await expect(sessionCards).toHaveCount(2);
    await expect(sessionCards.nth(0)).toContainText("Weihnachtsquiz");
    await expect(sessionCards.nth(1)).toContainText("Teammeeting-Quiz");
    await expect(page.locator(".async-publication-card")).toHaveCount(1);
    await expect(page.locator(".async-publication-card")).toContainText("Tierisch unglaubliche Fakten");

    const sessions = sessionArchive(page);
    const publications = publicationArchive(page);
    await expect(sessions).not.toHaveAttribute("open");
    await expect(publications).not.toHaveAttribute("open");
    await expect(sessions.locator(".archive-count")).toHaveText("3");
    await expect(publications.locator(".archive-count")).toHaveText("2");
    expect(await toggleText(sessions)).toBe('"Anzeigen"');
    await expect(page.getByText("Herbstquiz")).toBeHidden();
    await expect(page.getByText("Sommerquiz")).toBeHidden();
    await shot(page, "admin-uebersicht-eingeklappt-1440.png");

    await sessions.locator("summary").click();
    await expect(sessions).toHaveAttribute("open", "");
    expect(await toggleText(sessions)).toBe('"Ausblenden"');
    const sessionRows = sessions.locator(".archive-row");
    await expect(sessionRows).toHaveCount(3);
    await expect(sessionRows.nth(0)).toContainText("Herbstquiz");
    await expect(sessionRows.nth(0).locator(".badge")).toHaveText("Beendet");
    await expect(sessionRows.nth(0)).toContainText(/Erstellt am \d{2}\.\d{2}\.\d{4}, \d{2}:\d{2} Uhr/);
    await expect(sessionRows.nth(1).locator(".badge")).toHaveText("Abgebrochen");
    await expect(sessionRows.nth(0).getByRole("link", { name: "Sitzung öffnen" })).toHaveAttribute("href", "/admin/sessions/s-done");

    await publications.locator("summary").click();
    const publicationRows = publications.locator(".archive-row");
    await expect(publicationRows).toHaveCount(2);
    await expect(publicationRows.nth(0)).toContainText("Frühlingsquiz");
    await expect(publicationRows.nth(0).locator(".badge")).toHaveText("Abgelaufen");
    await expect(publicationRows.nth(0)).toContainText("7 gestartet · 7 fertig");
    await expect(publicationRows.nth(1)).toContainText("Sommerquiz");
    await expect(publicationRows.nth(1).locator(".badge")).toHaveText("Vorzeitig beendet");
    await expect(publicationRows.nth(1)).toContainText(/Beendet am \d{2}\.\d{2}\.\d{4}, \d{2}:\d{2} Uhr ME/);
    await expect(publicationRows.nth(1).getByRole("link", { name: "Ergebnisse ansehen" })).toHaveAttribute("href", "/admin/async/p-ended");
    await expect(publications.locator(".join-code-digits, [href^='/einladung/']")).toHaveCount(0);
    await shot(page, "admin-uebersicht-aufgeklappt-1440.png");
  });

  test("lässt sich per Tastatur auf- und zuklappen", async ({ page }) => {
    await mockCloud(page, scenario());
    await page.goto("/admin");
    const summary = sessionArchive(page).locator("summary");
    await summary.focus();
    await page.keyboard.press("Enter");
    await expect(sessionArchive(page)).toHaveAttribute("open", "");
    await page.keyboard.press("Space");
    await expect(sessionArchive(page)).not.toHaveAttribute("open");
  });

  for (const width of [390, 320]) {
    test(`wirkt auf dem Handy aufgeräumt (${width}px)`, async ({ page }) => {
      await mockCloud(page, scenario());
      await page.setViewportSize({ width, height: 844 });
      await page.goto("/admin");
      await expect(sessionArchive(page)).toBeVisible();
      await expectNoHorizontalOverflow(page);
      for (const archive of [sessionArchive(page), publicationArchive(page)]) {
        const box = await archive.locator("summary").boundingBox();
        expect(box!.height).toBeGreaterThanOrEqual(44);
      }
      await shot(page, `admin-uebersicht-eingeklappt-${width}.png`);

      await sessionArchive(page).locator("summary").click();
      await publicationArchive(page).locator("summary").click();
      await expectNoHorizontalOverflow(page);
      const longRow = sessionArchive(page).locator(".archive-row").filter({ hasText: "Familienquiz" });
      await expect(longRow.getByRole("heading")).toHaveText(LONG_TITLE);
      for (const link of await page.locator(".archive-row .button").all()) {
        const box = await link.boundingBox();
        expect(box!.height).toBeGreaterThanOrEqual(44);
        expect(box!.x + box!.width).toBeLessThanOrEqual(width);
      }
      await shot(page, `admin-uebersicht-aufgeklappt-${width}.png`);
    });
  }

  test("ohne laufende Einträge erscheint ein freundlicher Hinweis, ohne beendete kein Klappbereich", async ({ page }) => {
    const { sessions, publications } = scenario();
    await mockCloud(page, {
      sessions: sessions.filter((session) => session.status === "FINISHED" || session.status === "CANCELLED"),
      publications: publications.filter((publication) => publication.publicationId === "p-active"),
    });
    await page.goto("/admin");
    await expect(page.getByText("Gerade läuft keine Live-Sitzung.")).toBeVisible();
    await expect(sessionArchive(page).locator(".archive-count")).toHaveText("3");
    await expect(page.locator(".async-publication-card")).toHaveCount(1);
    await expect(publicationArchive(page)).toHaveCount(0);
    await expect(page.getByText("Gerade ist keine Quizrunde aktiv.")).toHaveCount(0);
  });
});
