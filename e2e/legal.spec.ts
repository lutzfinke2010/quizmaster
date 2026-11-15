import { expect, test, type Page } from "@playwright/test";

async function cloudMode(page: Page) {
  await page.route("**/src/cloud.ts", (route) => route.fulfill({
    contentType: "application/javascript",
    body: `
      import { Amplify } from "/node_modules/.vite/deps/aws-amplify.js";
      export async function configureCloud() {
        Amplify.configure({ Auth: { Cognito: { userPoolId: "eu-central-1_testpool", userPoolClientId: "testclient" } } });
        return true;
      }
      export const cloud = new Proxy({}, { get() { throw new Error("Cloud-Aufruf ohne Nutzeraktion"); } });
    `,
  }));
}
async function localMode(page: Page) {
  await page.route("**/amplify_outputs.json", (route) => route.fulfill({ status: 404 }));
}

for (const [name, setup] of [["lokal", localMode], ["Cloud", cloudMode]] as const) {
  test.describe(`Rechtliche Seiten (${name})`, () => {
    test.beforeEach(async ({ page }) => { await setup(page); });

    test("Impressum und Datenschutzerklärung sind direkt aufrufbar und im Footer verlinkt", async ({ page }) => {
      await page.goto("/impressum");
      await expect(page.getByRole("heading", { name: "Impressum", level: 1 })).toBeVisible();
      await expect(page.getByText("Lutz Finke").first()).toBeVisible();
      await expect(page.getByText("91097 Oberreichenbach")).toBeVisible();
      await expect(page.getByRole("note")).toHaveCount(0);
      await page.getByRole("contentinfo").getByRole("link", { name: "Datenschutzerklärung" }).click();
      await expect(page).toHaveURL(/\/datenschutz$/);
      await expect(page.getByRole("heading", { name: "Datenschutzerklärung", level: 1 })).toBeVisible();
      await expect(page.getByText("Es werden keine Cookies", { exact: false })).toHaveCount(0);
      await page.reload();
      await expect(page.getByRole("heading", { name: "Verantwortlicher" })).toBeVisible();
      await page.getByRole("contentinfo").getByRole("link", { name: "Impressum" }).click();
      await expect(page).toHaveURL(/\/impressum$/);
    });

    test("Footer-Links stehen auf der Startseite und bei unbekannten Seiten", async ({ page }) => {
      for (const path of ["/", "/gibt-es-nicht"]) {
        await page.goto(path);
        const footer = page.getByRole("contentinfo");
        await expect(footer.getByRole("link", { name: "Impressum" })).toBeVisible();
        await expect(footer.getByRole("link", { name: "Datenschutzerklärung" })).toBeVisible();
      }
    });

    test("mobil ohne horizontales Scrollen und ohne externe Anfragen oder Browser-Identität", async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 800 });
      const hosts = new Set<string>();
      page.on("request", (request) => { hosts.add(new URL(request.url()).hostname); });
      for (const path of ["/", "/impressum", "/datenschutz"]) {
        await page.goto(path);
        await page.waitForLoadState("networkidle");
        const width = await page.evaluate(() => ({ inner: window.innerWidth, scroll: document.documentElement.scrollWidth }));
        expect(width.scroll, path).toBeLessThanOrEqual(width.inner);
      }
      expect([...hosts]).toEqual(["127.0.0.1"]);
      const keys = await page.evaluate(() => Object.keys(localStorage));
      expect(keys.filter((key) => /identityId|CognitoIdentityServiceProvider|quizrush\.expiry/.test(key))).toEqual([]);
    });
  });
}

test("Die Join-Seite verlinkt die Datenschutzerklärung ohne Zustimmungs-Checkbox", async ({ page }) => {
  await cloudMode(page);
  await page.goto("/join");
  await expect(page.getByRole("link", { name: "Datenschutzerklärung" }).first()).toBeVisible();
  await expect(page.getByRole("checkbox")).toHaveCount(0);
});
