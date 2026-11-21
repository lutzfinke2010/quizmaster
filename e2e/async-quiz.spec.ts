import { expect, test, type Page } from "@playwright/test";

/**
 * Quiz zum Mitmachen mit ASYNC_SPEED_V1: Fragenansicht im Live-Design (Antwortkacheln, Abgabe per Tipp),
 * Pause zwischen den Fragen, Tempo-Bonus-Anzeige und Admin-Podest mit weiteren Plätzen. Das Backend wird im Browser simuliert.
 * Wie der Server öffnet der Mock eine Folgefrage (und ihren Tempo-Timer) erst über startAsyncQuiz.
 */
async function mockAsync(page: Page, options: {
  questions?: Array<{ text: string; answers: string[] }>; legacy?: boolean;
  status?: "ACTIVE" | "ENDED" | "EXPIRED"; scores?: number[]; pageSize?: number; names?: string[]; title?: string;
  immediateReveal?: boolean; streakBonusEnabled?: boolean;
} = {}) {
  const questions = options.questions ?? [
    { text: "Welcher Planet ist für seine auffälligen Ringe bekannt und mit bloßem Auge am Nachthimmel zu sehen?", answers: ["Mars", "Saturn", "Venus", "Merkur"] },
    { text: "Wie viele Beine hat eine Spinne?", answers: ["Sechs", "Acht"] },
    { text: "Welche Farbe entsteht, wenn man Blau und Gelb mischt?", answers: ["Grün", "Orange", "Violett"] },
  ];
  await page.route("**/src/ui/admin/AdminGate.tsx", (route) => route.fulfill({
    contentType: "application/javascript", body: "export function AdminGate({children}) { return children; }",
  }));
  await page.route("**/src/cloud.ts", (route) => route.fulfill({
    contentType: "application/javascript",
    body: `
      const QUESTIONS = ${JSON.stringify(questions)};
      const LEGACY = ${options.legacy ? "true" : "false"};
      const IMMEDIATE = ${options.immediateReveal ? "true" : "false"};
      const STREAK_BONUS = ${options.streakBonusEnabled ? "true" : "false"};
      const scoring = LEGACY ? { scoringVersion: "LEGACY_CORRECT", basePoints: 1, maxBonusPoints: 0, bonusWindowMs: 0 }
        : { scoringVersion: "ASYNC_SPEED_V1", basePoints: 1000, maxBonusPoints: 500, bonusWindowMs: 30000 };
      const expiresAt = Date.now() + 7 * 86400000;
      const load = () => JSON.parse(sessionStorage.getItem("async-attempt") || "null");
      const save = (value) => sessionStorage.setItem("async-attempt", JSON.stringify(value));
      const question = (index, startedAt) => index < QUESTIONS.length ? { questionIndex: index, text: QUESTIONS[index].text, startedAt,
        answers: QUESTIONS[index].answers.map((text, i) => ({ id: "c" + i, text })) } : null;
      const base = { title: "Feierabend-Quiz", description: "Drei kurze Fragen.", questionCount: QUESTIONS.length, expiresAt,
        timeZone: "Europe/Berlin", status: "ACTIVE", retentionAt: expiresAt + 30 * 86400000, endedAt: null, maxParticipants: 250,
        immediateReveal: IMMEDIATE, streakBonusEnabled: STREAK_BONUS, ...scoring };
      function guest(attempt) {
        const status = sessionStorage.getItem("async-guest-status") || "ACTIVE";
        const unknownResult = sessionStorage.getItem("async-unknown-result") === "1";
        const answers = attempt.answers.map((answer) => unknownResult ? { ...answer, correct: null } : answer);
        const rank = sessionStorage.getItem("async-guest-rank");
        return { ...base, status, displayName: "Flinker Fuchs", avatarId: "avatar-001", startedAt: attempt.startedAt, completedAt: null,
          attemptStatus: attempt.answered >= QUESTIONS.length ? "COMPLETED" : status === "ACTIVE" ? "IN_PROGRESS" : "EXPIRED_PARTIAL",
          answeredCount: attempt.answered,
          nextQuestionIndex: attempt.answered < QUESTIONS.length ? attempt.answered : null,
          question: LEGACY ? question(attempt.answered, null)
            : attempt.openedIndex === attempt.answered ? question(attempt.answered, attempt.questionStart) : null,
          points: IMMEDIATE ? attempt.answers.reduce((sum, answer) => sum + answer.points, 0) : null, serverTime: Date.now(),
          rank: IMMEDIATE && attempt.answered > 0 ? rank !== null ? Number(rank) : attempt.answered >= 2 ? 1 : 3 : null,
          streak: IMMEDIATE ? attempt.answers.at(-1)?.streak || 0 : null,
          maxStreak: IMMEDIATE ? Math.max(0, ...attempt.answers.map((answer) => answer.streak || 0)) : null,
          badges: IMMEDIATE ? [
            ...(attempt.answers.some((answer) => answer.correct) ? ["FIRST_CORRECT"] : []),
            ...(attempt.answers.some((answer) => answer.streak >= 3) ? ["STREAK_3"] : []),
            ...(attempt.answered === QUESTIONS.length && attempt.answers.every((answer) => answer.correct) ? ["PERFECT"] : [])
          ] : [],
          answers, results: IMMEDIATE ? answers.map((answer) => ({
            ...answer, answered: true, questionText: QUESTIONS[answer.questionIndex].text
          })) : [] };
      }
      function resultSnapshot(publicationId) {
        const status = sessionStorage.getItem("async-status") || ${JSON.stringify(options.status ?? "ACTIVE")};
        const isFinal = status !== "ACTIVE";
        const names = JSON.parse(sessionStorage.getItem("async-names") || ${JSON.stringify(JSON.stringify(options.names ?? ["Anna", "Ben", "Cem", "Dana", "Emil", "Fritz", "Gül", "Hanna"]))});
        const points = JSON.parse(sessionStorage.getItem("async-points") || ${JSON.stringify(JSON.stringify(options.scores ?? [2900, 2900, 2400, 2100, 1800, 1200, 1000, 0]))});
        const counts = JSON.parse(sessionStorage.getItem("async-answered") || "null");
        const participants = points.map((score, i) => {
          const answeredCount = counts?.[i] ?? (i === 7 ? 1 : QUESTIONS.length);
          const complete = answeredCount >= QUESTIONS.length;
          return { attemptId: "a" + i, displayName: names[i] ?? "Spieler " + String(i + 1).padStart(3, "0"),
            avatarId: "avatar-001", startedAt: expiresAt - 7 * 86400000 - 3600000 + i, completedAt: complete ? expiresAt - 7 * 86400000 : null,
            answeredCount, questionCount: QUESTIONS.length,
            status: complete ? "COMPLETED" : isFinal ? "EXPIRED_PARTIAL" : "IN_PROGRESS", points: score, rank: 0,
            answers: Array.from({ length: answeredCount }, (_, questionIndex) => ({
              questionIndex, choiceId: "c1", acceptedAt: expiresAt - 7 * 86400000, correct: true,
              points: 1400, basePoints: 1000, bonusPoints: 400, elapsedMs: 6000,
            })) };
        });
        participants.sort((left, right) => right.points - left.points || left.displayName.localeCompare(right.displayName) ||
          left.attemptId.localeCompare(right.attemptId));
        let rank = 0;
        participants.forEach((player, index) => {
          if (index === 0 || player.points !== participants[index - 1].points) rank = index + 1;
          player.rank = rank;
        });
        const completedCount = participants.filter((player) => player.status === "COMPLETED").length;
        return { publicationId, quizId: "quiz1", title: ${JSON.stringify(options.title ?? "Feierabend-Quiz")}, status, isFinal, createdAt: expiresAt - 8 * 86400000,
          expiresAt, retentionAt: Number(sessionStorage.getItem("async-retention") || base.retentionAt),
          endedAt: isFinal ? Date.now() : null, timeZone: "Europe/Berlin", updatedAt: Date.now(),
          participantCount: participants.length, maxParticipants: 250, completedCount, partialCount: participants.length - completedCount,
          totalParticipants: participants.length, ...scoring, participants,
          questions: QUESTIONS.map((item, questionIndex) => {
            const answeredCount = participants.filter((player) => player.answeredCount > questionIndex).length;
            return { questionIndex, text: item.text, correctChoiceId: "c1", explanation: "", answeredCount,
              options: item.answers.map((text, i) => ({ id: "c" + i, text, count: i === 1 ? answeredCount : 0, correct: i === 1 })) };
          }) };
      }
      let standingsInFlight = 0;
      export async function configureCloud() { return true; }
      export const client = {};
      const impl = {
        getQuiz: async (quizId) => ({ quizId, version: 1, updatedAt: Date.now(), quiz: {
          title: "Feierabend-Quiz", description: "", questions: QUESTIONS.map((item) => ({
            text: item.text, durationSeconds: 20, explanation: "",
            answers: item.answers.map((text, index) => ({ text, correct: index === 1 })),
          })),
        } }),
        publishAsyncQuiz: async (quizId, requestId, endsAt, timeZone, streakBonusEnabled, immediateReveal) => {
          sessionStorage.setItem("published-options", JSON.stringify({ streakBonusEnabled, immediateReveal }));
          return { publicationId: "p1", token: "quiz-token", joinCode: "123456",
            expiresAt: endsAt, timeZone, retentionDays: 30, maxParticipants: 250 };
        },
        listQuizzes: async () => [],
        listSessions: async () => [],
        listAsyncPublications: async () => [],
        asyncPublicInfo: async () => ({ ...base, serverTime: Date.now() }),
        myAsyncState: async () => { const attempt = load(); return attempt ? guest(attempt) : null; },
        extendGuestIdentityUntil: async () => undefined,
        startAsyncQuiz: async () => {
          const attempt = load() ?? { startedAt: Date.now(), questionStart: Date.now(), openedIndex: 0, answered: 0, answers: [] };
          if (attempt.openedIndex !== attempt.answered && attempt.answered < QUESTIONS.length) {
            attempt.openedIndex = attempt.answered; attempt.questionStart = Date.now();
          }
          save(attempt); return guest(attempt);
        },
        submitAsyncAnswer: async (token, questionIndex, choiceId) => {
          const delay = Number(sessionStorage.getItem("submit-delay") || "0");
          if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
          if (sessionStorage.getItem("submit-fail")) {
            sessionStorage.removeItem("submit-fail");
            throw new Error("Netzwerkfehler.");
          }
          const attempt = load();
          if (questionIndex !== attempt.answered || (!LEGACY && attempt.openedIndex !== questionIndex)) {
            throw new Error("Quizfortschritt hat sich geändert.");
          }
          const acceptedAt = Date.now();
          const correct = choiceId === (questionIndex === 2 ? "c0" : "c1");
          const streak = correct ? (attempt.answers.at(-1)?.streak || 0) + 1 : 0;
          const extra = STREAK_BONUS && streak >= 3 ? streak === 3 ? 100 : streak === 4 ? 150 : 200 : 0;
          attempt.answers.push({ questionIndex, choiceId, acceptedAt, ...(IMMEDIATE ? {
            correct, streak, points: correct ? 1500 + extra : 0, basePoints: correct ? 1000 : 0,
            bonusPoints: correct ? 500 : 0, streakBonusPoints: extra,
            correctText: QUESTIONS[questionIndex].answers[questionIndex === 2 ? 0 : 1],
            selectedText: QUESTIONS[questionIndex].answers[Number(choiceId.slice(1))], explanation: "Die bestätigte Lösung."
          } : {}) });
          attempt.answered += 1;
          save(attempt);
          sessionStorage.setItem("submits", String(Number(sessionStorage.getItem("submits") || "0") + 1));
          const done = attempt.answered >= QUESTIONS.length;
          if (sessionStorage.getItem("lose-confirmation")) {
            sessionStorage.removeItem("lose-confirmation");
            throw new Error("Bestätigung verloren.");
          }
          return { acceptedAt, answeredCount: attempt.answered, questionIndex, attemptStatus: done ? "COMPLETED" : "IN_PROGRESS",
            status: "ACTIVE", nextQuestionIndex: done ? null : attempt.answered, question: LEGACY ? question(attempt.answered, null) : null,
            serverTime: Date.now(), state: IMMEDIATE ? guest(attempt) : null };
        },
        asyncStandings: async (publicationId) => {
          sessionStorage.setItem("async-standings-requests", String(Number(sessionStorage.getItem("async-standings-requests") || "0") + 1));
          standingsInFlight++;
          sessionStorage.setItem("async-max-concurrent", String(Math.max(standingsInFlight, Number(sessionStorage.getItem("async-max-concurrent") || "0"))));
          try {
            const delay = Number(sessionStorage.getItem("async-standings-delay") || "0");
            if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
            const failures = Number(sessionStorage.getItem("async-standings-fail") || "0");
            if (failures > 0) {
              sessionStorage.setItem("async-standings-fail", String(failures - 1));
              throw new Error("Netzwerkfehler.");
            }
            const snapshot = resultSnapshot(publicationId);
            return { ...snapshot, participants: snapshot.participants.map(({ answers, ...player }) => player) };
          } finally { standingsInFlight--; }
        },
        asyncPublicationResults: async (publicationId, cursor) => {
          sessionStorage.setItem("async-detail-requests", String(Number(sessionStorage.getItem("async-detail-requests") || "0") + 1));
          const snapshot = resultSnapshot(publicationId);
          const delay = Number(sessionStorage.getItem("async-detail-delay") || "0");
          if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
          const failures = Number(sessionStorage.getItem("async-detail-fail") || "0");
          if (failures > 0) {
            sessionStorage.setItem("async-detail-fail", String(failures - 1));
            throw new Error("Netzwerkfehler.");
          }
          const start = Number(cursor || 0);
          const end = start + ${options.pageSize ?? 50};
          return { ...snapshot, nextCursor: end < snapshot.participants.length ? String(end) : null,
            leaders: snapshot.participants.slice(0, 5).map((player) => ({ ...player, answers: [] })),
            participants: snapshot.participants.slice(start, end) };
        },
      };
      export const cloud = new Proxy(impl, { get: (target, key) => key in target ? target[key] : async () => null });
    `,
  }));
}

