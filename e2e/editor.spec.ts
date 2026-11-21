import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/amplify_outputs.json", (route) => route.fulfill({ status: 404 }));
});

test("Beispielquiz kann gespeichert, dupliziert und bearbeitet werden", async ({ page }) => {
  await page.goto("/admin");
  await expect(page.getByText("Lokaler Entwurfsmodus:")).toBeVisible();
  await page.getByLabel("Gespeicherte Entwürfe anzeigen und lokale Speicherung aktivieren").check();
  await page.getByRole("button", { name: "Beispielquiz verwenden" }).click();
  await page.getByLabel("Quiztitel").fill("Meine Quizrunde");
  await page.getByRole("button", { name: "Weiter" }).click();
  await expect(page.getByRole("heading", { name: "Frage 10" })).toBeVisible();
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
  await page.getByRole("button", { name: "Weiter" }).click();
  await expect(page.getByText("Bitte ausfüllen.").first()).toBeVisible();
  await expect(page.getByLabel("Quiztitel")).toBeFocused();
  await page.getByLabel("Quiztitel").fill("Halbfertig");
  await page.getByRole("button", { name: "Weiter" }).click();
  await page.getByRole("button", { name: "Entwurf speichern" }).click();
  await expect(page.getByText("Bitte ausfüllen.").first()).toBeVisible();
  await expect(page.getByText("Bitte genau eine richtige Antwort auswählen.")).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/quizzes\/new$/);

  await page.getByRole("button", { name: "Grundlagen" }).click();
  await page.getByLabel("Quiztitel").clear();
  await page.getByRole("button", { name: "Fragen" }).click();
  await page.getByRole("button", { name: "Entwurf speichern" }).click();
  await expect(page.getByLabel("Quiztitel")).toBeFocused();
  await expect(page).toHaveURL(/\/admin\/quizzes\/new$/);
});

test("Zwei Fragen lassen sich mobil anlegen und umsortieren", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/admin/quizzes/new");
  await page.getByLabel("Quiztitel").fill("Mobilquiz");
  await page.getByRole("button", { name: "Weiter" }).click();
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
  await expect(page.getByLabel("Quiztitel")).toHaveValue("Mobilquiz");
  await page.getByRole("button", { name: "Weiter" }).click();
  await expect(page.getByLabel("Fragetext").first()).toHaveValue("Zweite Frage?");
  await expect(page.getByLabel("Antwort 1 bei Frage 1 ist richtig")).toBeChecked();
});

test("Neue Quizentwürfe bleiben bis zur Aktivierung im Arbeitsspeicher", async ({ page }) => {
  await page.goto("/admin/quizzes/new");
  await page.getByLabel("Quiztitel").fill("Nur im Arbeitsspeicher");
  await page.getByRole("button", { name: "Weiter" }).click();
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
  await page.getByRole("button", { name: "Alle lokalen Entwürfe löschen" }).click();
  const dialog = page.getByRole("alertdialog", { name: "Alle Entwürfe löschen?" });
  await expect(dialog).toContainText("endgültig gelöscht");
  await dialog.getByRole("button", { name: "Abbrechen" }).click();
  expect(await page.evaluate(() => localStorage.getItem("quizrush.local-drafts.v1"))).toBe(legacyDrafts);
  await page.getByRole("button", { name: "Alle lokalen Entwürfe löschen" }).click();
  await dialog.getByRole("button", { name: "Alle Entwürfe löschen" }).click();
  await expect(page.getByRole("status")).toContainText("Alle lokalen Quiz-Entwürfe wurden gelöscht");
  expect(await page.evaluate(() => localStorage.getItem("quizrush.local-drafts.v1"))).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem("unrelated-app-data"))).toBe("keep");
});

