import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/amplify_outputs.json", (route) => route.fulfill({ status: 404 }));
});

test("Beispielquiz kann gespeichert, dupliziert und bearbeitet werden", async ({ page }) => {
  await page.goto("/admin");
  await expect(page.getByText("Lokaler Entwurfsmodus:")).toBeVisible();
  await page.getByLabel("Gespeicherte Entwürfe anzeigen und lokale Speicherung aktivieren").check();
  await page.getByRole("button", { name: "Beispielquiz verwenden" }).click();
  await expect(page.getByRole("heading", { name: "Frage 10" })).toBeVisible();
  await page.getByLabel("Quiztitel").fill("Meine Quizrunde");
  await page.getByRole("button", { name: "Entwurf speichern" }).click();
  await expect(page.getByRole("heading", { name: "Meine Quizrunde" })).toBeVisible();
  await page.getByRole("button", { name: "Meine Quizrunde duplizieren" }).click();
  await expect(page.getByRole("heading", { name: "Meine Quizrunde" })).toHaveCount(2);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Meine Quizrunde" })).toHaveCount(0);
  await page.getByLabel("Gespeicherte Entwürfe anzeigen und lokale Speicherung aktivieren").check();
  await expect(page.getByRole("heading", { name: "Meine Quizrunde" })).toHaveCount(2);
});

test("Ein unvollständiges Quiz kann nicht gespeichert werden", async ({ page }) => {
  await page.goto("/admin/quizzes/new");
  await page.getByRole("button", { name: "Entwurf speichern" }).click();
  await expect(page.getByText("Bitte ausfüllen.").first()).toBeVisible();
  await expect(page.getByText("Bitte genau eine richtige Antwort auswählen.")).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/quizzes\/new$/);
});

test("Zwei Fragen lassen sich mobil anlegen und umsortieren", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/admin/quizzes/new");
  await page.getByLabel("Quiztitel").fill("Mobilquiz");
  await page.getByLabel("Fragetext").first().fill("Erste Frage?");
  await page.getByLabel("Antwort 1 bei Frage 1", { exact: true }).fill("Richtig");
  await page.getByLabel("Antwort 2 bei Frage 1", { exact: true }).fill("Falsch");
  await page.getByLabel("Antwort 1 bei Frage 1 ist richtig").check();
  await page.getByRole("button", { name: "Frage hinzufügen" }).click();
  await page.getByLabel("Fragetext").nth(1).fill("Zweite Frage?");
  await page.getByLabel("Antwort 1 bei Frage 2", { exact: true }).fill("Ja");
  await page.getByLabel("Antwort 2 bei Frage 2", { exact: true }).fill("Nein");
  await page.getByLabel("Antwort 2 bei Frage 2 ist richtig").check();
  await page.getByRole("button", { name: "Frage 2 nach oben" }).click();
  await expect(page.getByLabel("Fragetext").first()).toHaveValue("Zweite Frage?");
  await expect(page.getByLabel("Antwort 2 bei Frage 1 ist richtig")).toBeChecked();
  await page.getByRole("button", { name: "Antwort 2 nach oben" }).first().click();
  await expect(page.getByLabel("Antwort 1 bei Frage 1", { exact: true })).toHaveValue("Nein");
  await expect(page.getByLabel("Antwort 1 bei Frage 1 ist richtig")).toBeChecked();
  await page.getByLabel("Quiz-Entwürfe auf diesem Gerät speichern").check();
  await page.getByRole("button", { name: "Entwurf speichern" }).click();
  await expect(page.getByRole("heading", { name: "Mobilquiz" })).toBeVisible();
  await page.getByRole("link", { name: "Bearbeiten" }).click();
  await expect(page.getByLabel("Fragetext").first()).toHaveValue("Zweite Frage?");
  await expect(page.getByLabel("Antwort 1 bei Frage 1 ist richtig")).toBeChecked();
});

test("Neue Quizentwürfe bleiben bis zur Aktivierung im Arbeitsspeicher", async ({ page }) => {
  await page.goto("/admin/quizzes/new");
  await page.getByLabel("Quiztitel").fill("Nur im Arbeitsspeicher");
  await page.getByLabel("Fragetext").first().fill("Welche Antwort stimmt?");
  await page.getByLabel("Antwort 1 bei Frage 1", { exact: true }).fill("Diese");
  await page.getByLabel("Antwort 2 bei Frage 1", { exact: true }).fill("Jene");
  await page.getByLabel("Antwort 1 bei Frage 1 ist richtig").check();
  await page.getByRole("button", { name: "Entwurf speichern" }).click();
  await expect(page.getByRole("alert")).toContainText("Aktiviere zuerst die lokale Speicherfunktion");
  expect(await page.evaluate(() => localStorage.getItem("quizrush.local-drafts.v1"))).toBeNull();
  await expect(page).toHaveURL(/\/admin\/quizzes\/new$/);

  await page.getByLabel("Quiz-Entwürfe auf diesem Gerät speichern").check();
  await page.getByRole("button", { name: "Entwurf speichern" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  expect(await page.evaluate(() => localStorage.getItem("quizrush.local-drafts.v1"))).toContain("Nur im Arbeitsspeicher");
});

test("Vorhandene Entwürfe bleiben bis zur Aktivierung unberührt und werden gezielt gelöscht", async ({ page }) => {
  const legacyDrafts = JSON.stringify([{
    id: "8a34ca08-f209-495a-8da8-97d79fd3d3cc",
    quiz: {
      title: "Vorhandener Entwurf", description: "",
      questions: [{ text: "Frage?", durationSeconds: 20, explanation: "",
        answers: [{ text: "Ja", correct: true }, { text: "Nein", correct: false }] }],
    },
  }]);
  await page.addInitScript(({ drafts }) => {
    localStorage.setItem("quizrush.local-drafts.v1", drafts);
    localStorage.setItem("unrelated-app-data", "keep");
  }, { drafts: legacyDrafts });
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Vorhandener Entwurf" })).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("quizrush.local-drafts.v1"))).toBe(legacyDrafts);

  const storageToggle = page.getByLabel("Gespeicherte Entwürfe anzeigen und lokale Speicherung aktivieren");
  await storageToggle.check();
  await expect(page.getByRole("heading", { name: "Vorhandener Entwurf" })).toBeVisible();
  await storageToggle.uncheck();
  expect(await page.evaluate(() => localStorage.getItem("quizrush.local-drafts.v1"))).toBe(legacyDrafts);
  await storageToggle.check();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Alle lokalen Entwürfe löschen" }).click();
  await expect(page.getByRole("status")).toContainText("Alle lokalen Quiz-Entwürfe wurden gelöscht");
  expect(await page.evaluate(() => localStorage.getItem("quizrush.local-drafts.v1"))).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem("unrelated-app-data"))).toBe("keep");
});

test("Ungespeicherte Änderungen warnen vor interner Navigation", async ({ page }) => {
  await page.goto("/admin/quizzes/new");
  await page.getByLabel("Quiztitel").fill("Noch nicht gespeichert");
  let warning = "";
  page.once("dialog", async (dialog) => {
    warning = dialog.message();
    await dialog.dismiss();
  });
  await page.getByRole("link", { name: "Zur Übersicht" }).click();
  expect(warning).toContain("Deine Änderungen sind noch nicht gespeichert");
  await expect(page).toHaveURL(/\/admin\/quizzes\/new$/);
});
