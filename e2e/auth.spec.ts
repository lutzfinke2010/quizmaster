import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/src/cloud.ts", (route) => route.fulfill({
    contentType: "application/javascript",
    body: `
      import { Amplify } from "/node_modules/.vite/deps/aws-amplify.js";
      export async function configureCloud() {
        Amplify.configure({ Auth: { Cognito: { userPoolId: "eu-central-1_testpool", userPoolClientId: "testclient" } } });
        return true;
      }
      async function list(name) {
        const calls = JSON.parse(localStorage.getItem("test-cloud-calls") || "[]");
        calls.push(name); localStorage.setItem("test-cloud-calls", JSON.stringify(calls));
        return [];
      }
      export const cloud = { listQuizzes: () => list("listQuizzes"), listSessions: () => list("listSessions") };
    `,
  }));
  await page.route(/\/node_modules\/\.vite\/deps\/aws-amplify_auth\.js/, (route) => route.fulfill({
    contentType: "application/javascript",
    body: `
      function record(name, details) {
        const calls = JSON.parse(localStorage.getItem("test-auth-calls") || "[]");
        calls.push({ name, ...details }); localStorage.setItem("test-auth-calls", JSON.stringify(calls));
      }
      function fail(name) { throw Object.assign(new Error("Provider details"), { name }); }
      export async function fetchAuthSession(options = {}) {
        record("session", options);
        if (localStorage.getItem("test-refresh-error")) fail("NetworkError");
        if (options.forceRefresh && localStorage.getItem("test-approved")) localStorage.setItem("test-access", "authorized");
        const access = localStorage.getItem("test-access");
        return access ? { tokens: { idToken: { payload: access === "authorized" ? { "cognito:groups": ["Quizmasters"] } : {} } } } : {};
      }
      export async function signUp(input) {
        record("signUp", { username: input.username, attributes: input.options.userAttributes });
        return { nextStep: { signUpStep: "CONFIRM_SIGN_UP" } };
      }
      export async function confirmSignUp(input) {
        record("confirm", { username: input.username });
        if (input.confirmationCode === "000000") fail("CodeMismatchException");
        if (input.confirmationCode === "999999") fail("ExpiredCodeException");
        return { nextStep: { signUpStep: "DONE" } };
      }
      export async function resendSignUpCode(input) { record("resend", { username: input.username }); }
      export async function signIn(input) {
        record("signIn", { username: input.username });
        const challenge = localStorage.getItem("test-challenge");
        if (challenge) return { isSignedIn: false, nextStep: { signInStep: challenge } };
        localStorage.setItem("test-access", "pending");
        return { isSignedIn: true, nextStep: { signInStep: "DONE" } };
      }
      export async function confirmSignIn() {
        record("newPassword"); localStorage.setItem("test-access", "authorized");
        return { isSignedIn: true, nextStep: { signInStep: "DONE" } };
      }
      export async function signOut() { record("signOut"); localStorage.removeItem("test-access"); }
    `,
  }));
});