async function expectQuestionFits(page: Page) {
  const fit = await page.evaluate(() => {
    const feedback = document.querySelector(".answer-feedback")!.getBoundingClientRect();
    return { bottom: feedback.bottom, height: window.innerHeight, scrollWidth: document.documentElement.scrollWidth, width: window.innerWidth };
  });
  expect(fit.bottom, JSON.stringify(fit)).toBeLessThanOrEqual(fit.height);
  expect(fit.scrollWidth).toBeLessThanOrEqual(fit.width);
}

const attemptState = (page: Page) => page.evaluate(() =>
  JSON.parse(sessionStorage.getItem("async-attempt") || "null") as { openedIndex: number; questionStart: number; answered: number });
const tileTops = (page: Page) => page.locator(".rl-answer").evaluateAll((items) => items.map((item) => item.getBoundingClientRect().top));

for (const viewport of [{ width: 360, height: 640 }, { width: 375, height: 667 }, { width: 390, height: 844 }]) {
  test(`Quiz zum Mitmachen: Frage und vier Antwortkacheln passen ohne Scrollen bei ${viewport.width}×${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await mockAsync(page);
    await page.goto("/q/token");
    await expect(page.getByText("Maximal 250 Teilnahmen.", { exact: false })).toBeVisible();
    await expect(page.getByText(/Richtig antworten bringt 1\.000 Punkte/)).toBeVisible();
    await page.getByRole("button", { name: "Quiz starten" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Welcher Planet");
    await expect(page.locator(".async-question")).toBeVisible();
    await expect(page.locator("button.rl-answer")).toHaveCount(4);
    await expect(page.locator(".rl-answer-letter")).toHaveText(["A", "B", "C", "D"]);
    await expect(page.locator(".rl-question-position-label")).toHaveText("Frage 1 von 3");
    await expect(page.locator(".rl-speed-bonus")).toContainText("Tempo-Bonus");
    await expect(page.locator(".answer-feedback")).toHaveText("Tippe auf eine Antwort – sie wird direkt abgegeben.");
    await expect(page.getByText("Hinweise und Fortschritt")).toBeVisible();
    await expect(page.getByRole("button", { name: "Antwort abgeben" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /Zur Startseite/ })).toHaveCount(0);
    await expectQuestionFits(page);
    await page.screenshot({ path: test.info().outputPath(`async-${viewport.width}.png`), animations: "disabled" });
  });
}

test("Quiz zum Mitmachen: Tipp gibt sofort ab, danach Pause bis „Weiter“ – der Tempo-Timer startet erst beim Öffnen", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await mockAsync(page);
  await page.goto("/q/token");
  await page.getByRole("button", { name: "Quiz starten" }).click();
  await page.evaluate(() => { sessionStorage.setItem("submit-delay", "400"); window.scrollTo(0, 400); });
  await page.getByRole("button", { name: /Saturn/ }).click();
  await expect(page.locator(".rl-answer.is-pending")).toContainText("Wird gesendet …");
  await expect(page.locator(".answer-feedback")).toContainText("Wird gesendet … B · Saturn");
  await expect(page.getByRole("button", { name: /Mars/ })).toHaveAttribute("aria-disabled", "true");

  // Pause statt direkter Folgefrage; die nächste Frage ist noch nicht geladen.
  const pauseHeading = page.getByRole("heading", { level: 1, name: "Antwort gespeichert" });
  await expect(pauseHeading).toBeVisible();
  await expect(pauseHeading).toBeFocused();
  await expect(page.getByText("Deine Antwort: B · Saturn")).toBeVisible();
  await expect(page.getByText("1 von 3", { exact: false })).toBeVisible();
  await expect(page.getByText("Der Tempo-Bonus startet erst, wenn du die nächste Frage öffnest.", { exact: false })).toBeVisible();
  await expect(page.getByText("Wie viele Beine hat eine Spinne?")).toHaveCount(0);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  expect(await page.evaluate(() => sessionStorage.getItem("submits"))).toBe("1");
  expect((await attemptState(page)).openedIndex).toBe(0);
  await page.screenshot({ path: test.info().outputPath("async-pause-375.png"), animations: "disabled" });

  // Neuladen während der Pause öffnet die Frage nicht und startet keinen Timer.
  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "Bereit für Frage 2?" })).toBeVisible();
  await expect(page.getByText("Wie viele Beine hat eine Spinne?")).toHaveCount(0);
  expect((await attemptState(page)).openedIndex).toBe(0);

  await page.getByRole("button", { name: "Weiter zu Frage 2" }).click();
  const second = page.getByRole("heading", { level: 1, name: "Wie viele Beine hat eine Spinne?" });
  await expect(second).toBeFocused();
  await expect(page.locator(".rl-question-position-label")).toHaveText("Frage 2 von 3");
  await expect(page.locator(".rl-speed-bonus")).toContainText("Tempo-Bonus");
  const opened = await attemptState(page);
  expect(opened.openedIndex).toBe(1);
  // Zwei kurze Antworten stehen nebeneinander.
  const pair = await tileTops(page);
  expect(Math.abs(pair[0] - pair[1])).toBeLessThan(2);

  // Neuladen während einer Frage zeigt dieselbe Frage und setzt den Timer nicht zurück.
  await page.reload();
  await expect(second).toBeVisible();
  expect((await attemptState(page)).questionStart).toBe(opened.questionStart);

  await page.evaluate(() => sessionStorage.setItem("submit-delay", "0"));
  await page.getByRole("button", { name: /Acht/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Antwort gespeichert" })).toBeVisible();
  await page.getByRole("button", { name: "Weiter zu Frage 3" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Blau und Gelb/);
  // Drei Antworten: einspaltig.
  const tops = await tileTops(page);
  expect(tops[1]).toBeGreaterThan(tops[0]);
  await page.getByRole("button", { name: /Grün/ }).click();
  await expect(page.getByRole("heading", { name: "Quiz abgeschlossen" })).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem("submits"))).toBe("3");
});

test("Nicht bestätigte Antwort lässt sich durch erneutes Tippen senden", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await mockAsync(page);
  await page.goto("/q/token");
  await page.getByRole("button", { name: "Quiz starten" }).click();
  await page.evaluate(() => sessionStorage.setItem("submit-fail", "1"));
  await page.getByRole("button", { name: /Saturn/ }).click();
  await expect(page.getByText(/Antwort nicht bestätigt: Netzwerkfehler/)).toBeVisible();
  await expect(page.locator(".answer-feedback")).toContainText("Nicht gespeichert: B · Saturn");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Welcher Planet");
  await page.getByRole("button", { name: /Saturn/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Antwort gespeichert" })).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem("submits"))).toBe("1");
});

test("Lange Antworten stehen einspaltig und bleiben mit Hinweis erreichbar", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await mockAsync(page, { questions: [{ text: "Welche Aussage über Photosynthese trifft zu?", answers: [
    "Pflanzen wandeln Licht in chemische Energie um", "Sie findet ausschließlich nachts statt",
    "Sie benötigt keinerlei Wasser", "Sie produziert vor allem Stickstoff"] }] });
  await page.goto("/q/token");
  await page.getByRole("button", { name: "Quiz starten" }).click();
  const tops = await tileTops(page);
  expect(tops[1]).toBeGreaterThan(tops[0]);
  await expectQuestionFits(page);
  await page.screenshot({ path: test.info().outputPath("async-long-360.png"), animations: "disabled" });
});

test("Ältere Veröffentlichungen zeigen keinen Tempo-Bonus, pausieren aber ebenfalls", async ({ page }) => {
  await mockAsync(page, { legacy: true });
  await page.goto("/q/token");
  await expect(page.getByText(/Richtig antworten bringt/)).toHaveCount(0);
  await page.getByRole("button", { name: "Quiz starten" }).click();
  await expect(page.locator("button.rl-answer")).toHaveCount(4);
  await expect(page.locator(".rl-speed-bonus")).toHaveCount(0);
  await page.getByRole("button", { name: /Saturn/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Antwort gespeichert" })).toBeVisible();
  await expect(page.getByText("Tempo-Bonus", { exact: false })).toHaveCount(0);
  await page.getByRole("button", { name: "Weiter zu Frage 2" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Wie viele Beine hat eine Spinne?");
});

test("Zwischenstand zeigt ein Podest mit Gleichständen und alle übrigen Plätze direkt darunter", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockAsync(page);
  await page.goto("/admin/async/p1");
  await expect(page.getByRole("heading", { name: "Zwischenstand" })).toBeVisible();
  await expect(page.getByText(/8 von 250 gestartet/)).toBeVisible();
  await expect(page.getByText("Vorläufig", { exact: true })).toBeVisible();
  await expect(page.locator(".rl-podium")).toHaveAttribute("aria-label", "Führende der Runde");
  await expect(page.locator(".rl-podium-name")).toHaveText(["Ben", "Anna", "Cem"]);
  await expect(page.locator(".rl-podium-points")).toHaveText(["2.900 Punkte", "2.900 Punkte", "2.400 Punkte"]);
  await expect(page.locator(".rl-podium-detail")).toHaveText(["fertig", "fertig", "fertig"]);
  await expect(page.locator(".rl-podium-block")).toHaveText(["Platz 1", "Platz 1", "Platz 3"]);
  const heights = await page.locator(".rl-podium-block").evaluateAll((items) => items.map((item) => item.getBoundingClientRect().height));
  expect(heights).toEqual([110, 110, 62]);
  const leaders = page.locator(".async-leaders > .async-leader-list > li");
  await expect(leaders).toHaveCount(5);
  await expect(leaders.locator(".async-leader-name")).toHaveText(["Dana", "Emil", "Fritz", "Gül", "Hanna"]);
  await expect(leaders.locator(".async-leader-rank")).toHaveText(["4.", "5.", "6.", "7.", "8."]);
  await expect(leaders.last()).toContainText("läuft");
  const podiumBottom = await page.locator(".rl-podium").evaluate((item) => item.getBoundingClientRect().bottom);
  expect(await leaders.first().evaluate((item) => item.getBoundingClientRect().top)).toBeGreaterThanOrEqual(podiumBottom);
  await expect(page.getByRole("heading", { name: "Fragenauswertung" })).toBeVisible();
  await expect(page.locator(".async-question-stat").first()).toBeHidden();
  await expect(page.locator(".async-more-ranks")).toHaveCount(0);
  await page.getByRole("button", { name: "Aktualisieren" }).click();
  await expect(leaders).toHaveCount(5);
  await page.screenshot({ path: test.info().outputPath("async-admin.png"), fullPage: true, animations: "disabled" });
});

for (const width of [320, 1440]) {
  test(`Zwischenstand nutzt die Treppe 2–1–3 auch mit langen Namen (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await mockAsync(page, { scores: [4401, 1319, 0, 0], names: [
      "Außergewöhnlich neugieriger Fuchs", "Fröhlicher Waschbär mit Quizlaune", "Cem", "Dana",
    ] });
    await page.goto("/admin/async/p1");
    await expect(page.locator(".rl-podium-block")).toHaveText(["Platz 2", "Platz 1", "Platz 3"]);
    await expect.poll(() => page.locator(".rl-podium-block").evaluateAll((items) => {
      const bottoms = items.map((item) => item.getBoundingClientRect().bottom);
      return Math.max(...bottoms) - Math.min(...bottoms);
    })).toBeLessThan(.005);
    const steps = await page.locator(".rl-podium-block").evaluateAll((items) => items.map((item) => ({
      height: item.getBoundingClientRect().height, bottom: item.getBoundingClientRect().bottom,
    })));
    expect(steps.map((step) => step.height)).toEqual([82, 110, 62]);
    expect(steps[0].bottom).toBeCloseTo(steps[1].bottom);
    expect(steps[1].bottom).toBeCloseTo(steps[2].bottom);
    await expect(page.locator(".async-leader-rank")).toHaveText("3.");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.screenshot({ path: test.info().outputPath(`async-interim-${width}.png`), fullPage: true, animations: "disabled" });
  });
}

