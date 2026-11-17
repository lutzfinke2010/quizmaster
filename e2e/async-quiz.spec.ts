import { expect, test, type Page } from "@playwright/test";

/**
 * Quiz zum Mitmachen mit ASYNC_SPEED_V1: kompakte Fragenansicht, automatischer Fragewechsel aus der
 * Antwortbestätigung, Tempo-Bonus-Anzeige, Admin-Top-5 und Siegerpodest. Das Backend wird im Browser simuliert.
 */
async function mockAsync(page: Page, options: {
  questions?: Array<{ text: string; answers: string[] }>; legacy?: boolean;
  status?: "ACTIVE" | "ENDED" | "EXPIRED"; scores?: number[]; pageSize?: number;
} = {}) {
  const questions = options.questions ?? [
    { text: "Welcher Planet ist für seine auffälligen Ringe bekannt und mit bloßem Auge am Nachthimmel zu sehen?", answers: ["Mars", "Saturn", "Venus", "Merkur"] },
    { text: "Wie viele Beine hat eine Spinne?", answers: ["Sechs", "Acht"] },
    { text: "Welche Farbe entsteht, wenn man Blau und Gelb mischt?", answers: ["Grün", "Orange", "Violett"] },
  ];
  await page.route("**/src/AdminAuth.tsx", (route) => route.fulfill({
    contentType: "application/javascript", body: "export function AdminGate({children}) { return children; }",
  }));
  await page.route("**/src/cloud.ts", (route) => route.fulfill({
    contentType: "application/javascript",
    body: `
      const QUESTIONS = ${JSON.stringify(questions)};
      const LEGACY = ${options.legacy ? "true" : "false"};
      const scoring = LEGACY ? { scoringVersion: "LEGACY_CORRECT", basePoints: 1, maxBonusPoints: 0, bonusWindowMs: 0 }
        : { scoringVersion: "ASYNC_SPEED_V1", basePoints: 1000, maxBonusPoints: 500, bonusWindowMs: 30000 };
      const expiresAt = Date.now() + 7 * 86400000;
      const load = () => JSON.parse(sessionStorage.getItem("async-attempt") || "null");
      const save = (value) => sessionStorage.setItem("async-attempt", JSON.stringify(value));
      const question = (index, startedAt) => index < QUESTIONS.length ? { questionIndex: index, text: QUESTIONS[index].text, startedAt,
        answers: QUESTIONS[index].answers.map((text, i) => ({ id: "c" + i, text })) } : null;
      const base = { title: "Feierabend-Quiz", description: "Drei kurze Fragen.", questionCount: QUESTIONS.length, expiresAt,
        timeZone: "Europe/Berlin", status: "ACTIVE", retentionAt: expiresAt + 30 * 86400000, endedAt: null, maxParticipants: 100, ...scoring };
      function guest(attempt) {
        return { ...base, displayName: "Flinker Fuchs", avatarId: "avatar-001", startedAt: attempt.startedAt, completedAt: null,
          attemptStatus: attempt.answered >= QUESTIONS.length ? "COMPLETED" : "IN_PROGRESS", answeredCount: attempt.answered,
          nextQuestionIndex: attempt.answered < QUESTIONS.length ? attempt.answered : null,
          question: question(attempt.answered, attempt.questionStart), points: null, serverTime: Date.now(),
          answers: attempt.answers, results: [] };
      }
      export async function configureCloud() { return true; }
      export const client = {};
      const impl = {
        asyncPublicInfo: async () => ({ ...base, serverTime: Date.now() }),
        myAsyncState: async () => { const attempt = load(); return attempt ? guest(attempt) : null; },
        extendGuestIdentityUntil: async () => undefined,
        startAsyncQuiz: async () => {
          const attempt = load() ?? { startedAt: Date.now(), questionStart: Date.now(), answered: 0, answers: [] };
          save(attempt); return guest(attempt);
        },
        submitAsyncAnswer: async (token, questionIndex, choiceId) => {
          const delay = Number(sessionStorage.getItem("submit-delay") || "0");
          if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
          const attempt = load();
          if (questionIndex !== attempt.answered) throw new Error("Quizfortschritt hat sich geändert.");
          const acceptedAt = Date.now();
          attempt.answers.push({ questionIndex, choiceId, acceptedAt });
          attempt.answered += 1; attempt.questionStart = acceptedAt;
          save(attempt);
          sessionStorage.setItem("submits", String(Number(sessionStorage.getItem("submits") || "0") + 1));
          const done = attempt.answered >= QUESTIONS.length;
          return { acceptedAt, answeredCount: attempt.answered, questionIndex, attemptStatus: done ? "COMPLETED" : "IN_PROGRESS",
            status: "ACTIVE", nextQuestionIndex: done ? null : attempt.answered, question: question(attempt.answered, acceptedAt),
            serverTime: Date.now() };
        },
        asyncPublicationResults: async (publicationId, cursor) => {
          const status = sessionStorage.getItem("async-status") || ${JSON.stringify(options.status ?? "ACTIVE")};
          const isFinal = status !== "ACTIVE";
          const names = ["Anna", "Ben", "Cem", "Dana", "Emil", "Fritz", "Gül", "Hanna"];
          const points = ${JSON.stringify(options.scores ?? [2900, 2900, 2400, 2100, 1800, 1200, 1000, 0])};
          let rank = 0;
          const participants = points.map((score, i) => {
            if (i === 0 || points[i] !== points[i - 1]) rank = i + 1;
            return { attemptId: "a" + i, displayName: names[i], avatarId: "avatar-00" + (i + 1), startedAt: Date.now() - 3600000, completedAt: i === 7 ? null : Date.now(),
              answeredCount: i === 7 ? 1 : QUESTIONS.length, questionCount: QUESTIONS.length,
              status: i === 7 ? isFinal ? "EXPIRED" : "IN_PROGRESS" : "COMPLETED", points: score, rank,
              answers: [{ questionIndex: 0, choiceId: "c1", acceptedAt: Date.now(), correct: true, points: 1400, basePoints: 1000, bonusPoints: 400, elapsedMs: 6000 }] };
          });
          const start = Number(cursor || 0);
          const end = start + ${options.pageSize ?? 8};
          const completedCount = participants.filter((player) => player.status === "COMPLETED").length;
          return { publicationId: "p1", title: "Feierabend-Quiz", status, isFinal, createdAt: Date.now() - 86400000,
            expiresAt, endedAt: isFinal ? Date.now() : null, timeZone: "Europe/Berlin", updatedAt: Date.now(), participantCount: participants.length, maxParticipants: 100,
            completedCount, partialCount: participants.length - completedCount, nextCursor: end < participants.length ? String(end) : null,
            totalParticipants: participants.length, ...scoring,
            leaders: participants.slice(0, 5).map((player) => ({ ...player, answers: [] })), participants: participants.slice(start, end),
            questions: QUESTIONS.map((item, questionIndex) => ({ questionIndex, text: item.text, answeredCount: participants.length,
              options: item.answers.map((text, i) => ({ id: "c" + i, text, count: i === 1 ? 6 : 1, correct: i === 1 })) })) };
        },
      };
      export const cloud = new Proxy(impl, { get: (target, key) => key in target ? target[key] : async () => null });
    `,
  }));
}

