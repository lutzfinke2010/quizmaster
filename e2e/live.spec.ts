import { randomBytes, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { copyFile, mkdir, readFile, unlink } from "node:fs/promises";
import {
  AdminAddUserToGroupCommand, AdminConfirmSignUpCommand, AdminCreateUserCommand, AdminDeleteUserCommand,
  AdminGetUserCommand, AdminListGroupsForUserCommand, AdminSetUserPasswordCommand, CognitoIdentityProviderClient,
} from "@aws-sdk/client-cognito-identity-provider";
import { expect, test } from "@playwright/test";

test.skip(!process.env.QUIZRUSH_LIVE_OUTPUTS, "QUIZRUSH_LIVE_OUTPUTS muss auf die isolierte Sandbox-Konfiguration zeigen.");
test.describe.configure({ mode: "serial" });
test.setTimeout(180_000);

let username = "";
let outsiderUsername = "";
let otherAdminUsername = "";
let registrationUsername = "";
let password = "";
let userPoolId = "";
let client: CognitoIdentityProviderClient;
let outputsCopied = false;

test.beforeAll(async () => {
  const outputsPath = process.env.QUIZRUSH_LIVE_OUTPUTS;
  if (!outputsPath) throw new Error("Sandbox-Konfiguration fehlt.");
  const outputs: { auth: { user_pool_id: string; aws_region: string } } = JSON.parse(await readFile(outputsPath, "utf8"));
  userPoolId = outputs.auth.user_pool_id;
  username = `quizrush-test-${randomUUID()}@example.invalid`;
  outsiderUsername = `quizrush-unprivileged-${randomUUID()}@example.invalid`;
  otherAdminUsername = `quizrush-other-admin-${randomUUID()}@example.invalid`;
  registrationUsername = `quizrush-signup-${randomUUID()}@example.invalid`;
  password = `A1!b${randomBytes(18).toString("base64url")}`;
  client = new CognitoIdentityProviderClient({ region: outputs.auth.aws_region });
  await mkdir("public", { recursive: true });
  await copyFile(outputsPath, "public/amplify_outputs.json", constants.COPYFILE_EXCL);
  outputsCopied = true;
  for (const [user, quizmaster] of [[username, true], [outsiderUsername, false], [otherAdminUsername, true]] as const) {
    await client.send(new AdminCreateUserCommand({ UserPoolId: userPoolId, Username: user,
      MessageAction: "SUPPRESS", UserAttributes: [{ Name: "email", Value: user }, { Name: "email_verified", Value: "true" }] }));
    await client.send(new AdminSetUserPasswordCommand({ UserPoolId: userPoolId, Username: user, Password: password, Permanent: true }));
    if (quizmaster) await client.send(new AdminAddUserToGroupCommand({ UserPoolId: userPoolId, Username: user, GroupName: "Quizmasters" }));
  }
});

test.afterAll(async () => {
  try {
    if (client) {
      for (const user of [username, outsiderUsername, otherAdminUsername, registrationUsername].filter(Boolean)) {
        try { await client.send(new AdminDeleteUserCommand({ UserPoolId: userPoolId, Username: user })); }
        catch (error) { if (!(error instanceof Error && error.name === "UserNotFoundException")) throw error; }
      }
    }
  } finally {
    if (outputsCopied) await unlink("public/amplify_outputs.json");
  }
});

test("Selbst registriertes Konto erhält erst nach manueller Gruppenzuweisung Zugriff", async ({ page }) => {
  await page.goto("/admin");
  await page.getByRole("button", { name: "Konto anlegen", exact: true }).click();
  await page.getByLabel("E-Mail-Adresse", { exact: true }).fill(registrationUsername);
  await page.getByLabel("Passwort", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Konto anlegen", exact: true }).click();
  await expect(page.getByRole("heading", { name: "E-Mail-Adresse bestätigen" })).toBeVisible({ timeout: 20_000 });
  expect((await client.send(new AdminGetUserCommand({ UserPoolId: userPoolId, Username: registrationUsername }))).UserStatus)
    .toBe("UNCONFIRMED");
  expect((await client.send(new AdminListGroupsForUserCommand({ UserPoolId: userPoolId, Username: registrationUsername }))).Groups)
    .toEqual([]);
  await client.send(new AdminConfirmSignUpCommand({ UserPoolId: userPoolId, Username: registrationUsername }));
  await page.getByRole("button", { name: "Zur Anmeldung", exact: true }).click();
  await page.getByLabel("Passwort", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Anmelden", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Freigabe ausstehend" })).toBeVisible({ timeout: 20_000 });
  expect(await page.evaluate(async () => {
    const path = "/src/cloud.ts";
    const module = await import(/* @vite-ignore */ path);
    try { await module.cloud.listQuizzes(); return false; } catch { return true; }
  })).toBe(true);
  await client.send(new AdminAddUserToGroupCommand({
    UserPoolId: userPoolId, Username: registrationUsername, GroupName: "Quizmasters",
  }));
  await page.getByRole("button", { name: "Zugriff erneut prüfen" }).click();
  await expect(page.getByRole("heading", { name: "Deine Quizze" })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("button", { name: "Beispielquiz hinzufügen" })).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("Zwei Gäste spielen zwei Fragen mit automatischer Auswertung", async ({ browser, page }) => {
  await page.goto("/admin");
  await page.getByLabel("E-Mail-Adresse").fill(username);
  await page.getByLabel("Passwort").fill(password);
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page.getByRole("heading", { name: "Deine Quizze" })).toBeVisible();
  await page.getByRole("link", { name: "Neues Quiz" }).click();
  await page.getByLabel("Quiztitel").fill(`Sandbox ${randomUUID()}`);
  await page.getByLabel("Fragetext").first().fill("Welche Antwort ist richtig?");
  await page.getByLabel("Antwort 1 bei Frage 1", { exact: true }).fill("Die erste");
  await page.getByLabel("Antwort 2 bei Frage 1", { exact: true }).fill("Die zweite");
  await page.getByLabel("Antwort 1 bei Frage 1 ist richtig").check();
  await page.getByLabel("Antwortzeit in Sekunden").first().fill("25");
  await page.getByRole("button", { name: "Frage hinzufügen" }).click();
  await page.getByLabel("Fragetext").nth(1).fill("Welche Zahl ist gerade?");
  await page.getByLabel("Antwort 1 bei Frage 2", { exact: true }).fill("Zwei");
  await page.getByLabel("Antwort 2 bei Frage 2", { exact: true }).fill("Drei");
  await page.getByLabel("Antwort 1 bei Frage 2 ist richtig").check();
  await page.getByLabel("Antwortzeit in Sekunden").nth(1).fill("25");
  await page.getByRole("button", { name: "Quiz speichern" }).click();
  await expect(page.getByRole("button", { name: "Sitzung erstellen" })).toBeVisible();
  await page.getByRole("button", { name: "Sitzung erstellen" }).click();
  await expect(page.getByRole("button", { name: "Erste Frage starten" })).toBeVisible();
  const code = (await page.locator(".rl-join-code-digits").innerText()).replace(/\s/g, "");
  expect(code).toMatch(/^\d{6}$/);
  const spacedCode = `${code.slice(0, 3)} ${code.slice(3)}`;
  const sessionUrl = page.url();

  const first = await browser.newContext();
  const second = await browser.newContext();
  const outsider = await browser.newContext();
  const presentation = await browser.newContext();
  const otherAdmin = await browser.newContext();
  const noRole = await browser.newContext();
  try {
    const player1 = await first.newPage();
    const player2 = await second.newPage();
    await player1.goto(`/join/${code}`);
    await player2.goto("/join");
    await player2.getByLabel("Quiz-Code").fill(code);
    await player1.getByRole("button", { name: "Los geht’s" }).click();
    await player2.getByRole("button", { name: "Los geht’s" }).click();
    await expect(player1).toHaveURL(/\/play\//);
    await expect(player2).toHaveURL(/\/play\//);
    await expect(page.getByText("2 Teilnehmende")).toBeVisible({ timeout: 30_000 });
    const presentationPath = await page.getByRole("link", { name: /Präsentationsansicht öffnen/ }).getAttribute("href");
    if (!presentationPath) throw new Error("Präsentationslink fehlt.");
    const sameBrowserDisplay = await page.context().newPage();
    await sameBrowserDisplay.goto(presentationPath);
    await expect(sameBrowserDisplay.locator(".rl-live-join-code")).toHaveText(spacedCode);
    await sameBrowserDisplay.close();
    const display = await presentation.newPage();
    await display.goto(presentationPath);
    await expect(display.locator(".rl-live-join-code")).toHaveText(spacedCode);
    await expect(display.getByText("2 Teilnehmende")).toBeVisible({ timeout: 30_000 });
    await expect(display.getByRole("button", { name: "Erste Frage starten" })).toHaveCount(0);
    const intruder = await outsider.newPage();
    await intruder.goto("/");
    const sessionId = new URL(sessionUrl).pathname.split("/").pop();
    if (!sessionId) throw new Error("Sitzungs-ID fehlt.");
    const security = await intruder.evaluate(async (id) => {
      const path = "/src/cloud.ts";
      const module = await import(/* @vite-ignore */ path);
      let stateRejected = false;
      let publishRejected = false;
      let forgedIdRejected = false;
      let controlRejected = false;
      try { await module.cloud.gameState(id, "guest"); } catch { stateRejected = true; }
      try {
        await module.client.graphql({
          query: "mutation Publish($sessionId: ID!) { publishGameEvent(sessionId: $sessionId, version: 999) { sessionId version } }",
          variables: { sessionId: id }, authMode: "identityPool",
        });
      } catch { publishRejected = true; }
      try {
        await module.client.graphql({ query: "mutation Forged($sessionId: ID!) { submitAnswer(sessionId: $sessionId, questionId: \"q\", choiceId: \"a\", participantId: \"forged\") { acceptedAt } }",
          variables: { sessionId: id }, authMode: "identityPool" });
      } catch { forgedIdRejected = true; }
      try {
        await module.client.graphql({ query: "mutation Control($sessionId: ID!) { cancelSession(sessionId: $sessionId, expectedVersion: 1) { version } }",
          variables: { sessionId: id }, authMode: "identityPool" });
      } catch { controlRejected = true; }
      const subscription = await new Promise<string>((resolve) => {
        const timer = setTimeout(() => resolve("timeout"), 10_000);
        const sub = module.cloud.subscribe(id, "guest", null,
          () => { clearTimeout(timer); resolve("event"); },
          () => { clearTimeout(timer); resolve("rejected"); });
        setTimeout(() => sub.unsubscribe(), 11_000);
      });
      return { stateRejected, publishRejected, forgedIdRejected, controlRejected, subscription };
    }, sessionId);
    expect(security).toEqual({ stateRejected: true, publishRejected: true, forgedIdRejected: true,
      controlRejected: true, subscription: "rejected" });
    const other = await otherAdmin.newPage();
    await other.goto("/admin");
    await other.getByLabel("E-Mail-Adresse").fill(otherAdminUsername);
    await other.getByLabel("Passwort").fill(password);
    await other.getByRole("button", { name: "Anmelden" }).click();
    await expect(other.getByRole("heading", { name: "Deine Quizze" })).toBeVisible();
    const foreign = await other.evaluate(async (id) => {
      const path = "/src/cloud.ts";
      const module = await import(/* @vite-ignore */ path);
      let stateRejected = false;
      try { await module.cloud.gameState(id, "admin"); } catch { stateRejected = true; }
      const subscription = await new Promise<string>((resolve) => {
        const timer = setTimeout(() => resolve("timeout"), 10_000);
        const sub = module.cloud.subscribe(id, "admin", null,
          () => { clearTimeout(timer); resolve("event"); },
          () => { clearTimeout(timer); resolve("rejected"); });
        setTimeout(() => sub.unsubscribe(), 11_000);
      });
      return { stateRejected, subscription };
    }, sessionId);
    expect(foreign).toEqual({ stateRejected: true, subscription: "rejected" });
    const unprivileged = await noRole.newPage();
    await unprivileged.goto("/admin");
    await unprivileged.getByLabel("E-Mail-Adresse").fill(outsiderUsername);
    await unprivileged.getByLabel("Passwort").fill(password);
    await unprivileged.getByRole("button", { name: "Anmelden" }).click();
    await expect(unprivileged.getByRole("heading", { name: "Freigabe ausstehend" })).toBeVisible();
    await expect(unprivileged.getByRole("link", { name: "Neues Quiz" })).toHaveCount(0);
    expect(await unprivileged.evaluate(async () => {
      const path = "/src/cloud.ts";
      const module = await import(/* @vite-ignore */ path);
      try { await module.cloud.listQuizzes(); return false; } catch { return true; }
    })).toBe(true);
    await page.getByRole("button", { name: "Erste Frage starten" }).click();
    await expect(player1.getByRole("button", { name: /Die erste/ })).toBeEnabled({ timeout: 30_000 });
    const early = await player1.evaluate(async (id) => {
      const path = "/src/cloud.ts";
      const module = await import(/* @vite-ignore */ path);
      const state = await module.cloud.gameState(id, "guest");
      let resultRejected = false;
      let leaderboardRejected = false;
      let solutionFieldRejected = false;
      try { await module.cloud.result(id); } catch { resultRejected = true; }
      try {
        await module.client.graphql({ query: "query Board($sessionId: ID!) { getLeaderboard(sessionId: $sessionId) { points } }",
          variables: { sessionId: id }, authMode: "identityPool" });
      } catch { leaderboardRejected = true; }
      try {
        await module.client.graphql({ query: "query Secret($sessionId: ID!) { getGameState(sessionId: $sessionId) { question { answers { correct } } } }",
          variables: { sessionId: id }, authMode: "identityPool" });
      } catch { solutionFieldRejected = true; }
      return { reveal: state.reveal, leaderboard: state.leaderboard, resultRejected, leaderboardRejected, solutionFieldRejected };
    }, sessionId);
    expect(early).toEqual({ reveal: null, leaderboard: [], resultRejected: true, leaderboardRejected: true, solutionFieldRejected: true });
    await player1.getByRole("button", { name: /Die zweite/ }).click();
    await expect(player1.getByRole("button", { name: /Die zweite/ })).toHaveClass(/is-selected/);
    await player1.getByRole("button", { name: /Die erste/ }).click();
    await expect(player1.getByRole("button", { name: /Die erste/ })).toHaveClass(/is-selected/);
    await expect(player1.locator(".rl-live-progress")).toContainText("1 von 2");
    await player2.waitForTimeout(1500);
    await player2.getByRole("button", { name: /Die erste/ }).click();
    await expect(player2.getByText("Antwort ist drin", { exact: true })).toBeVisible();
    await player1.reload();
    await expect(player1.getByText("Antwort ist drin", { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(player1.getByRole("button", { name: /Die erste/ })).toHaveAttribute("aria-pressed", "true");
    await expect(player1.getByRole("button", { name: /Die zweite/ })).toBeEnabled();
    await expect(player1.locator(".rl-live-progress")).toContainText("2 von 2");
    await page.close();
    await expect(player1.getByRole("heading", { name: "Auflösung" })).toBeVisible({ timeout: 40_000 });
    await expect(player2.getByRole("heading", { name: "Auflösung" })).toBeVisible({ timeout: 40_000 });
    await expect(display.getByRole("heading", { name: "Auflösung", exact: true })).toBeVisible({ timeout: 30_000 });
    await expect(display.locator(".rl-live-ranking")).toHaveCount(0);
    const admin = await page.context().newPage();
    await admin.goto(sessionUrl);
    await admin.getByRole("button", { name: "Zwischenstand anzeigen" }).click();
    await expect(player1.getByRole("heading", { name: "Zwischenstand", exact: true })).toBeVisible({ timeout: 30_000 });
    await expect(display.locator(".rl-podium-player")).toHaveCount(2);
    await expect(player1.locator(".rl-leaderboard li").first()).toContainText("(du)");
    const points = await player1.locator(".rl-leaderboard .rl-leaderboard-points").allTextContents();
    expect(Number(points[0].replace(/\D/g, ""))).toBeGreaterThan(Number(points[1].replace(/\D/g, "")));
    await admin.getByRole("button", { name: "Nächste Frage starten" }).click();
    await expect(player1.getByRole("button", { name: /Zwei/ })).toBeEnabled({ timeout: 30_000 });
    await player1.getByRole("button", { name: /Zwei/ }).click();
    await player2.getByRole("button", { name: /Drei/ }).click();
    await expect(player1.getByRole("heading", { name: "Auflösung" })).toBeVisible({ timeout: 40_000 });
    await admin.getByRole("button", { name: "Zwischenstand anzeigen" }).click();
    await admin.getByRole("button", { name: "Endstand anzeigen" }).click();
    await expect(player1.getByRole("heading", { name: "Endstand", exact: true })).toBeVisible({ timeout: 30_000 });
    await expect(player1.locator(".rl-leaderboard li").first()).toContainText("(du)");
  } finally {
    await first.close();
    await second.close();
    await outsider.close();
    await presentation.close();
    await otherAdmin.close();
    await noRole.close();
  }
});