for (const count of [0, 1, 2]) {
  test(`Zwischenstand mit ${count} Teilnehmenden und Nullpunkten erfindet keine Plätze`, async ({ page }) => {
    await mockAsync(page, { scores: Array(count).fill(0) });
    await page.goto("/admin/async/p1");
    await expect(page.getByRole("heading", { name: "Zwischenstand" })).toBeVisible();
    await expect(page.locator(".rl-podium-player")).toHaveCount(count);
    if (count === 0) await expect(page.getByText(/Noch keine Teilnahmen\./)).toBeVisible();
    else await expect(page.locator(".rl-podium-points")).toHaveText(Array(count).fill("0 Punkte"));
    await expect(page.locator(".async-leader")).toHaveCount(0);
  });
}

test("Zwischenstand zeigt und erweitert die weiteren Plätze unterhalb des Podests ohne Duplikate", async ({ page }) => {
  const scores = Array.from({ length: 65 }, (_, index) => 5000 - index);
  const names = scores.map((_, index) => `Spieler ${String(index + 1).padStart(3, "0")}`);
  await mockAsync(page, { scores, names });
  await page.goto("/admin/async/p1");
  const rows = page.locator(".async-leader-name");
  await expect(rows).toHaveCount(47);
  await page.getByRole("button", { name: "Weitere Plätze anzeigen" }).click();
  await expect(rows).toHaveText(names.slice(3));
  await expect(page.locator(".rl-podium-player")).toHaveCount(3);
  await expect(page.getByRole("button", { name: "Weitere Plätze anzeigen" })).toHaveCount(0);
});

test("Zwischenstand behält ältere Punktewertung auf dem Podest und darunter", async ({ page }) => {
  await mockAsync(page, { legacy: true, scores: [3, 2, 1, 0] });
  await page.goto("/admin/async/p1");
  await expect(page.locator(".rl-podium-points")).toHaveText(["2/3 Punkte", "3/3 Punkte", "1/3 Punkte"]);
  await expect(page.locator(".async-leader-points")).toHaveText("0/3");
});