async function expectQuestionFits(page: Page) {
  const fit = await page.evaluate(() => {
    const button = document.querySelector(".question-submit")!.getBoundingClientRect();
    return { bottom: button.bottom, height: window.innerHeight, scrollWidth: document.documentElement.scrollWidth, width: window.innerWidth };
  });
  expect(fit.bottom, JSON.stringify(fit)).toBeLessThanOrEqual(fit.height);
  expect(fit.scrollWidth).toBeLessThanOrEqual(fit.width);
}

for (const viewport of [{ width: 360, height: 640 }, { width: 375, height: 667 }, { width: 390, height: 844 }]) {
  test(`Quiz zum Mitmachen: Frage, vier Antworten und Absenden passen ohne Scrollen bei ${viewport.width}×${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await mockAsync(page);
    await page.goto("/q/token");
    await expect(page.getByText(/Richtig antworten bringt 1\.000 Punkte/)).toBeVisible();
    await page.getByRole("button", { name: "Quiz starten" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Welcher Planet");
    await expect(page.getByRole("radio")).toHaveCount(4);
    await expect(page.locator(".speed-bonus")).toContainText("Tempo-Bonus");
    await expect(page.getByRole("link", { name: /Zur Startseite/ })).toHaveCount(0);
    await page.getByRole("radio", { name: "Saturn" }).check();
    await expectQuestionFits(page);
    await page.screenshot({ path: test.info().outputPath(`async-${viewport.width}.png`), animations: "disabled" });
  });
}

test("Quiz zum Mitmachen springt nach der Bestätigung direkt zur nächsten Frage – ohne Zwischenseite", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await mockAsync(page);
  await page.goto("/q/token");
  await page.getByRole("button", { name: "Quiz starten" }).click();
  await page.getByRole("radio", { name: "Saturn" }).check();
  await page.evaluate(() => { sessionStorage.setItem("submit-delay", "400"); window.scrollTo(0, 400); });
  const submit = page.getByRole("button", { name: "Antwort abgeben" });
  await submit.click();
  await expect(page.getByRole("button", { name: "Wird gespeichert …" })).toBeDisabled();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Wie viele Beine hat eine Spinne?");
  await expect(page.getByText("Antwort gespeichert", { exact: false })).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Wie viele Beine hat eine Spinne?" })).toBeFocused();
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  await expect(page.getByRole("radio", { checked: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Antwort abgeben" })).toBeDisabled();
  expect(await page.evaluate(() => sessionStorage.getItem("submits"))).toBe("1");
  // Zwei kurze Antworten stehen nebeneinander.
  const boxes = await page.locator(".async-option").evaluateAll((items) => items.map((item) => item.getBoundingClientRect().top));
  expect(Math.abs(boxes[0] - boxes[1])).toBeLessThan(2);

  // Neuladen setzt den Timer nicht zurück und zeigt dieselbe Frage.
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Wie viele Beine hat eine Spinne?");
  await page.getByRole("radio", { name: "Acht" }).check();
  await page.evaluate(() => sessionStorage.setItem("submit-delay", "0"));
  await page.getByRole("button", { name: "Antwort abgeben" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Blau und Gelb/);
  // Drei Antworten: einspaltig.
  const tops = await page.locator(".async-option").evaluateAll((items) => items.map((item) => item.getBoundingClientRect().top));
  expect(tops[1]).toBeGreaterThan(tops[0]);
  await page.getByRole("radio", { name: "Grün" }).check();
  await page.getByRole("button", { name: "Antwort abgeben" }).click();
  await expect(page.getByRole("heading", { name: "Quiz abgeschlossen" })).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem("submits"))).toBe("3");
});

test("Lange Antworten stehen einspaltig und das Absenden bleibt erreichbar", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await mockAsync(page, { questions: [{ text: "Welche Aussage über Photosynthese trifft zu?", answers: [
    "Pflanzen wandeln Licht in chemische Energie um", "Sie findet ausschließlich nachts statt",
    "Sie benötigt keinerlei Wasser", "Sie produziert vor allem Stickstoff"] }] });
  await page.goto("/q/token");
  await page.getByRole("button", { name: "Quiz starten" }).click();
  const tops = await page.locator(".async-option").evaluateAll((items) => items.map((item) => item.getBoundingClientRect().top));
  expect(tops[1]).toBeGreaterThan(tops[0]);
  await expect(page.getByRole("button", { name: "Antwort abgeben" })).toBeVisible();
});

test("Ältere Veröffentlichungen zeigen keinen Tempo-Bonus", async ({ page }) => {
  await mockAsync(page, { legacy: true });
  await page.goto("/q/token");
  await expect(page.getByText(/Richtig antworten bringt/)).toHaveCount(0);
  await page.getByRole("button", { name: "Quiz starten" }).click();
  await expect(page.getByRole("radio")).toHaveCount(4);
  await expect(page.locator(".speed-bonus")).toHaveCount(0);
});

test("Admin-Ergebnisse zeigen zuerst die Top 5, Details bleiben eingeklappt", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockAsync(page);
  await page.goto("/admin/async/p1");
  await expect(page.getByRole("heading", { name: "Aktuelle Top 5" })).toBeVisible();
  await expect(page.getByText("Vorläufig", { exact: true })).toBeVisible();
  const leaders = page.locator(".async-leaders > .async-leader-list > li");
  await expect(leaders).toHaveCount(5);
  await expect(leaders.nth(0)).toContainText("1.");
  await expect(leaders.nth(1)).toContainText("1.");
  await expect(leaders.nth(2)).toContainText("3.");
  await expect(leaders.nth(0)).toContainText("2.900");
  await expect(page.getByRole("heading", { name: "Fragenauswertung" })).toBeVisible();
  await expect(page.locator(".async-question-stat").first()).toBeHidden();
  await page.getByText("Weitere Platzierungen anzeigen (3)").click();
  await expect(page.locator(".async-more li")).toHaveCount(3);
  await page.getByRole("button", { name: "Aktualisieren" }).click();
  await expect(page.locator(".async-more")).toHaveAttribute("open", "");
  const top5Bottom = await leaders.nth(4).evaluate((item) => item.getBoundingClientRect().bottom);
  expect(top5Bottom).toBeLessThanOrEqual(844);
  await page.screenshot({ path: test.info().outputPath("async-admin.png"), fullPage: true, animations: "disabled" });
});

for (const viewport of [{ width: 1272, height: 900 }, { width: 390, height: 844 }]) {
  test(`Beendetes Quiz zeigt das Siegerpodest statt der Top-5-Karte bei ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await mockAsync(page, { status: "ENDED", scores: [4401, 1319] });
    await page.goto("/admin/async/p1");
    await expect(page.getByRole("heading", { level: 1, name: "Endstand" })).toBeVisible();
    const result = page.locator(".game-view");
    await expect(result.locator(".game-title")).toHaveText("Feierabend-Quiz");
    await expect(result.getByRole("status")).toHaveText("Vorzeitig beendet");
    await expect(result.locator(".ranking-intro")).toHaveText("Zusammen gerätselt. Gemeinsam gefeiert.");
    await expect(page.locator(".async-leaders")).toHaveCount(0);
    await expect(result.locator(".podium-player > strong")).toHaveText(["Ben", "Anna"]);
    await expect(result.locator(".podium-player > span")).toHaveText(["1.319 Punkte", "4.401 Punkte"]);
    await expect(result.locator(".pedestal")).toHaveText(["Platz 2", "Platz 1"]);
    const pedestals = await result.locator(".pedestal").evaluateAll((elements) => elements.map((element) => ({
      left: element.getBoundingClientRect().left, height: element.getBoundingClientRect().height,
      bottom: element.getBoundingClientRect().bottom, color: getComputedStyle(element).backgroundColor,
    })));
    expect(pedestals[0].left).toBeLessThan(pedestals[1].left);
    expect(pedestals[0].height).toBe(85);
    expect(pedestals[1].height).toBe(125);
    expect(pedestals[0].bottom).toBeCloseTo(pedestals[1].bottom);
    expect(pedestals[0].color).not.toBe(pedestals[1].color);
    await expect(result.locator(".game-footnote")).toContainText("2 Teilnehmende");
    await expect(page.locator(".async-question-stat").first()).toBeHidden();
    await page.getByText("Fragenauswertung", { exact: true }).click();
    await expect(page.locator(".async-question-stat").first()).toBeVisible();
    await page.getByText("Fragenauswertung", { exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
    await page.screenshot({ path: test.info().outputPath(`async-final-${viewport.width}.png`), fullPage: true, animations: "disabled" });
  });
}

test("Drei Teilnehmende stehen in der Podestreihenfolge 2–1–3", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await mockAsync(page, { status: "ENDED", scores: [4401, 1319, 0] });
  await page.goto("/admin/async/p1");
  await expect(page.locator(".pedestal")).toHaveText(["Platz 2", "Platz 1", "Platz 3"]);
  const heights = await page.locator(".pedestal").evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().height));
  expect(heights).toEqual([85, 125, 62]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});

