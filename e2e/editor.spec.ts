import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/amplify_outputs.json", (route) => route.fulfill({ status: 404 }));
});

test("Beispielquiz kann gespeichert, dupliziert und bearbeitet werden", async ({ page }) => {
  await page.goto("/admin");
  await expect(page.getByText("Lokaler Entwurfsmodus:")).toBeVisible();
  await page.getByRole("button", { name: "Beispielquiz verwenden" }).click();
  await expect(page.getByRole("heading", { name: "Frage 10" })).toBeVisible();
  await page.getByLabel("Quiztitel").fill("Meine Quizrunde");
  await page.getByRole("button", { name: "Entwurf speichern" }).click();
  await expect(page.getByRole("heading", { name: "Meine Quizrunde" })).toBeVisible();
  await page.getByRole("button", { name: "Meine Quizrunde duplizieren" }).click();
  await expect(page.getByRole("heading", { name: "Meine Quizrunde" })).toHaveCount(2);
  await page.reload();
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
  await page.getByRole("button", { name: "Entwurf speichern" }).click();
  await expect(page.getByRole("heading", { name: "Mobilquiz" })).toBeVisible();
  await page.getByRole("link", { name: "Bearbeiten" }).click();
  await expect(page.getByLabel("Fragetext").first()).toHaveValue("Zweite Frage?");
  await expect(page.getByLabel("Antwort 1 bei Frage 1 ist richtig")).toBeChecked();
});