for (const viewport of [{ width: 1272, height: 900 }, { width: 390, height: 844 }]) {
  test(`Beendetes Quiz zeigt das Siegerpodest statt der Top-5-Karte bei ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await mockAsync(page, { status: "ENDED", scores: [4401, 1319] });
    await page.goto("/admin/async/p1");
    await expect(page.getByRole("heading", { level: 1, name: "Endstand" })).toBeVisible();
    const result = page.locator(".async-final-view");
    await expect(result.locator(".async-final-title")).toHaveText("Feierabend-Quiz");
    await expect(result.getByRole("status")).toHaveText("Vorzeitig beendet");
    await expect(result.locator(".async-final-intro")).toHaveText("Zusammen gerätselt. Gemeinsam gefeiert.");
    await expect(page.locator(".async-leaders")).toHaveCount(0);
    await expect(result.locator(".rl-podium-name")).toHaveText(["Ben", "Anna"]);
    await expect(result.locator(".rl-podium-points")).toHaveText(["1.319 Punkte", "4.401 Punkte"]);
    await expect(result.locator(".rl-podium-block")).toHaveText(["Platz 2", "Platz 1"]);
    const pedestals = await result.locator(".rl-podium-block").evaluateAll((elements) => elements.map((element) => ({
      left: element.getBoundingClientRect().left, height: element.getBoundingClientRect().height,
      bottom: element.getBoundingClientRect().bottom, color: getComputedStyle(element).backgroundImage,
    })));
    expect(pedestals[0].left).toBeLessThan(pedestals[1].left);
    expect(pedestals[0].height).toBe(82);
    expect(pedestals[1].height).toBe(110);
    expect(pedestals[0].bottom).toBeCloseTo(pedestals[1].bottom);
    expect(pedestals[0].color).not.toBe(pedestals[1].color);
    await expect(result.locator(".async-final-footnote")).toContainText("2 Teilnehmende");
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
  await expect(page.locator(".rl-podium-block")).toHaveText(["Platz 2", "Platz 1", "Platz 3"]);
  await expect.poll(() => page.locator(".rl-podium-player").evaluateAll((elements) =>
    elements.every((element) => getComputedStyle(element).transform === "none"))).toBe(true);
  const heights = await page.locator(".rl-podium-block").evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().height));
  expect(heights).toEqual([82, 110, 62]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});

for (const count of [0, 1]) {
  test(`Endstand mit ${count} Teilnehmenden bleibt korrekt`, async ({ page }) => {
    await mockAsync(page, { status: "ENDED", scores: count === 0 ? [] : [0] });
    await page.goto("/admin/async/p1");
    await expect(page.getByRole("heading", { name: "Endstand" })).toBeVisible();
    await expect(page.locator(".rl-podium-player")).toHaveCount(count);
    if (count === 0) await expect(page.getByText("Noch keine Teilnehmenden.", { exact: true })).toBeVisible();
    else {
      await expect(page.locator(".rl-podium-block")).toHaveText("Platz 1");
      await expect(page.locator(".rl-podium-points")).toHaveText("0 Punkte");
    }
    await expect(page.locator(".async-more-ranks")).toHaveCount(0);
  });
}

test("Abgelaufene Runde zeigt geteilte Ränge und alle weiteren Platzierungen", async ({ page }) => {
  await mockAsync(page, { status: "EXPIRED" });
  await page.goto("/admin/async/p1");
  await expect(page.locator(".async-phase-badge")).toHaveText("Abgelaufen");
  await expect(page.locator(".rl-podium-block")).toHaveText(["Platz 1", "Platz 1", "Platz 3"]);
  const heights = await page.locator(".rl-podium-block").evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().height));
  expect(heights[0]).toBe(heights[1]);
  await expect(page.locator(".async-final > .rl-leaderboard .rl-leaderboard-name")).toHaveText(["Dana", "Emil", "Fritz", "Gül", "Hanna"]);
  await expect(page.locator(".async-final > .rl-leaderboard .rl-leaderboard-rank")).toHaveText(["4", "5", "6", "7", "8"]);
  await page.getByRole("button", { name: "Aktualisieren" }).click();
  await expect(page.locator(".async-final > .rl-leaderboard .rl-leaderboard-name")).toHaveCount(5);
  await expect(page.locator(".rl-podium-player")).toHaveCount(3);
});

test("Ältere Veröffentlichungen behalten die Punkte pro Fragenzahl im Endstand", async ({ page }) => {
  await mockAsync(page, { status: "ENDED", legacy: true, scores: [3, 2] });
  await page.goto("/admin/async/p1");
  await expect(page.locator(".rl-podium-points")).toHaveText(["2/3 Punkte", "3/3 Punkte"]);
});

test("Aktualisieren wechselt vom vorläufigen Podest zum Endstand und behält offene Details", async ({ page }) => {
  await mockAsync(page);
  await page.goto("/admin/async/p1");
  await expect(page.getByRole("heading", { name: "Zwischenstand" })).toBeVisible();
  await expect(page.locator(".rl-podium-player")).toHaveCount(3);
  await page.getByText("Fragenauswertung", { exact: true }).click();
  await page.evaluate(() => sessionStorage.setItem("async-status", "ENDED"));
  await page.getByRole("button", { name: "Aktualisieren" }).click();
  await expect(page.getByRole("heading", { name: "Endstand" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Zwischenstand" })).toHaveCount(0);
  await expect(page.locator(".rl-podium-player")).toHaveCount(3);
  await expect(page.locator(".async-final > .rl-leaderboard .rl-leaderboard-name")).toHaveText(["Dana", "Emil", "Fritz", "Gül", "Hanna"]);
  await expect(page.locator(".async-question-stat").first()).toBeVisible();
});

test("Zwischenstand und offene Details aktualisieren sich nach zehn Sekunden auch ohne neue Teilnehmende", async ({ page }) => {
  await page.clock.install({ time: new Date("2030-01-01T12:00:00Z") });
  await mockAsync(page);
  await page.goto("/admin/async/p1");
  await expect(page.locator(".async-leaders .rl-podium-name")).toHaveText(["Ben", "Anna", "Cem"]);
  expect(await page.evaluate(() => sessionStorage.getItem("async-detail-requests"))).toBeNull();
  await page.getByText("Fragenauswertung", { exact: true }).click();
  await page.getByText("Teilnehmerdetails", { exact: true }).click();
  const hanna = page.locator(".async-result-player").filter({ hasText: "Hanna" });
  await expect(hanna).toContainText("1 richtig");
  await hanna.locator("summary").click();
  const firstDetails = Number(await page.evaluate(() => sessionStorage.getItem("async-detail-requests")));
  await page.evaluate(() => {
    sessionStorage.setItem("async-points", JSON.stringify([2900, 2900, 2400, 2100, 1800, 1200, 1000, 3300]));
    sessionStorage.setItem("async-answered", JSON.stringify([3, 3, 3, 3, 3, 3, 3, 2]));
  });
  await page.clock.runFor(9_000);
  await expect(page.locator(".async-leaders .rl-podium-name")).toHaveText(["Ben", "Anna", "Cem"]);
  await page.clock.runFor(1_000);
  await expect(page.locator(".async-leaders .rl-podium-name")).toHaveText(["Anna", "Hanna", "Ben"]);
  await expect(page.locator(".async-question-stat").nth(1)).toContainText("8 Antworten");
  await expect(hanna).toContainText("2 richtig");
  await expect(hanna).toHaveAttribute("open", "");
  await expect(page.locator(".async-admin-section").filter({ hasText: "Fragenauswertung" })).toHaveAttribute("open", "");
  expect(Number(await page.evaluate(() => sessionStorage.getItem("async-detail-requests")))).toBeGreaterThan(firstDetails);
  await page.evaluate(() => sessionStorage.setItem("async-status", "ENDED"));
  await page.clock.runFor(10_000);
  await expect(page.getByRole("heading", { name: "Endstand" })).toBeVisible();
  await expect(hanna).toHaveAttribute("open", "");
});

test("Fehler beim Abgleich zeigen den letzten Stand und werden beim nächsten Versuch behoben", async ({ page }) => {
  await page.clock.install({ time: new Date("2030-01-01T12:00:00Z") });
  await mockAsync(page);
  await page.goto("/admin/async/p1");
  await expect(page.locator(".async-leaders .rl-podium-name")).toHaveText(["Ben", "Anna", "Cem"]);
  await page.evaluate(() => {
    sessionStorage.setItem("async-standings-fail", "1");
    sessionStorage.setItem("async-points", JSON.stringify([2900, 2900, 2400, 2100, 1800, 1200, 1000, 3300]));
  });
  await page.clock.runFor(10_000);
  await expect(page.getByRole("alert")).toContainText("Aktualisierung fehlgeschlagen: Netzwerkfehler");
  await expect(page.locator(".async-summary-line")).toContainText("Aktualisiert:");
  await expect(page.locator(".async-leaders .rl-podium-name")).toHaveText(["Ben", "Anna", "Cem"]);
  await page.clock.runFor(10_000);
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.locator(".async-leaders .rl-podium-name")).toHaveText(["Anna", "Hanna", "Ben"]);
  expect(await page.evaluate(() => sessionStorage.getItem("async-detail-requests"))).toBeNull();
});

test("Ein gespeicherter Stand verschwindet nach Ablauf der Aufbewahrungsfrist auch bei Verbindungsfehlern", async ({ page }) => {
  await page.clock.install({ time: new Date("2030-01-01T12:00:00Z") });
  await page.addInitScript(() => sessionStorage.setItem("async-retention", String(Date.now() + 15_000)));
  await mockAsync(page, { status: "ENDED" });
  await page.goto("/admin/async/p1");
  await expect(page.getByRole("heading", { name: "Endstand" })).toBeVisible();
  await page.getByText("Teilnehmerdetails", { exact: true }).click();
  await expect(page.locator(".async-result-player").filter({ has: page.getByText("Rang 1 · Anna", { exact: true }) })).toContainText("3 richtig");
  await page.evaluate(() => sessionStorage.setItem("async-standings-fail", "10"));
  await page.clock.runFor(10_000);
  await expect(page.getByRole("alert")).toContainText("Aktualisierung fehlgeschlagen");
  await page.clock.runFor(5_000);
  await expect(page.getByRole("alert")).toContainText("Aufbewahrungsfrist dieser Runde ist abgelaufen");
  await expect(page.getByRole("heading", { name: "Endstand" })).toHaveCount(0);
  await expect(page.locator(".async-result-player")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Erneut versuchen" })).toHaveCount(0);
});

test("Die Aufbewahrungsfrist beendet auch die laufende Vollbildpräsentation", async ({ page }) => {
  await page.clock.install({ time: new Date("2030-01-01T12:00:00Z") });
  await page.addInitScript(() => sessionStorage.setItem("async-retention", String(Date.now() + 15_000)));
  await mockAsync(page, { status: "ENDED" });
  await page.goto("/admin/async/p1");
  await page.getByRole("button", { name: "Vollbild anzeigen" }).click();
  const stage = page.getByRole("region", { name: "Ergebnispräsentation" });
  await expect(stage.locator(".rl-podium-player")).toHaveCount(3);
  await page.evaluate(() => sessionStorage.setItem("async-standings-fail", "10"));
  await page.clock.runFor(15_000);
  await expect(page.getByRole("alert")).toContainText("Aufbewahrungsfrist dieser Runde ist abgelaufen");
  await expect(stage).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => document.fullscreenElement)).toBeNull();
});

test("Hintergrund-Tabs pausieren den Abgleich und holen ihn bei Rückkehr nach", async ({ page }) => {
  await page.clock.install({ time: new Date("2030-01-01T12:00:00Z") });
  await page.addInitScript(() => Object.defineProperty(document, "visibilityState", {
    configurable: true, get: () => sessionStorage.getItem("mock-visibility") || "visible",
  }));
  await mockAsync(page);
  await page.goto("/admin/async/p1");
  await expect(page.locator(".async-leaders .rl-podium-name")).toHaveCount(3);
  const initial = Number(await page.evaluate(() => sessionStorage.getItem("async-standings-requests")));
  await page.evaluate(() => {
    sessionStorage.setItem("mock-visibility", "hidden");
    sessionStorage.setItem("async-points", JSON.stringify([2900, 2900, 2400, 2100, 1800, 1200, 1000, 3300]));
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.clock.runFor(30_000);
  expect(Number(await page.evaluate(() => sessionStorage.getItem("async-standings-requests")))).toBe(initial);
  await page.evaluate(() => {
    sessionStorage.setItem("mock-visibility", "visible");
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(page.locator(".async-leaders .rl-podium-name")).toHaveText(["Anna", "Hanna", "Ben"]);
  await page.getByRole("link", { name: "Zur Übersicht" }).click();
  await expect(page.getByRole("heading", { name: "Deine Quizze" })).toBeVisible();
  const beforeLeaving = Number(await page.evaluate(() => sessionStorage.getItem("async-standings-requests")));
  await page.clock.runFor(20_000);
  expect(Number(await page.evaluate(() => sessionStorage.getItem("async-standings-requests")))).toBe(beforeLeaving);
});

test("Langsame Abfragen werden nicht parallel erneut gestartet", async ({ page }) => {
  await page.clock.install({ time: new Date("2030-01-01T12:00:00Z") });
  await mockAsync(page);
  await page.goto("/admin/async/p1");
  await expect(page.locator(".async-leaders .rl-podium-player")).toHaveCount(3);
  const initial = Number(await page.evaluate(() => sessionStorage.getItem("async-standings-requests")));
  await page.evaluate(() => sessionStorage.setItem("async-standings-delay", "15000"));
  await page.clock.runFor(10_000);
  await expect.poll(() => page.evaluate(() => Number(sessionStorage.getItem("async-standings-requests")))).toBe(initial + 1);
  await page.clock.runFor(10_000);
  expect(Number(await page.evaluate(() => sessionStorage.getItem("async-standings-requests")))).toBe(initial + 1);
  expect(Number(await page.evaluate(() => sessionStorage.getItem("async-max-concurrent")))).toBe(1);
  await page.clock.runFor(5_000);
  await expect(page.getByRole("button", { name: "Aktualisieren" })).toBeEnabled();
});

test("Bei Verbindungsrückkehr wird eine noch laufende fehlgeschlagene Abfrage sofort wiederholt", async ({ page }) => {
  await page.clock.install({ time: new Date("2030-01-01T12:00:00Z") });
  await mockAsync(page);
  await page.goto("/admin/async/p1");
  await expect(page.locator(".async-leaders .rl-podium-player")).toHaveCount(3);
  const initial = Number(await page.evaluate(() => sessionStorage.getItem("async-standings-requests")));
  await page.evaluate(() => {
    sessionStorage.setItem("async-standings-delay", "15000");
    sessionStorage.setItem("async-standings-fail", "1");
  });
  await page.clock.runFor(10_000);
  await expect.poll(() => page.evaluate(() => Number(sessionStorage.getItem("async-standings-requests")))).toBe(initial + 1);
  await page.clock.runFor(2_000);
  await page.evaluate(() => {
    window.dispatchEvent(new Event("offline"));
    sessionStorage.setItem("async-standings-delay", "0");
    window.dispatchEvent(new Event("online"));
  });
  await page.clock.runFor(13_000);
  await expect.poll(() => page.evaluate(() => Number(sessionStorage.getItem("async-standings-requests")))).toBe(initial + 2);
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("Veraltete Teilnehmerantworten werden bei parallelen Änderungen nicht als aktuell angezeigt", async ({ page }) => {
  await page.clock.install({ time: new Date("2030-01-01T12:00:00Z") });
  await mockAsync(page);
  await page.goto("/admin/async/p1");
  await expect(page.locator(".async-leaders .rl-podium-player")).toHaveCount(3);
  await page.evaluate(() => sessionStorage.setItem("async-detail-delay", "15000"));
  await page.getByText("Teilnehmerdetails", { exact: true }).click();
  const hanna = page.locator(".async-result-player").filter({ hasText: "Hanna" });
  await hanna.locator("summary").click();
  await page.evaluate(() => {
    sessionStorage.setItem("async-points", JSON.stringify([2900, 2900, 2400, 2100, 1800, 1200, 1000, 3300]));
    sessionStorage.setItem("async-answered", JSON.stringify([3, 3, 3, 3, 3, 3, 3, 2]));
  });
  await page.clock.runFor(10_000);
  await expect(page.locator(".async-leaders .rl-podium-name")).toHaveText(["Anna", "Hanna", "Ben"]);
  await expect(hanna).toContainText("Antwortdetails werden aktualisiert");
  await expect(hanna.locator("ol")).toHaveCount(0);
  await page.clock.runFor(20_000);
  await expect(hanna).toContainText("2 richtig");
  await expect(hanna.locator("ol li")).toHaveCount(3);
  await expect(hanna).toHaveAttribute("open", "");
});

test("Fehler beim Laden von Teilnehmerdetails sind sichtbar und können erneut versucht werden", async ({ page }) => {
  await mockAsync(page);
  await page.goto("/admin/async/p1");
  await page.evaluate(() => sessionStorage.setItem("async-detail-fail", "1"));
  await page.getByText("Teilnehmerdetails", { exact: true }).click();
  const details = page.locator(".async-admin-section").filter({ hasText: "Teilnehmerdetails" });
  await expect(details.getByRole("status").filter({ hasText: "Teilnehmerdetails konnten nicht aktualisiert werden" })).toBeVisible();
  await details.getByRole("button", { name: "Erneut versuchen" }).click();
  await expect(details.locator(".async-result-player").filter({ hasText: "Hanna" })).toContainText("1 richtig");
});

test("Ein Wechsel der Quizrunde setzt Rangliste, Filter und Teilnehmerdetails zurück", async ({ page }) => {
  const scores = Array.from({ length: 60 }, (_, index) => 5000 - index);
  await mockAsync(page, { scores });
  await page.goto("/admin/async/p1");
  await page.getByRole("button", { name: "Weitere Plätze anzeigen" }).click();
  await expect(page.locator(".async-leader-list > li")).toHaveCount(57);
  const details = page.locator(".async-admin-section").filter({ hasText: "Teilnehmerdetails" });
  await details.getByText("Teilnehmerdetails", { exact: true }).click();
  await details.getByLabel("Anzeigen").selectOption("PARTIAL");
  await expect(details.locator(".async-result-player")).toHaveCount(1);
  await expect.poll(() => page.evaluate(() => Number(sessionStorage.getItem("async-detail-requests")))).toBe(1);
  await page.evaluate(() => {
    window.history.pushState(null, "", "/admin/async/p2");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  await expect(page.locator(".async-leader-list > li")).toHaveCount(47);
  await expect(details).not.toHaveAttribute("open", "");
  await details.getByText("Teilnehmerdetails", { exact: true }).click();
  await expect(details.getByLabel("Anzeigen")).toHaveValue("ALL");
  await expect.poll(() => page.evaluate(() => Number(sessionStorage.getItem("async-detail-requests")))).toBe(2);
});

for (const viewport of [{ width: 1280, height: 720 }, { width: 1920, height: 1080 }]) {
  test(`Vollbild zeigt lesbares Podest und weitere Plätze ohne Überlauf bei ${viewport.width}×${viewport.height}`, async ({ page }) => {
    const scores = Array.from({ length: 35 }, (_, index) => 50_000 - index);
    const names = scores.map((_, index) => `${"LangerSpielname".repeat(5)} ${String(index + 1).padStart(3, "0")}`);
    const title = "W".repeat(120);
    await page.setViewportSize(viewport);
    await mockAsync(page, { scores, names, title });
    await page.goto("/admin/async/p1");
    await page.getByRole("button", { name: "Vollbild anzeigen" }).click();
    const stage = page.getByRole("region", { name: "Ergebnispräsentation" });
    await expect(stage).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.fullscreenElement?.classList.contains("async-presentation"))).toBe(true);
    await expect(stage.locator(".rl-podium-name")).toHaveText([names[1], names[0], names[2]]);
    await expect(stage.locator(".async-presentation-list li").first()).toBeVisible();
    await expect(stage.getByText("Fragenauswertung", { exact: true })).toHaveCount(0);
    await expect(stage.getByText("Teilnehmerdetails", { exact: true })).toHaveCount(0);
    await expect.poll(() => stage.locator(".async-presentation-list-area").evaluate((area) => area.scrollHeight <= area.clientHeight + 1)).toBe(true);
    const layout = await stage.evaluate((element) => {
      const name = element.querySelector<HTMLElement>(".async-presentation-name")!;
      const points = element.querySelector<HTMLElement>(".async-presentation-points")!;
      const row = name.closest("li")!.getBoundingClientRect();
      const range = document.createRange();
      range.selectNodeContents(name);
      const nameFits = [...range.getClientRects()].every((rect) =>
        rect.left >= row.left && rect.right <= row.right && rect.top >= row.top && rect.bottom <= row.bottom);
      const title = element.querySelector<HTMLElement>(".async-presentation-title")!;
      const titleBounds = title.getBoundingClientRect();
      range.selectNodeContents(title);
      const titleFits = [...range.getClientRects()].every((rect) =>
        rect.left >= titleBounds.left - 1 && rect.right <= titleBounds.right + 1);
      return { width: element.clientWidth, scrollWidth: element.scrollWidth, height: element.clientHeight,
        scrollHeight: element.scrollHeight, nameFont: parseFloat(getComputedStyle(name).fontSize),
        pointsFont: parseFloat(getComputedStyle(points).fontSize), nameFits, titleFits };
    });
    expect(layout.scrollWidth).toBeLessThanOrEqual(layout.width);
    expect(layout.scrollHeight).toBeLessThanOrEqual(layout.height);
    expect(layout.nameFont).toBeGreaterThanOrEqual(20);
    expect(layout.pointsFont).toBeGreaterThanOrEqual(20);
    expect(layout.nameFits, JSON.stringify(layout)).toBe(true);
    expect(layout.titleFits, JSON.stringify(layout)).toBe(true);
    await page.evaluate(() => document.exitFullscreen());
    await expect(stage).toBeHidden();
    await expect(page.getByRole("button", { name: "Vollbild anzeigen" })).toBeFocused();
  });
}

test("Vollbild blättert alle weiteren Plätze durch, bleibt beim Pausieren aktuell und kehrt zurück", async ({ page }) => {
  await page.clock.install({ time: new Date("2030-01-01T12:00:00Z") });
  const scores = Array.from({ length: 30 }, (_, index) => 5000 - index);
  const names = scores.map((_, index) => `Spieler ${String(index + 1).padStart(3, "0")}`);
  await page.setViewportSize({ width: 1280, height: 720 });
  await mockAsync(page, { scores, names });
  await page.goto("/admin/async/p1");
  await page.getByRole("button", { name: "Vollbild anzeigen" }).click();
  const stage = page.getByRole("region", { name: "Ergebnispräsentation" });
  const indicator = stage.locator(".async-presentation-controls > span");
  await expect(indicator).toContainText(/Seite 1 · Einträge 4–\d+ von 30/);
  const seen: string[] = [];
  for (let index = 0; index < names.length - 3 && seen.length < names.length - 3; index++) {
    await expect(indicator).toContainText(`Seite ${index + 1} ·`);
    seen.push(...await stage.locator(".async-presentation-name").allTextContents());
    if (seen.length < names.length - 3) await page.clock.runFor(8_000);
  }
  expect(seen).toEqual(names.slice(3));
  const lastPage = await indicator.innerText();
  await stage.getByRole("button", { name: "Seitenwechsel pausieren" }).click();
  await page.evaluate((next) => sessionStorage.setItem("async-points", JSON.stringify(next)),
    scores.map((score, index) => index === scores.length - 1 ? 6000 : score));
  await page.clock.runFor(24_000);
  await expect(indicator).toHaveText(lastPage);
  await expect(stage.locator(".rl-podium-name")).toHaveText([names[0], names.at(-1)!, names[1]]);
  await stage.getByRole("button", { name: "Seitenwechsel fortsetzen" }).click();
  await page.clock.runFor(8_000);
  await expect(indicator).toContainText("Seite 1 · Einträge 4–");
  await stage.getByRole("button", { name: "Vollbild beenden" }).click();
  await expect(stage).toBeHidden();
  await expect(page.getByText("Teilnehmerdetails", { exact: true })).toBeVisible();
});

test("Seitenrotation überspringt bei unterschiedlich hohen Namen keine Einträge", async ({ page }) => {
  await page.clock.install({ time: new Date("2030-01-01T12:00:00Z") });
  const scores = Array.from({ length: 42 }, (_, index) => 5000 - index);
  const names = scores.map((_, index) => index === 11 || index === 24 ?
    `${"W".repeat(75)}${String(index).padStart(3, "0")}` : `Spieler ${String(index + 1).padStart(3, "0")}`);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await mockAsync(page, { scores, names });
  await page.goto("/admin/async/p1");
  await page.getByRole("button", { name: "Vollbild anzeigen" }).click();
  const stage = page.getByRole("region", { name: "Ergebnispräsentation" });
  const indicator = stage.locator(".async-presentation-controls > span");
  await expect(indicator).toContainText("Seite 1 · Einträge 4–");
  const seen: string[] = [];
  for (let index = 0; index < names.length - 3 && seen.length < names.length - 3; index++) {
    await expect(indicator).toContainText(`Seite ${index + 1} ·`);
    await expect.poll(() => stage.locator(".async-presentation-list-area").evaluate((area) => area.scrollHeight <= area.clientHeight + 1)).toBe(true);
    seen.push(...await stage.locator(".async-presentation-name").allTextContents());
    if (seen.length < names.length - 3) await page.clock.runFor(8_000);
  }
  expect(seen).toEqual(names.slice(3));
});

test("Vollbild erreicht alle 250 Teilnehmenden ohne Duplikate oder Detailabfragen", async ({ page }) => {
  await page.clock.install({ time: new Date("2030-01-01T12:00:00Z") });
  const scores = Array.from({ length: 250 }, (_, index) => 5000 - index);
  const names = scores.map((_, index) => `Spieler ${String(index + 1).padStart(3, "0")}`);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await mockAsync(page, { scores, names });
  await page.goto("/admin/async/p1");
  await page.getByRole("button", { name: "Vollbild anzeigen" }).click();
  const stage = page.getByRole("region", { name: "Ergebnispräsentation" });
  const indicator = stage.locator(".async-presentation-controls > span");
  await expect(indicator).toContainText("Seite 1 · Einträge 4–");
  const seen: string[] = [];
  for (let index = 0; index < names.length - 3 && seen.length < names.length - 3; index++) {
    await expect(indicator).toContainText(`Seite ${index + 1} ·`);
    seen.push(...await stage.locator(".async-presentation-name").allTextContents());
    if (seen.length < names.length - 3) await page.clock.runFor(8_000);
  }
  expect(seen).toEqual(names.slice(3));
  expect(await page.evaluate(() => sessionStorage.getItem("async-detail-requests"))).toBeNull();
});

test("Neue Teilnehmende setzen die laufende Bildschirmseite nicht zurück", async ({ page }) => {
  await page.clock.install({ time: new Date("2030-01-01T12:00:00Z") });
  const scores = Array.from({ length: 30 }, (_, index) => 5000 - index);
  const names = scores.map((_, index) => `Spieler ${String(index + 1).padStart(3, "0")}`);
  await page.setViewportSize({ width: 1280, height: 720 });
  await mockAsync(page, { scores, names });
  await page.goto("/admin/async/p1");
  await page.getByRole("button", { name: "Vollbild anzeigen" }).click();
  const stage = page.getByRole("region", { name: "Ergebnispräsentation" });
  const indicator = stage.locator(".async-presentation-controls > span");
  await expect(indicator).toContainText("Seite 1 ·");
  await page.clock.runFor(8_000);
  await expect(indicator).toContainText("Seite 2 ·");
  await page.evaluate(({ nextScores, nextNames }) => {
    sessionStorage.setItem("async-points", JSON.stringify(nextScores));
    sessionStorage.setItem("async-names", JSON.stringify(nextNames));
  }, { nextScores: [...scores, 0], nextNames: [...names, "Neuer Spieler"] });
  await page.clock.runFor(2_000);
  await expect(indicator).toContainText("Seite 2 ·");
  await expect(indicator).toContainText("von 31");
  await page.clock.runFor(6_000);
  await expect(indicator).toContainText("Seite 3 ·");
});

test("Vollbild kennzeichnet einen alten Stand und aktualisiert nach einem Verbindungsfehler", async ({ page }) => {
  await page.clock.install({ time: new Date("2030-01-01T12:00:00Z") });
  await mockAsync(page);
  await page.goto("/admin/async/p1");
  await page.getByRole("button", { name: "Vollbild anzeigen" }).click();
  const stage = page.getByRole("region", { name: "Ergebnispräsentation" });
  await page.evaluate(() => {
    sessionStorage.setItem("async-standings-fail", "1");
    sessionStorage.setItem("async-points", JSON.stringify([2900, 2900, 2400, 2100, 1800, 1200, 1000, 3300]));
  });
  await page.clock.runFor(10_000);
  await expect(stage.getByRole("alert")).toContainText("Aktualisierung fehlgeschlagen");
  await expect(stage.locator(".rl-podium-name")).toHaveText(["Ben", "Anna", "Cem"]);
  await page.clock.runFor(10_000);
  await expect(stage.getByRole("alert")).toHaveCount(0);
  await expect(stage.locator(".rl-podium-name")).toHaveText(["Anna", "Hanna", "Ben"]);
});

test("Die Präsentation bleibt bei vergrößerter Schrift und schmalem Bildschirm erreichbar", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockAsync(page, { names: Array.from({ length: 8 }, (_, index) => `${"LangerSpielname".repeat(4)} ${index}`) });
  await page.goto("/admin/async/p1");
  await page.getByRole("button", { name: "Vollbild anzeigen" }).click();
  const stage = page.getByRole("region", { name: "Ergebnispräsentation" });
  await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
  await expect(stage.getByRole("button", { name: "Vollbild beenden" })).toBeVisible();
  await expect.poll(() => stage.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  expect(await stage.locator(".async-presentation-name").first().evaluate((element) =>
    parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(40);
});

test("Ohne Fullscreen-Unterstützung bleibt die Präsentation bedienbar und Escape kehrt zurück", async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(Document.prototype, "fullscreenEnabled", { get: () => false }));
  await mockAsync(page);
  await page.goto("/admin/async/p1");
  await page.getByRole("button", { name: "Vollbild anzeigen" }).click();
  const stage = page.getByRole("region", { name: "Ergebnispräsentation" });
  await expect(stage.getByRole("status")).toContainText("Vollbild wird von diesem Browser nicht unterstützt");
  await expect(stage.locator(".rl-podium-player")).toHaveCount(3);
  await page.keyboard.press("Escape");
  await expect(stage).toBeHidden();
  await expect(page.getByRole("button", { name: "Vollbild anzeigen" })).toBeFocused();
});

test("Eine abgelehnte Fullscreen-Anfrage erhält die bildschirmfüllende Präsentation", async ({ page }) => {
  await page.addInitScript(() => {
    Element.prototype.requestFullscreen = async () => { throw new Error("Fullscreen denied"); };
  });
  await mockAsync(page);
  await page.goto("/admin/async/p1");
  await page.getByRole("button", { name: "Vollbild anzeigen" }).click();
  const stage = page.getByRole("region", { name: "Ergebnispräsentation" });
  await expect(stage.getByRole("status")).toContainText("Vollbild konnte nicht gestartet werden");
  await expect(stage.locator(".rl-podium-player")).toHaveCount(3);
  await stage.getByRole("button", { name: "Zur Adminansicht" }).click();
  await expect(stage).toBeHidden();
});

test("Gamification: sofortige Auflösung, Rangaufstieg, Streak-Bonus und letzte Antwort bleiben getrennt vom Weiter-Schritt", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockAsync(page, { immediateReveal: true, streakBonusEnabled: true });
  await page.goto("/q/quiz-token");
  await page.getByRole("button", { name: "Quiz starten", exact: true }).click();
  await page.getByRole("button", { name: "Saturn", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Richtig!", exact: true })).toBeVisible();
  await expect(page.locator(".rl-score-award .rl-animated-points")).toHaveAttribute("aria-label", "1.500");
  await expect(page.locator(".async-pause .rl-celebration")).toHaveCount(1);
  await expect(page.locator(".async-pause")).toContainText("Saturn");
  await expect(page.locator(".async-question")).toHaveCount(0);
  await page.getByRole("button", { name: /Weiter zu Frage 2/ }).click();
  await page.getByRole("button", { name: "Acht", exact: true }).click();
  await expect(page.locator(".rl-rank-rise")).toContainText("2 Plätze gutgemacht");
  await page.getByRole("button", { name: /Weiter zu Frage 3/ }).click();
  await page.getByRole("button", { name: "Grün", exact: true }).click();
  await expect(page.locator(".rl-streak-bonus")).toContainText("+100");
  await expect(page.locator(".rl-badges")).toContainText("Dreier-Serie");
  await expect(page.locator(".result-total .rl-animated-points")).toHaveAttribute("aria-label", "4.600");
  await expect(page.getByRole("button", { name: "Zum persönlichen Abschluss" })).toBeVisible();
  await expect(page.locator(".async-question")).toHaveCount(0);
  await page.getByRole("button", { name: "Zum persönlichen Abschluss" }).click();
  await expect(page.locator(".rl-finale")).toContainText("Geschafft");
  await expect(page.locator(".async-own-results li")).toHaveCount(3);
  await expect(page.locator(".rl-badges")).toContainText("Perfekte Runde");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test("Gamification: verlorene Bestätigung stellt die Sofortauflösung wieder her, Reduced Motion zeigt echte Punkte ohne Partikel", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await mockAsync(page, { immediateReveal: true, streakBonusEnabled: true });
  await page.goto("/q/quiz-token");
  await page.getByRole("button", { name: "Quiz starten", exact: true }).click();
  await page.evaluate(() => sessionStorage.setItem("lose-confirmation", "1"));
  await page.getByRole("button", { name: "Saturn", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Richtig!", exact: true })).toBeVisible();
  await expect(page.locator(".rl-score-award .rl-animated-points")).toHaveText("1.500");
  await expect(page.locator(".async-pause .rl-celebration")).toHaveCount(0);
  await page.reload();
  await expect(page.locator(".rl-score-award .rl-animated-points")).toHaveText("1.500");
  await expect(page.locator(".rl-points-pop")).toHaveCount(0);
  expect(await page.evaluate(() => sessionStorage.getItem("submits"))).toBe("1");
});

test("Gamification: Veröffentlichungsoptionen haben unabhängige Defaults und werden an den Server übergeben", async ({ page }) => {
  await mockAsync(page);
  await page.goto("/admin/quizzes/quiz1/publish");
  const bonus = page.getByRole("checkbox", { name: "Streak-Bonuspunkte aktivieren" });
  const immediate = page.getByRole("checkbox", { name: "Sofortige Auflösung" });
  await expect(bonus).not.toBeChecked();
  await expect(immediate).toBeChecked();
  await bonus.check();
  await immediate.uncheck();
  await expect(page.getByText("Lösungen, Punkte, Serien und Abzeichen bleiben bis zum Rundenende verborgen.", { exact: true })).toBeVisible();
  const deadline = await page.evaluate(() => {
    const date = new Date(Date.now() + 86400000);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  });
  await page.getByLabel("Mitspielen bis (Datum und Uhrzeit)").fill(deadline);
  await page.getByRole("button", { name: "Quizrunde veröffentlichen", exact: true }).click();
  await expect(page.getByText("Veröffentlicht", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem("published-options")!)))
    .toEqual({ streakBonusEnabled: true, immediateReveal: false });
});

test("Gamification-Assets: gespeicherte Antworten ohne Sofortauflösung verraten kein Ergebnis", async ({ page }) => {
  await mockAsync(page);
  await page.goto("/q/token");
  await page.getByRole("button", { name: "Quiz starten" }).click();
  await expect(page.locator(".rl-speed-bonus svg")).toBeVisible();
  await page.getByRole("button", { name: /Saturn/ }).click();
  await expect(page.getByRole("heading", { name: "Antwort gespeichert" })).toBeVisible();
  await expect(page.locator(".async-pause .async-moment-saved")).toBeVisible();
  await expect(page.locator(".async-pause .rl-answer.is-correct, .async-pause .rl-answer.is-wrong, .rl-score-award, .rl-achievements, .result-total")).toHaveCount(0);
  await page.reload();
  await expect(page.locator(".async-pause .async-moment-ready")).toBeVisible();
  await expect(page.locator(".rl-score-award, .rl-achievements, .rl-celebration")).toHaveCount(0);
  await page.getByRole("button", { name: "Weiter zu Frage 2" }).click();
  await page.getByRole("button", { name: /Acht/ }).click();
  await page.getByRole("button", { name: "Weiter zu Frage 3" }).click();
  await page.getByRole("button", { name: /Grün/ }).click();
  await expect(page.getByRole("heading", { name: "Quiz abgeschlossen" })).toBeVisible();
  await expect(page.locator(".rl-finale .rl-llama-proud")).toBeVisible();
  await expect(page.locator(".async-own-total, .async-own-results, .rl-achievements, .rl-celebration")).toHaveCount(0);
});

test("Gamification-Assets: unbekannte Ergebnisse zeigen weder falsche Lösungen noch einen unbestätigten Sieg", async ({ page }) => {
  await mockAsync(page, { immediateReveal: true, questions: [{ text: "Welche Antwort stimmt?", answers: ["Nein", "Ja"] }] });
  await page.goto("/q/token");
  await page.getByRole("button", { name: "Quiz starten" }).click();
  await page.evaluate(() => {
    sessionStorage.setItem("async-unknown-result", "1");
    sessionStorage.setItem("async-guest-rank", "1");
  });
  await page.getByRole("button", { name: "Ja", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Antwort gespeichert" })).toBeVisible();
  await expect(page.locator(".async-pause .async-moment-saved")).toBeVisible();
  await expect(page.locator(".async-pause .rl-answer.is-correct, .async-pause .rl-answer.is-wrong, .rl-score-award, .rl-achievements")).toHaveCount(0);
  await page.getByRole("button", { name: "Zum persönlichen Abschluss" }).click();
  await expect(page.locator(".rl-finale .rl-llama-proud")).toBeVisible();
  await expect(page.getByText("Dein Ergebnis ist noch nicht vollständig verfügbar.")).toBeVisible();
  await expect(page.locator(".async-own-total, .async-own-results, .rl-achievements, .rl-celebration")).toHaveCount(0);
  await page.evaluate(() => sessionStorage.setItem("async-guest-status", "ENDED"));
  await page.reload();
  await expect(page.locator(".rl-finale .rl-llama-proud")).toBeVisible();
  await expect(page.locator(".rl-finale .rl-llama-cheering, .rl-celebration")).toHaveCount(0);
  await page.evaluate(() => sessionStorage.removeItem("async-unknown-result"));
  await page.reload();
  await expect(page.locator(".rl-finale .rl-llama-cheering")).toBeVisible();
  await expect(page.locator(".rl-celebration, .rl-finale.is-celebrating")).toHaveCount(0);
});

test("Gamification-Assets: vorläufiger Rang eins bleibt Teilnahme, erst ein bestätigter Endrang ist ein Sieg", async ({ page }) => {
  await mockAsync(page, { immediateReveal: true, questions: [{ text: "Welche Antwort stimmt?", answers: ["Nein", "Ja"] }] });
  await page.goto("/q/token");
  await page.getByRole("button", { name: "Quiz starten" }).click();
  await page.evaluate(() => {
    sessionStorage.setItem("async-guest-rank", "1");
    sessionStorage.setItem("lose-confirmation", "1");
  });
  await page.getByRole("button", { name: "Ja", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Richtig!" })).toBeVisible();
  await expect(page.locator(".async-pause .async-moment.is-correct .rl-llama-cheering")).toBeVisible();
  await page.getByRole("button", { name: "Zum persönlichen Abschluss" }).click();
  await expect(page.getByText("Vorläufig: Platz", { exact: false })).toBeVisible();
  await expect(page.locator(".rl-finale .rl-llama-proud")).toBeVisible();
  await expect(page.locator(".rl-finale .rl-celebration")).toHaveCount(1);
  await page.reload();
  await expect(page.locator(".rl-finale .rl-llama-proud")).toBeVisible();
  await expect(page.locator(".rl-celebration, .rl-finale.is-celebrating")).toHaveCount(0);
  await page.evaluate(() => sessionStorage.setItem("async-guest-status", "ENDED"));
  await page.reload();
  await expect(page.locator(".rl-finale .rl-llama-cheering")).toBeVisible();
  await expect(page.locator(".rl-celebration, .rl-finale.is-celebrating")).toHaveCount(0);
  await page.evaluate(() => sessionStorage.setItem("async-guest-rank", "2"));
  await page.reload();
  await expect(page.locator(".rl-finale .rl-llama-proud")).toBeVisible();
});

test("Gamification-Assets: unvollständige Teilnahme erhält keine Abschluss- oder Siegerfeier", async ({ page }) => {
  await mockAsync(page, { immediateReveal: true });
  await page.goto("/q/token");
  await page.getByRole("button", { name: "Quiz starten" }).click();
  await page.getByRole("button", { name: /Saturn/ }).click();
  await expect(page.getByRole("heading", { name: "Richtig!" })).toBeVisible();
  await page.evaluate(() => {
    sessionStorage.setItem("async-guest-rank", "1");
    sessionStorage.setItem("async-guest-status", "ENDED");
  });
  await page.reload();
  await expect(page.getByRole("heading", { name: "Quiz beendet" })).toBeVisible();
  await expect(page.getByText("Nicht beantwortete Fragen zählen als 0 Punkte.", { exact: false })).toBeVisible();
  await expect(page.locator(".rl-finale, .rl-celebration")).toHaveCount(0);
});

test("Gamification-Assets: Verbindungsfehler und falsche Antwort zeigen keine Punktefeier", async ({ page }) => {
  await mockAsync(page, { immediateReveal: true });
  await page.goto("/q/token");
  await page.getByRole("button", { name: "Quiz starten" }).click();
  await page.evaluate(() => sessionStorage.setItem("submit-fail", "1"));
  await page.getByRole("button", { name: /Saturn/ }).click();
  await expect(page.getByText(/Antwort nicht bestätigt: Netzwerkfehler/)).toBeVisible();
  await expect(page.locator(".answer-feedback svg")).toBeVisible();
  await expect(page.locator(".rl-score-award, .rl-celebration, .rl-finale")).toHaveCount(0);
  await page.getByRole("button", { name: /Mars/ }).click();
  await expect(page.getByRole("heading", { name: "Leider daneben" })).toBeVisible();
  await expect(page.locator(".async-pause .rl-answer.is-wrong")).toContainText("Mars");
  await expect(page.locator(".async-pause .rl-answer.is-correct")).toContainText("Saturn");
  await expect(page.locator(".async-pause .async-moment.is-wrong .rl-llama-surprised")).toBeVisible();
  await expect(page.locator(".async-pause .rl-encouragement")).toBeVisible();
  await expect(page.locator(".rl-score-award .rl-animated-points")).toHaveAttribute("aria-label", "0");
  await expect(page.locator(".rl-celebration, .rl-points-pop")).toHaveCount(0);
});

test("Gamification-Assets: eine falsche letzte Antwort löst keine Siegerfeier aus", async ({ page }) => {
  await mockAsync(page, { immediateReveal: true, questions: [{ text: "Welche Antwort stimmt?", answers: ["Nein", "Ja"] }] });
  await page.goto("/q/token");
  await page.getByRole("button", { name: "Quiz starten" }).click();
  await page.evaluate(() => sessionStorage.setItem("async-guest-rank", "1"));
  await page.getByRole("button", { name: "Nein", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Leider daneben" })).toBeVisible();
  await page.getByRole("button", { name: "Zum persönlichen Abschluss" }).click();
  await expect(page.locator(".rl-finale .rl-llama-proud")).toBeVisible();
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await expect(page.locator(".rl-celebration, .rl-finale.is-celebrating")).toHaveCount(0);
});

test("Gamification-Assets: Serien und Abzeichen funktionieren ohne aktivierten Bonus", async ({ page }) => {
  await mockAsync(page, { immediateReveal: true });
  await page.goto("/q/token");
  await page.getByRole("button", { name: "Quiz starten" }).click();
  await page.getByRole("button", { name: /Saturn/ }).click();
  await page.getByRole("button", { name: "Weiter zu Frage 2" }).click();
  await page.getByRole("button", { name: /Acht/ }).click();
  await page.getByRole("button", { name: "Weiter zu Frage 3" }).click();
  await page.getByRole("button", { name: /Grün/ }).click();
  await expect(page.locator(".result-total .rl-animated-points")).toHaveAttribute("aria-label", "4.500");
  await expect(page.locator(".rl-badges li").filter({ hasText: "Dreier-Serie" }).locator("svg")).toBeVisible();
  await expect(page.locator(".rl-achievements.is-on-fire .rl-achievements-flame")).toBeVisible();
  await expect(page.locator(".rl-streak-bonus")).toHaveCount(0);
});

for (const width of [320, 390, 430]) {
  test(`Gamification-Assets: Link-Quiz-Auflösung passt bei ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await mockAsync(page, { immediateReveal: true });
    await page.goto("/q/token");
    await page.getByRole("button", { name: "Quiz starten" }).click();
    await page.getByRole("button", { name: /Saturn/ }).click();
    await expect(page.locator(".async-pause .async-moment.is-correct .rl-llama-cheering")).toBeVisible();
    await expect(page.locator(".async-pause .rl-answer.is-correct")).toBeVisible();
    await expect(page.locator(".rl-score-award .rl-score-award-star")).toBeVisible();
    // Illustrations are inline SVG now – the old PNG/SVG gamification assets must not be loaded anymore.
    await expect(page.locator('img[src*="/assets/gamification/"]')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.screenshot({ path: test.info().outputPath(`gamification-async-${width}.png`), animations: "disabled" });
  });
}

