import { expect, test, type Page } from "@playwright/test";

async function cloudMode(page: Page) {
  await page.route("**/amplify_outputs.json", (route) => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({
      version: "1",
      auth: {
        aws_region: "eu-central-1", user_pool_id: "eu-central-1_testpool", user_pool_client_id: "testclient",
        identity_pool_id: "eu-central-1:00000000-0000-4000-8000-000000000001", unauthenticated_identities_enabled: true,
      },
      data: {
        url: "https://example.appsync-api.eu-central-1.amazonaws.com/graphql", aws_region: "eu-central-1",
        default_authorization_type: "AWS_IAM", authorization_types: ["AWS_IAM"],
      },
    }),
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
      const setCookieHeaders: string[] = [];
      page.on("request", (request) => { hosts.add(new URL(request.url()).hostname); });
      page.on("response", (response) => {
        const setCookie = response.headers()["set-cookie"];
        if (setCookie) setCookieHeaders.push(setCookie);
      });
      const paths = name === "lokal"
        ? ["/", "/impressum", "/datenschutz", "/join", "/join/123456", "/play/test", "/present/test", "/admin", "/admin/quizzes/new"]
        : ["/", "/impressum", "/datenschutz", "/join", "/admin", "/admin/quizzes/new"];
      for (const path of paths) {
        await page.goto(path);
        await page.waitForLoadState("networkidle");
        const width = await page.evaluate(() => ({ inner: window.innerWidth, scroll: document.documentElement.scrollWidth }));
        expect(width.scroll, path).toBeLessThanOrEqual(width.inner);
      }
      expect([...hosts]).toEqual(["127.0.0.1"]);
      const keys = await page.evaluate(() => Object.keys(localStorage));
      expect(keys.filter((key) => /identityId|CognitoIdentityServiceProvider|quizrush\.expiry|quizrush\.local-drafts\.v1/.test(key))).toEqual([]);
      expect(await page.context().cookies()).toEqual([]);
      expect(setCookieHeaders).toEqual([]);
    });
  });
}

test("Die Join-Seite verlinkt die Datenschutzerklärung ohne Zustimmungs-Checkbox", async ({ page }) => {
  await cloudMode(page);
  await page.goto("/join");
  await expect(page.getByRole("link", { name: "Datenschutzerklärung" }).first()).toBeVisible();
  await expect(page.getByRole("checkbox")).toHaveCount(0);
});