test("Ungespeicherte Änderungen warnen vor interner Navigation", async ({ page }) => {
  await page.goto("/admin/quizzes/new");
  await page.getByLabel("Quiztitel").fill("Noch nicht gespeichert");
  const back = page.getByRole("link", { name: "Zur Übersicht" });
  await back.click();
  const dialog = page.getByRole("alertdialog", { name: "Änderungen verwerfen?" });
  await expect(dialog).toContainText("Deine Änderungen sind noch nicht gespeichert");
  await expect(dialog.getByRole("button", { name: "Abbrechen" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(back).toBeFocused();
  await expect(page.getByLabel("Quiztitel")).toHaveValue("Noch nicht gespeichert");
  await expect(page).toHaveURL(/\/admin\/quizzes\/new$/);
  await back.click();
  await dialog.getByRole("button", { name: "Änderungen verwerfen" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("main")).toBeFocused();
});

for (const width of [320, 1440]) {
  test(`Löschdialog ist responsiv, hält den Fokus und löscht erst nach Bestätigung (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 720 });
    if (width === 320) await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/admin");
    await page.getByLabel("Gespeicherte Entwürfe anzeigen und lokale Speicherung aktivieren").check();
    await page.getByRole("button", { name: "Beispielquiz verwenden" }).click();
    const title = "Ein langer Quiztitel für unsere gemeinsame Feierabendrunde mit Freunden";
    await page.getByLabel("Quiztitel").fill(title);
    await page.getByRole("button", { name: "Weiter" }).click();
    await page.getByRole("button", { name: "Entwurf speichern" }).click();
    const trigger = page.getByRole("button", { name: `${title} löschen` });
    await trigger.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("alertdialog", { name: "Entwurf löschen?" });
    const cancel = dialog.getByRole("button", { name: "Abbrechen" });
    const confirm = dialog.getByRole("button", { name: "Entwurf löschen" });
    await expect(dialog).toContainText(title);
    await expect(cancel).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(confirm).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(cancel).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(confirm).toBeFocused();
    await page.mouse.click(4, 4);
    await expect(dialog).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem("quizrush.local-drafts.v1"))).toContain(title);
    const box = await dialog.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(720);
    await page.screenshot({ path: test.info().outputPath(`confirm-delete-${width}.png`), animations: "disabled" });
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await trigger.click();
    await confirm.click();
    await expect(page.getByRole("heading", { name: title })).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem("quizrush.local-drafts.v1"))).toBe("[]");
    await expect(page.getByRole("main")).toBeFocused();
  });
}

test("Neuladen behält den nativen Schutz ungespeicherter lokaler Änderungen", async ({ page }) => {
  await page.goto("/admin/quizzes/new");
  await page.getByLabel("Quiztitel").fill("Noch nicht gespeichert");
  const warning = page.waitForEvent("dialog");
  page.once("dialog", (dialog) => dialog.accept());
  await page.reload();
  expect((await warning).type()).toBe("beforeunload");
  await expect(page.getByLabel("Quiztitel")).toHaveValue("");
});

test("Kategorie wird gespeichert und die Detailseite zeigt Fragen und Aktionen", async ({ page }) => {
  await page.goto("/admin");
  await page.getByLabel("Gespeicherte Entwürfe anzeigen und lokale Speicherung aktivieren").check();
  await page.getByRole("link", { name: "Neues Quiz" }).first().click();
  await page.getByLabel("Quiztitel").fill("Tierquiz");
  await page.getByLabel("Kategorie").selectOption({ label: "Tiere & Natur" });
  await page.getByRole("button", { name: "Weiter" }).click();
  await page.getByLabel("Fragetext").first().fill("Welches Tier summt?");
  await page.getByLabel("Antwort 1 bei Frage 1", { exact: true }).fill("Biene");
  await page.getByLabel("Antwort 2 bei Frage 1", { exact: true }).fill("Fisch");
  await page.getByLabel("Antwort 1 bei Frage 1 ist richtig").check();
  await page.getByRole("button", { name: "Entwurf speichern" }).click();
  await expect(page).toHaveURL(/\/admin$/);

  await page.getByRole("link", { name: "Tierquiz" }).click();
  await expect(page).toHaveURL(/\/admin\/quizzes\/[^/]+$/);
  await expect(page.getByRole("heading", { level: 1, name: "Tierquiz" })).toBeVisible();
  await expect(page.getByText("Tiere & Natur", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Fragen im Überblick" })).toBeVisible();
  await expect(page.getByText("Biene (richtige Antwort)")).toBeVisible();
  const original = page.url();

  await page.getByRole("button", { name: "Duplizieren" }).click();
  await expect(page).not.toHaveURL(original);
  await expect(page.getByRole("heading", { level: 1, name: "Tierquiz" })).toBeVisible();
  await page.getByRole("link", { name: "Bearbeiten" }).click();
  await expect(page.getByLabel("Kategorie")).toHaveValue("tiere-natur");
  await page.goBack();

  await page.getByRole("button", { name: "Löschen" }).click();
  const dialog = page.getByRole("alertdialog", { name: "Entwurf löschen?" });
  await dialog.getByRole("button", { name: "Entwurf löschen" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { name: "Tierquiz" })).toHaveCount(1);
});