test("Gamification-Assets: Admin-Endstand feiert den Übergang, spätere Vollbildansicht und Reload nicht", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await mockAsync(page, { scores: Array.from({ length: 35 }, (_, index) => index < 2 ? 5000 : 5000 - index) });
  await page.goto("/admin/async/p1");
  await expect(page.locator(".async-leaders .rl-podium-player.is-rank-1 .rl-podium-crown")).toHaveCount(2);
  await page.evaluate(() => sessionStorage.setItem("async-status", "ENDED"));
  await page.getByRole("button", { name: "Aktualisieren", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Endstand", exact: true })).toBeVisible();
  await expect(page.locator(".rl-finale .rl-llama-proud")).toBeVisible();
  await expect(page.locator(".rl-finale")).toContainText("gemeinsam zu feiern");
  await expect(page.locator(".rl-finale .rl-celebration")).toHaveCount(1);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Endstand", exact: true })).toBeVisible();
  await expect(page.locator(".rl-celebration, .rl-finale.is-celebrating")).toHaveCount(0);
  await page.getByRole("button", { name: "Vollbild anzeigen" }).click();
  const stage = page.getByRole("region", { name: "Ergebnispräsentation" });
  await expect(stage.locator(".rl-finale .rl-llama-proud")).toBeVisible();
  await expect(stage.locator(".rl-podium-player.is-rank-1 .rl-podium-crown")).toHaveCount(2);
  await expect(stage.locator(".rl-celebration, .rl-finale.is-celebrating")).toHaveCount(0);
  await expect.poll(() => stage.locator(".async-presentation-list-area").evaluate((area) => area.scrollHeight <= area.clientHeight + 1)).toBe(true);
  const bounds = await stage.evaluate((element) => ({ width: element.clientWidth, scrollWidth: element.scrollWidth,
    height: element.clientHeight, scrollHeight: element.scrollHeight }));
  expect(bounds.scrollWidth).toBeLessThanOrEqual(bounds.width);
  expect(bounds.scrollHeight).toBeLessThanOrEqual(bounds.height);
  await page.screenshot({ path: test.info().outputPath("gamification-async-final-1920.png"), animations: "disabled" });
});

test("Gamification-Assets: ein während der Vollbildansicht eintreffendes Finale feiert nur dort einmal", async ({ page }) => {
  await page.clock.install({ time: new Date("2030-01-01T12:00:00Z") });
  await mockAsync(page);
  await page.goto("/admin/async/p1");
  await page.getByRole("button", { name: "Vollbild anzeigen" }).click();
  const stage = page.getByRole("region", { name: "Ergebnispräsentation" });
  await page.evaluate(() => sessionStorage.setItem("async-status", "ENDED"));
  await page.clock.runFor(10_000);
  await expect(stage.getByRole("heading", { name: "Endstand" })).toBeVisible();
  await expect(stage.locator(".rl-finale .rl-celebration")).toHaveCount(1);
  await stage.getByRole("button", { name: "Vollbild beenden" }).click();
  await expect(stage).toBeHidden();
  await expect(page.locator(".rl-celebration, .rl-finale.is-celebrating")).toHaveCount(0);
  await page.getByRole("button", { name: "Vollbild anzeigen" }).click();
  await expect(stage.locator(".rl-finale")).toBeVisible();
  await expect(stage.locator(".rl-celebration, .rl-finale.is-celebrating")).toHaveCount(0);
});

test("Gamification-Assets: ein während eines Verbindungsfehlers verpasstes Finale wird nicht nachgefeiert", async ({ page }) => {
  await mockAsync(page);
  await page.goto("/admin/async/p1");
  await page.evaluate(() => sessionStorage.setItem("async-standings-fail", "1"));
  await page.getByRole("button", { name: "Aktualisieren", exact: true }).click();
  await expect(page.getByText(/Aktualisierung fehlgeschlagen: Netzwerkfehler/)).toBeVisible();
  await page.evaluate(() => sessionStorage.setItem("async-status", "ENDED"));
  await page.getByRole("button", { name: "Aktualisieren", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Endstand", exact: true })).toBeVisible();
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await expect(page.locator(".rl-celebration, .rl-finale.is-celebrating")).toHaveCount(0);
});

test("Gamification-Assets: Reduced Motion lässt das Vollbildfinale ohne bewegte Elemente lesbar", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await mockAsync(page, { status: "ENDED" });
  await page.goto("/admin/async/p1");
  await page.getByRole("button", { name: "Vollbild anzeigen" }).click();
  const stage = page.getByRole("region", { name: "Ergebnispräsentation" });
  await expect(stage.locator(".rl-finale .rl-llama-proud")).toBeVisible();
  await expect(stage.locator(".rl-podium-player.is-rank-1 .rl-podium-crown")).toHaveCount(2);
  await expect(stage.locator(".rl-celebration")).toHaveCount(0);
  await expect.poll(() => stage.locator(".rl-podium-player").evaluateAll((players) =>
    players.every((player) => getComputedStyle(player).transform === "none"))).toBe(true);
  expect(await stage.locator(".rl-finale, .rl-podium-crown").evaluateAll((elements) =>
    elements.every((element) => getComputedStyle(element).animationName === "none"))).toBe(true);
});
