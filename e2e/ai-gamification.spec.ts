import { expect, test } from "@playwright/test";

test("Ein KI-Quiz kann geprüft, mit Gamification veröffentlicht und live gestartet werden", async ({ page }) => {
  await page.route("**/src/ui/admin/AdminGate.tsx", (route) => route.fulfill({
    contentType: "application/javascript", body: "export function AdminGate({children}) { return children; }",
  }));
  await page.route("**/src/cloud.ts", (route) => route.fulfill({
    contentType: "application/javascript",
    body: `
      const generatedQuiz = {
        title: "Weltraumquiz", description: "Fragen über Planeten",
        questions: [{
          text: "Welcher Planet hat Ringe?",
          answers: [{ text: "Saturn", correct: true }, { text: "Mars", correct: false }],
          durationSeconds: 20, explanation: "Saturn besitzt auffällige Ringe."
        }]
      };
      let savedQuiz = null;
      export async function configureCloud() { return true; }
      export const client = {};
      export const cloud = {
        listQuizzes: async () => savedQuiz ? [{
          quizId: "quiz1", version: 1, updatedAt: Date.now(), title: savedQuiz.title,
          description: savedQuiz.description, questionCount: savedQuiz.questions.length
        }] : [],
        listSessions: async () => [],
        listAsyncPublications: async () => [],
        startQuizGeneration: async (request) => {
          sessionStorage.setItem("generation-request", JSON.stringify(request));
          return { jobId: "job1", status: "PENDING", createdAt: Date.now(), quiz: null, error: null };
        },
        getQuizGeneration: async () => ({
          jobId: "job1", status: "SUCCEEDED", createdAt: Date.now(), quiz: generatedQuiz, error: null
        }),
        createQuiz: async (quiz) => {
          savedQuiz = quiz;
          sessionStorage.setItem("generated-quiz", JSON.stringify(quiz));
          return { quizId: "quiz1", version: 1, updatedAt: Date.now(), quiz };
        },
        getQuiz: async () => ({ quizId: "quiz1", version: 1, updatedAt: Date.now(), quiz: savedQuiz }),
        publishAsyncQuiz: async (quizId, requestId, expiresAt, timeZone, streakBonusEnabled, immediateReveal) => {
          sessionStorage.setItem("async-options", JSON.stringify({ quizId, streakBonusEnabled, immediateReveal }));
          return { publicationId: "publication1", token: "token1", joinCode: "654321",
            expiresAt, timeZone, retentionDays: 30, maxParticipants: 250 };
        },
        createSession: async (quizId, streakBonusEnabled) => {
          sessionStorage.setItem("live-options", JSON.stringify({ quizId, streakBonusEnabled }));
          return { sessionId: "session1", joinCode: "123456", presentationToken: "presentation" };
        },
        getSession: async () => ({
          sessionId: "session1", title: savedQuiz.title, status: "LOBBY", joinCode: "123456",
          presentationToken: "presentation", createdAt: Date.now()
        }),
        questions: async () => [{ questionId: "q1", index: 0, text: savedQuiz.questions[0].text }],
        gameState: async () => ({
          sessionId: "session1", status: "LOBBY", version: 1, title: savedQuiz.title,
          questionIndex: -1, questionCount: 1, participantCount: 0, answerCount: 0,
          eligibleParticipantCount: 0, serverTime: Date.now(), participants: [], leaderboard: [],
          streakBonusEnabled: true
        }),
        subscribe: () => ({ unsubscribe() {} })
      };
    `,
  }));

  await page.goto("/admin");
  await page.getByRole("link", { name: "Quiz mit KI erstellen" }).click();
  await page.getByLabel("Quiztitel").fill("Weltraumquiz");
  await page.getByLabel("Thema").fill("Planeten");
  await page.getByLabel("Anzahl Fragen").fill("1");
  await page.getByLabel("Antwortmöglichkeiten pro Frage").fill("2");
  await page.getByRole("button", { name: "Quiz erstellen lassen" }).click();
  await expect(page.getByRole("status")).toContainText("Die KI schreibt deine Fragen");
  await expect(page).toHaveURL(/\/admin\/quizzes\/new$/);
  await expect(page.getByText("Dieser Entwurf wurde von einer KI erstellt.")).toBeVisible();
  await expect(page.getByLabel("Quiztitel")).toHaveValue("Weltraumquiz");
  await expect(page.getByLabel("Fragetext")).toHaveValue("Welcher Planet hat Ringe?");
  await expect(page.getByLabel("Antwort 1 bei Frage 1 ist richtig")).toBeChecked();
  await page.getByLabel("Fragetext").fill("Welcher Planet besitzt auffällige Ringe?");
  await page.getByRole("button", { name: "Quiz speichern" }).click();
  await expect(page).toHaveURL(/\/admin$/);

  expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem("generation-request")!)))
    .toMatchObject({ title: "Weltraumquiz", topic: "Planeten", questionCount: 1, answerCount: 2 });
  expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem("generated-quiz")!).questions[0].text))
    .toBe("Welcher Planet besitzt auffällige Ringe?");

  await page.getByRole("link", { name: "Quizrunde veröffentlichen" }).click();
  await page.getByRole("checkbox", { name: "Streak-Bonuspunkte aktivieren" }).check();
  await expect(page.getByRole("checkbox", { name: "Sofortige Auflösung" })).toBeChecked();
  const deadline = await page.evaluate(() => {
    const date = new Date(Date.now() + 2 * 86_400_000);
    date.setHours(12, 0, 0, 0);
    const pad = (value: number) => String(value).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  });
  await page.getByLabel("Mitspielen bis (Datum und Uhrzeit)").fill(deadline);
  await page.getByRole("button", { name: "Quizrunde veröffentlichen", exact: true }).click();
  await expect(page.getByText("Veröffentlicht", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem("async-options")!)))
    .toEqual({ quizId: "quiz1", streakBonusEnabled: true, immediateReveal: true });
  await page.getByRole("link", { name: "Zur Übersicht und Ergebnisverwaltung" }).click();

  const card = page.locator("article.card").filter({ hasText: "Weltraumquiz" });
  await card.getByText("Live-Spielregeln").click();
  const bonus = card.getByRole("checkbox", { name: "Streak-Bonuspunkte aktivieren" });
  await expect(bonus).not.toBeChecked();
  await bonus.check();
  await card.getByRole("button", { name: "Live-Quiz starten" }).click();
  await expect(page).toHaveURL(/\/admin\/sessions\/session1$/);
  await expect(page.getByText(/Ab 3 richtigen Antworten in Folge: \+100 Punkte/)).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem("live-options")!)))
    .toEqual({ quizId: "quiz1", streakBonusEnabled: true });
});