for (const count of [0, 1]) {
  test(`Endstand mit ${count} Teilnehmenden bleibt korrekt`, async ({ page }) => {
    await mockAsync(page, { status: "ENDED", scores: count === 0 ? [] : [0] });
    await page.goto("/admin/async/p1");
    await expect(page.getByRole("heading", { name: "Endstand" })).toBeVisible();
    await expect(page.locator(".podium-player")).toHaveCount(count);
    if (count === 0) await expect(page.getByText("Noch keine Teilnehmenden.", { exact: true })).toBeVisible();
    else {
      await expect(page.locator(".pedestal")).toHaveText("Platz 1");
      await expect(page.locator(".podium-player > span")).toHaveText("0 Punkte");
    }
    await expect(page.locator(".async-more")).toHaveCount(0);
  });
}

test("Abgelaufene Runde erhält geteilte Ränge und nachladbare Platzierungen", async ({ page }) => {
  await mockAsync(page, { status: "EXPIRED", pageSize: 5 });
  await page.goto("/admin/async/p1");
  await expect(page.locator(".phase-badge")).toHaveText("Abgelaufen");
  await expect(page.locator(".pedestal")).toHaveText(["Platz 1", "Platz 1", "Platz 3"]);
  const heights = await page.locator(".pedestal").evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().height));
  expect(heights[0]).toBe(heights[1]);
  await expect(page.locator(".ranking-phase > .leaderboard .rank-name")).toHaveText(["Dana", "Emil"]);
  await page.getByText("Weitere Platzierungen anzeigen (3)").click();
  await page.getByRole("button", { name: "Weitere Teilnehmer laden" }).click();
  await expect(page.locator(".async-more .rank-name")).toHaveText(["Fritz", "Gül", "Hanna"]);
  await expect(page.locator(".async-more .rank-number")).toHaveText(["6", "7", "8"]);
  await expect(page.getByRole("button", { name: "Weitere Teilnehmer laden" })).toHaveCount(0);
  await page.getByRole("button", { name: "Aktualisieren" }).click();
  await expect(page.locator(".async-more")).toHaveAttribute("open", "");
  await expect(page.getByRole("button", { name: "Weitere Teilnehmer laden" })).toBeVisible();
  await expect(page.locator(".podium-player")).toHaveCount(3);
});