test("Registrierung, E-Mail-Bestätigung und manuelle Rollenfreigabe", async ({ page }) => {
  await page.goto("/admin");
  await page.getByRole("button", { name: "Konto anlegen", exact: true }).click();
  await page.getByLabel("E-Mail-Adresse", { exact: true }).fill("new@example.invalid");
  await page.getByLabel("Passwort", { exact: true }).fill("short");
  await page.getByRole("button", { name: "Konto anlegen", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Mindestens 8");
  await page.getByLabel("Passwort", { exact: true }).fill("TestPassword!123");
  await page.getByRole("button", { name: "Konto anlegen", exact: true }).click();
  await expect(page.getByRole("heading", { name: "E-Mail-Adresse bestätigen" })).toBeVisible();
  await page.getByLabel("Bestätigungscode").fill("000000");
  await page.getByRole("button", { name: "E-Mail bestätigen", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("ungültig");
  await page.getByLabel("Bestätigungscode").fill("999999");
  await page.getByRole("button", { name: "E-Mail bestätigen", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("abgelaufen");
  await page.getByRole("button", { name: "Code erneut senden" }).click();
  await expect(page.getByRole("status")).toContainText("neuer Bestätigungscode");
  await page.getByLabel("Bestätigungscode").fill("123456");
  await page.getByRole("button", { name: "E-Mail bestätigen", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Quizmaster-Anmeldung" })).toBeVisible();
  await expect(page.getByLabel("Passwort", { exact: true })).toBeEmpty();
  await page.getByLabel("Passwort", { exact: true }).fill("TestPassword!123");
  await page.getByRole("button", { name: "Anmelden", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Freigabe ausstehend" })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("test-cloud-calls"))).toBeNull();
  await expect(page.getByRole("link", { name: "Neues Quiz" })).toHaveCount(0);
  await page.evaluate(() => localStorage.setItem("test-approved", "true"));
  await page.getByRole("button", { name: "Zugriff erneut prüfen" }).click();
  await expect(page.getByRole("heading", { name: "Deine Quizze" })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("test-auth-calls") || "[]")))
    .toContainEqual({ name: "session", forceRefresh: true });
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("test-auth-calls") || "[]")))
    .toContainEqual({ name: "signUp", username: "new@example.invalid", attributes: { email: "new@example.invalid" } });
});

test("Unbestätigte Anmeldung lässt sich nach Neuladen fortsetzen", async ({ page }) => {
  await page.goto("/admin");
  await page.evaluate(() => localStorage.setItem("test-challenge", "CONFIRM_SIGN_UP"));
  await page.getByLabel("E-Mail-Adresse", { exact: true }).fill("unconfirmed@example.invalid");
  await page.getByLabel("Passwort", { exact: true }).fill("TestPassword!123");
  await page.getByRole("button", { name: "Anmelden", exact: true }).click();
  await expect(page.getByRole("heading", { name: "E-Mail-Adresse bestätigen" })).toBeVisible();
  await expect(page.getByLabel("E-Mail-Adresse", { exact: true })).toHaveValue("unconfirmed@example.invalid");
  await page.reload();
  await page.getByRole("button", { name: "E-Mail-Bestätigung fortsetzen" }).click();
  await page.getByLabel("E-Mail-Adresse", { exact: true }).fill("unconfirmed@example.invalid");
  await page.getByRole("button", { name: "Code erneut senden" }).click();
  await expect(page.getByRole("status")).toContainText("neuer Bestätigungscode");
  await page.getByLabel("Bestätigungscode").fill("123456");
  await page.getByRole("button", { name: "E-Mail bestätigen", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Quizmaster-Anmeldung" })).toBeVisible();
});

test("Administrativ angelegte Konten können ihr temporäres Passwort ändern", async ({ page }) => {
  await page.goto("/admin");
  await page.evaluate(() => localStorage.setItem("test-challenge", "CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED"));
  await page.getByLabel("E-Mail-Adresse", { exact: true }).fill("invited@example.invalid");
  await page.getByLabel("Passwort", { exact: true }).fill("Temporary!123");
  await page.getByRole("button", { name: "Anmelden", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Neues Passwort setzen" })).toBeVisible();
  await page.getByLabel("Neues Passwort", { exact: true }).fill("NewPassword!123");
  await page.getByRole("button", { name: "Passwort setzen", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Deine Quizze" })).toBeVisible();
});

test("Fehlgeschlagene Rollenaktualisierung gibt keine Inhalte frei und Abmelden bleibt möglich", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.setItem("test-access", "pending"));
  await page.goto("/admin/quizzes/new");
  await expect(page.getByRole("heading", { name: "Freigabe ausstehend" })).toBeVisible();
  await page.evaluate(() => localStorage.setItem("test-refresh-error", "true"));
  await page.getByRole("button", { name: "Zugriff erneut prüfen" }).click();
  await expect(page.getByRole("alert")).toContainText("fehlgeschlagen");
  await expect(page.getByRole("heading", { name: "Freigabe ausstehend" })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("test-cloud-calls"))).toBeNull();
  await page.getByRole("button", { name: "Abmelden", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Quizmaster-Anmeldung" })).toBeVisible();
});

test("Fehler nach erfolgreichem Login bleiben durch erneute Prüfung oder Abmelden behebbar", async ({ page }) => {
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Quizmaster-Anmeldung" })).toBeVisible();
  await page.evaluate(() => localStorage.setItem("test-refresh-error", "true"));
  await page.getByLabel("E-Mail-Adresse", { exact: true }).fill("pending@example.invalid");
  await page.getByLabel("Passwort", { exact: true }).fill("TestPassword!123");
  await page.getByRole("button", { name: "Anmelden", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Anmeldung prüfen" })).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("fehlgeschlagen");
  expect(await page.evaluate(() => localStorage.getItem("test-cloud-calls"))).toBeNull();
  await page.evaluate(() => localStorage.removeItem("test-refresh-error"));
  await page.getByRole("button", { name: "Zugriff erneut prüfen" }).click();
  await expect(page.getByRole("heading", { name: "Freigabe ausstehend" })).toBeVisible();
  await page.getByRole("button", { name: "Abmelden", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Quizmaster-Anmeldung" })).toBeVisible();
});

test("Anmeldung und Registrierung bleiben auf kleinen Handys vollständig bedienbar", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Quizmaster-Anmeldung" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await page.screenshot({ path: test.info().outputPath("login.png"), fullPage: true });
  await page.getByRole("button", { name: "Konto anlegen", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Quizmaster-Konto anlegen" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await page.getByLabel("E-Mail-Adresse", { exact: true }).fill("new@example.invalid");
  await page.getByLabel("Passwort", { exact: true }).fill("TestPassword!123");
  await page.getByRole("button", { name: "Konto anlegen", exact: true }).click();
  await expect(page.getByRole("heading", { name: "E-Mail-Adresse bestätigen" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});