test("Ältere Veröffentlichungen behalten die Punkte pro Fragenzahl im Endstand", async ({ page }) => {
  await mockAsync(page, { status: "ENDED", legacy: true, scores: [3, 2] });
  await page.goto("/admin/async/p1");
  await expect(page.locator(".podium-player > span")).toHaveText(["2/3 Punkte", "3/3 Punkte"]);
});

test("Aktualisieren wechselt beim Rundenende von der Top-5-Liste zum Podest", async ({ page }) => {
  await mockAsync(page);
  await page.goto("/admin/async/p1");
  await expect(page.getByRole("heading", { name: "Aktuelle Top 5" })).toBeVisible();
  await expect(page.locator(".podium-player")).toHaveCount(0);
  await page.getByText("Weitere Platzierungen anzeigen (3)").click();
  await page.getByText("Fragenauswertung", { exact: true }).click();
  await page.evaluate(() => sessionStorage.setItem("async-status", "ENDED"));
  await page.getByRole("button", { name: "Aktualisieren" }).click();
  await expect(page.getByRole("heading", { name: "Endstand" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Aktuelle Top 5" })).toHaveCount(0);
  await expect(page.locator(".podium-player")).toHaveCount(3);
  await expect(page.locator(".async-more")).toHaveAttribute("open", "");
  await expect(page.locator(".async-more .rank-name")).toHaveText(["Fritz", "Gül", "Hanna"]);
  await expect(page.locator(".async-question-stat").first()).toBeVisible();
});
