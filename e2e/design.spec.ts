import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

const gamificationManifest = JSON.parse(readFileSync(
  new URL("../spec/ratelama-gamification-assets/manifest.json", import.meta.url), "utf8",
)) as { assets: Array<{ files: string[] }> };

async function localMode(page: Page) {
  await page.route("**/amplify_outputs.json", (route) => route.fulfill({ status: 404 }));
}

async function screenshot(page: Page, name: string) {
  await page.screenshot({ path: test.info().outputPath(name), fullPage: true, animations: "disabled" });
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => ({
    width: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    elements: [...document.querySelectorAll("body *")].filter((element) => {
      const rect = element.getBoundingClientRect();
      return rect.right > window.innerWidth || rect.left < 0;
    }).map((element) => element.className).filter((name) => typeof name === "string"),
  }));
  expect(overflow.scrollWidth, JSON.stringify(overflow)).toBeLessThanOrEqual(overflow.width);
}

async function expectGameImagesLoaded(page: Page) {
  const images = page.locator('img[src*="/assets/gamification/"]');
  await expect.poll(() => images.evaluateAll((elements) => elements
    .filter((element) => {
      const image = element as HTMLImageElement;
      return !image.complete || image.naturalWidth === 0;
    }).map((element) => (element as HTMLImageElement).src))).toEqual([]);
  await expect.poll(() => images.evaluateAll((elements) => elements.every((element) =>
    element.getAttribute("alt") === "" && element.getAttribute("aria-hidden") === "true" &&
    element.getBoundingClientRect().width > 0 && element.getBoundingClientRect().height > 0))).toBe(true);
}

async function expectReadableText(page: Page, selectors: string) {
  const contrasts = await page.locator(selectors).evaluateAll((elements) => {
    function rgb(value: string) { return (value.match(/[\d.]+/g) ?? []).map(Number); }
    function luminance(color: number[]) {
      return color.slice(0, 3).map((part) => {
        const value = part / 255;
        return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
      }).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
    }
    return elements.map((element) => {
      let ancestor: Element | null = element;
      let background = [247, 247, 239];
      while (ancestor) {
        const color = rgb(getComputedStyle(ancestor).backgroundColor);
        if (color.length === 3 || color[3] === 1) { background = color; break; }
        ancestor = ancestor.parentElement;
      }
      const foreground = luminance(rgb(getComputedStyle(element).color));
      const back = luminance(background);
      return { text: element.textContent?.trim().slice(0, 70), ratio: (Math.max(foreground, back) + .05) / (Math.min(foreground, back) + .05) };
    });
  });
  expect(contrasts.length).toBeGreaterThan(0);
  for (const contrast of contrasts) expect(contrast.ratio, contrast.text).toBeGreaterThanOrEqual(4.5);
}

async function mockGame(page: Page) {
  await page.route("**/src/cloud.ts", (route) => route.fulfill({
    contentType: "application/javascript",
    body: `
      export async function configureCloud() { return true; }
      const participant = { sessionId: "design", participantId: "me", displayName: "Fröhlicher Fuchs", avatarId: "avatar-001", joinedAt: 1 };
      const deadline = Date.now() + 60000;
      function state() {
        const extra = JSON.parse(sessionStorage.getItem("game-state") || "{}");
        return { sessionId: "design", status: "QUESTION_OPEN", version: 1, title: "Die große Feierabendrunde",
          questionId: "q1", questionIndex: 0, questionCount: 2, participantCount: 2,
          answerCount: sessionStorage.getItem(extra.questionId || "q1") ? 1 : 0,
          eligibleParticipantCount: 2, serverTime: Date.now(), closesAt: deadline,
          question: { text: "Welcher Planet ist für seine Ringe bekannt?", answers: [
            { id: "a", text: "Mars" }, { id: "b", text: "Saturn" }, { id: "c", text: "Venus" }, { id: "d", text: "Merkur" }
          ] }, participants: [participant], leaderboard: [], ...extra };
      }
      export const cloud = {
        gameState: async () => {
          if (sessionStorage.getItem("fail-state")) throw new Error("Spielstand nicht erreichbar.");
          return state();
        },
        presentation: async () => {
          if (sessionStorage.getItem("fail-presentation")) throw new Error("Präsentation nicht erreichbar.");
          return state();
        },
        myParticipation: async () => participant,
        myAnswer: async () => {
          sessionStorage.setItem("restore-calls", String(Number(sessionStorage.getItem("restore-calls") || 0) + 1));
          const failed = sessionStorage.getItem("fail-restore");
          const result = { questionId: state().questionId, choiceId: sessionStorage.getItem(state().questionId) };
          const delay = Number(sessionStorage.getItem("restore-delay") || 0);
          if (delay) await new Promise(resolve => setTimeout(resolve, delay));
          if (failed) throw new Error("Gespeicherte Antwort konnte nicht geladen werden.");
          return result;
        },
        result: async () => {
          if (sessionStorage.getItem("fail-result")) throw new Error("Ergebnis nicht erreichbar.");
          return { questionId: state().questionId, answered: Boolean(sessionStorage.getItem(state().questionId)),
            correct: sessionStorage.getItem(state().questionId) === "b", points: sessionStorage.getItem(state().questionId) === "b" ? 850 : 0,
            totalPoints: sessionStorage.getItem(state().questionId) === "b" ? 850 : 0,
            elapsedMs: sessionStorage.getItem(state().questionId) ? 6000 : null,
            ...JSON.parse(sessionStorage.getItem("personal-result") || "{}") };
        },
        answer: async (session, question, choice) => {
          sessionStorage.setItem("answer-calls", String(Number(sessionStorage.getItem("answer-calls") || 0) + 1));
          const receivedAt = Date.now();
          await new Promise(resolve => setTimeout(resolve, Number(sessionStorage.getItem("answer-delay") || 500)));
          if (sessionStorage.getItem("fail-answer")) throw new Error("Antwort konnte nicht gespeichert werden.");
          if (state().status !== "QUESTION_OPEN" || state().questionId !== question || receivedAt >= state().closesAt)
            throw new Error("Die Frage ist nicht zur Beantwortung geöffnet.");
          if (sessionStorage.getItem(question) === choice)
            return { acceptedAt: Number(sessionStorage.getItem("accepted-at-" + question)) };
          sessionStorage.setItem(question, choice);
          sessionStorage.setItem("accepted-at-" + question, String(receivedAt));
          const receiptDelay = Number(sessionStorage.getItem("receipt-delay") || 0);
          if (receiptDelay) await new Promise(resolve => setTimeout(resolve, receiptDelay));
          if (sessionStorage.getItem("lose-receipt")) throw new Error("Bestätigung nicht erreichbar.");
          return { acceptedAt: receivedAt };
        },
        listSessions: async () => [{ sessionId: "design", title: "Runde", status: state().status, joinCode: "123456", presentationToken: "design", createdAt: 1 }],
        getSession: async () => ({ sessionId: "design", title: "Runde", status: state().status, joinCode: "123456", presentationToken: "design", createdAt: 1 }),
        deleteMyParticipation: async () => {
          if (sessionStorage.getItem("fail-delete")) throw new Error("Löschen nicht möglich. Bitte erneut versuchen.");
          sessionStorage.setItem("deleted-participation", "design");
        },
        questions: async () => [{ questionId: "q1", index: 0, text: "Frage 1" }, { questionId: "q2", index: 1, text: "Frage 2" }],
        control: async (action, sessionId, questionId, expectedVersion) => {
          sessionStorage.setItem("last-control", JSON.stringify({ action, sessionId, questionId, expectedVersion }));
          return { version: expectedVersion + 1 };
        },
        transition: async (action, sessionId, expectedVersion) => {
          sessionStorage.setItem("last-control", JSON.stringify({ action, sessionId, expectedVersion }));
          return { version: expectedVersion + 1 };
        },
        subscribe: (session, mode, token, onEvent) => {
          const listener = () => {
            const current = state();
            onEvent({ sessionId: current.sessionId, version: current.version,
              participantCount: current.participantCount, answerCount: current.answerCount });
          };
          window.addEventListener("quiz-test-state", listener);
          return { unsubscribe: () => window.removeEventListener("quiz-test-state", listener) };
        }
      };
    `,
  }));
}

async function setPhase(page: Page, status: string, questionId = "q1") {
  await page.evaluate(({ status, questionId }) => {
    const previous = JSON.parse(sessionStorage.getItem("game-state") || "{}");
    sessionStorage.setItem("game-state", JSON.stringify({
      ...previous, status, questionId, questionIndex: questionId === "q1" ? 0 : 1, version: (previous.version ?? 1) + 1,
      reveal: ["REVEAL", "LEADERBOARD", "FINISHED"].includes(status) ? {
        correctChoiceId: "b", explanation: "Saturn ist für sein Ringsystem bekannt.",
        distribution: [{ choiceId: "a", count: 1 }, { choiceId: "b", count: 1 }],
      } : null,
    }));
    window.dispatchEvent(new Event("quiz-test-state"));
  }, { status, questionId });
}

async function updateGame(page: Page, update: Record<string, unknown>) {
  await page.evaluate((update) => {
    const previous = JSON.parse(sessionStorage.getItem("game-state") || "{}");
    sessionStorage.setItem("game-state", JSON.stringify({ ...previous, ...update, version: (previous.version ?? 1) + 1 }));
    window.dispatchEvent(new Event("quiz-test-state"));
  }, update);
}

function players(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    participantId: index === 3 ? "me" : `p${index}`,
    displayName: index === 3 ? "Fröhlicher Fuchs" : `Neugieriger Koala ${index + 1}`,
    avatarId: `avatar${index}`, points: 4000 - index * 30, correctAnswers: 4, correctElapsedMs: 6000,
    rank: index + 1, previousRank: index + 2, rankChange: 1,
  }));
}

test("Avatare laden lokale Motive und zeigen bei unbekannten oder defekten Bildern einen stabilen Fallback", async ({ page }) => {
  await mockGame(page);
  await page.goto("/play/design");
  const image = page.locator(".player-identity img.avatar");
  await expect(image).toHaveAttribute("src", "/assets/avatars/256/avatar-001-fuchs.png");
  await expect.poll(() => image.evaluate((element) => (element as HTMLImageElement).naturalWidth)).toBe(256);
  await setPhase(page, "FINISHED");
  await updateGame(page, { leaderboard: players(1) });
  await expect(page.locator(".leaderboard .avatar-fallback")).toHaveCount(1);

  const brokenImagePage = await page.context().newPage();
  await mockGame(brokenImagePage);
  await brokenImagePage.route("**/avatar-001-fuchs.png", (route) => route.abort());
  await brokenImagePage.goto("/play/design");
  await expect(brokenImagePage.locator(".player-identity .avatar-fallback")).toBeVisible();
  await expect(brokenImagePage.locator(".player-identity img.avatar")).toHaveCount(0);
  await brokenImagePage.close();
});

for (const width of [320, 390, 768, 1440]) {
  test(`Startseite und Editor passen bei ${width}px ohne horizontales Scrollen`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await localMode(page);
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Kleine Fragen.");
    await screenshot(page, "home.png");
    await expectNoHorizontalOverflow(page);
    await page.locator(".quiz-preview summary").focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("region", { name: "Beispiel einer Quizrunde" })).toContainText("Deine Auswahl: B · Saturn");
    await expectNoHorizontalOverflow(page);
    await page.goto("/admin/quizzes/new");
    await expect(page.getByRole("heading", { name: "Neues Quiz", exact: true })).toBeVisible();
    await page.getByLabel("Antwort 2 bei Frage 1", { exact: true }).fill("Eine längere Antwort für die nächste gemeinsame Quizrunde");
    await page.getByLabel("Antwort 2 bei Frage 1 ist richtig").check();
    await expect(page.locator(".answer-row.is-correct")).toContainText("Richtig");
    await expect(page.locator(".answers .selection-summary")).toContainText("Richtige Antwort: B");
    await expect(page.locator(".outline-link.has-selection")).toContainText("B · Eine längere Antwort");
    await expectNoHorizontalOverflow(page);
    const targets = await page.locator(".correct-choice, .icon-button, .editor-actions .button").evaluateAll((elements) =>
      elements.map((element) => { const rect = element.getBoundingClientRect(); return { width: rect.width, height: rect.height }; }));
    expect(targets.every((target) => target.width >= 44 && target.height >= 44)).toBe(true);
    await screenshot(page, "editor.png");
  });
}

test("Im Smartphone-Querformat bleiben Fragefortschritt und Antwortbestätigung erreichbar", async ({ page }) => {
  await page.setViewportSize({ width: 667, height: 320 });
  await mockGame(page);
  await page.goto("/play/design");
  await expect(page.locator(".question-meta-progress")).toHaveText("Frage 1/2");
  await expect(page.locator(".question-meta-progress progress")).toHaveAttribute("value", "1");
  const choice = page.getByRole("button", { name: /Saturn/ });
  await choice.click();
  await expect(choice).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".answer-feedback")).toContainText("Antwort ist drin");
  await expectNoHorizontalOverflow(page);
});

test("Tastatur, Fokus, Navigationszustand und Fehlermeldungen sind zugänglich", async ({ page }) => {
  await localMode(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Zum Inhalt springen" });
  await expect(skip).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();
  await page.getByRole("link", { name: "Quiz-Entwürfe", exact: true }).click();
  await expect(page.getByRole("main")).toBeFocused();
  await page.goto("/admin/quizzes/new");
  await expect(page.getByRole("link", { name: "Quiz-Entwürfe", exact: true })).toHaveAttribute("aria-current", "page");
  const first = page.getByRole("radio", { name: "Antwort 1 bei Frage 1 ist richtig" });
  await first.focus();
  await page.keyboard.press("Space");
  await expect(first).toBeChecked();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("radio", { name: "Antwort 2 bei Frage 1 ist richtig" })).toBeChecked();
  await expect(page.locator(".answers .selection-summary")).toContainText("Richtige Antwort: B");
  const focusStyle = await page.getByRole("radio", { name: "Antwort 2 bei Frage 1 ist richtig" }).evaluate((element) => {
    const style = getComputedStyle(element);
    return { width: style.outlineWidth, style: style.outlineStyle };
  });
  expect(focusStyle).toEqual({ width: "3px", style: "solid" });
  await page.getByRole("button", { name: "Entwurf speichern" }).click();
  await expect(page.getByLabel("Quiztitel")).toBeFocused();
  await expect(page.getByLabel("Quiztitel")).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByLabel("Quiztitel")).toHaveAccessibleDescription("Bitte ausfüllen.");
});

test("Eigene Antwort bleibt beim Senden, Auswerten und Neuladen sichtbar", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockGame(page);
  await page.goto("/play/design");
  const answer = page.getByRole("button", { name: /Saturn/ });
  await expect(answer).toBeEnabled();
  await answer.click();
  await expect(answer).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".answer-feedback")).toContainText("Wird gesendet");
  await expect(page.locator(".answer-feedback")).toContainText("B · Saturn");
  await expect(page.locator(".answer-feedback")).toContainText("Antwort ist drin");
  await expect(answer).toHaveClass(/is-selected/);
  await expect(answer).toContainText("Deine Antwort");
  await answer.focus();
  await page.keyboard.press("Enter");
  expect(await page.evaluate(() => sessionStorage.getItem("answer-calls"))).toBe("1");
  await expectNoHorizontalOverflow(page);
  await setPhase(page, "SCORING");
  await expect(page.locator(".phase-badge")).toContainText("Wird ausgewertet");
  await expect(answer).toHaveClass(/is-selected/);
  await page.reload();
  await expect(answer).toHaveAttribute("aria-pressed", "true");
  await setPhase(page, "REVEAL");
  await expect(page.locator(".result-message")).toContainText("Richtig!");
  await expect(page.locator(".personal-result .points")).toContainText("850");
  await expect(page.locator(".result-option.correct")).toContainText("Saturn");
  await expect(page.locator(".answer-grid")).toHaveCount(0);
  await expect(page.locator(".answer-confetti")).toBeVisible();
  await expect(page.locator(".answer-confetti")).toHaveAttribute("aria-hidden", "true");
  await expect.poll(() => page.locator(".answer-confetti span").evaluateAll((particles) =>
    particles.some((particle) => {
      const rect = particle.getBoundingClientRect();
      return Number(getComputedStyle(particle).opacity) > 0 && rect.top >= 0 && rect.bottom <= window.innerHeight;
    }))).toBe(true);
  expect(await page.locator(".answer-confetti").evaluate((element) => getComputedStyle(element).pointerEvents)).toBe("none");
  await screenshot(page, "correct-answer.png");
  await expect.poll(() => page.locator(".answer-confetti span").evaluateAll((particles) =>
    particles.every((particle) => getComputedStyle(particle).opacity === "0"))).toBe(true);
  await page.reload();
  await expect(page.locator(".result-option.correct")).toContainText("Deine Antwort");
  await setPhase(page, "FINISHED");
  await expect(page.locator(".phase-badge")).toContainText("Geschafft!");
  await page.reload();
  await expect(page.getByRole("heading", { name: "Endstand", exact: true })).toBeVisible();
  await expect(page.locator(".reveal-phase")).toHaveCount(0);
  await setPhase(page, "LEADERBOARD");
  await expect(page.locator(".phase-badge")).toContainText("Der Zwischenstand");
  await expect(page.locator(".question-phase")).toHaveCount(0);
  await setPhase(page, "QUESTION_OPEN", "q2");
  await expect(page.locator(".answer-feedback")).toContainText("Tippe auf eine Antwort");
  await expect(answer).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator(".answer-confetti")).toHaveCount(0);
});

test("Falsche Antwort bleibt von der richtigen Lösung unterscheidbar – ohne Konfetti", async ({ page }) => {
  await mockGame(page);
  await page.goto("/play/design");
  await page.getByRole("button", { name: /Mars/ }).click();
  await expect(page.locator(".answer-feedback")).toContainText("Antwort ist drin");
  await setPhase(page, "REVEAL");
  await expect(page.locator(".result-message")).toContainText("Leider daneben");
  await expect(page.locator(".result-option").filter({ hasText: "Mars" })).toContainText("Deine Antwort");
  await expect(page.locator(".correct-answer")).toContainText("Saturn");
  await expect(page.locator(".answer-confetti")).toHaveCount(0);
  await page.reload();
  await expect(page.locator(".result-option").filter({ hasText: "Mars" })).toContainText("Deine Antwort");
});

test("Fehlgeschlagenes Senden wird nicht als gespeicherte Antwort dargestellt", async ({ page }) => {
  await mockGame(page);
  await page.goto("/play/design");
  await page.evaluate(() => sessionStorage.setItem("fail-answer", "true"));
  await page.getByRole("button", { name: /Saturn/ }).click();
  await expect(page.getByRole("alert")).toContainText("Antwort konnte nicht gespeichert werden.");
  await expect(page.getByRole("button", { name: /Saturn/ })).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator(".answer-feedback")).not.toContainText("Antwort ist drin");
  await expect(page.locator(".answer-confetti")).toHaveCount(0);
  await page.evaluate(() => sessionStorage.removeItem("fail-answer"));
  await page.getByRole("button", { name: /Saturn/ }).click();
  await expect(page.locator(".answer-feedback")).toContainText("Antwort ist drin");
});

test("Reduzierte Bewegung unterdrückt Konfetti, nicht die Erfolgsmeldung", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await mockGame(page);
  await page.goto("/play/design");
  await page.getByRole("button", { name: /Saturn/ }).click();
  await expect(page.locator(".answer-feedback")).toContainText("Antwort ist drin");
  await setPhase(page, "REVEAL");
  await expect(page.locator(".result-total")).toContainText("850 Punkte");
  await expect(page.locator(".answer-confetti")).toBeHidden();
});

test("Fehlgeschlagene Wiederherstellung kann ohne erneutes Antworten wiederholt werden", async ({ page }) => {
  await mockGame(page);
  await page.goto("/play/design");
  await page.getByRole("button", { name: /Saturn/ }).click();
  await expect(page.locator(".answer-feedback")).toContainText("Antwort ist drin");
  await page.evaluate(() => sessionStorage.setItem("fail-restore", "true"));
  await page.reload();
  await expect(page.getByRole("alert")).toContainText("Gespeicherte Antwort konnte nicht geladen werden.");
  await expect(page.locator(".answer-feedback")).toContainText("gerade nicht verfügbar");
  await expect(page.getByRole("button", { name: /Mars/ })).toBeDisabled();
  await page.evaluate(() => sessionStorage.removeItem("fail-restore"));
  await page.getByRole("button", { name: "Gespeicherte Antwort erneut prüfen" }).click();
  await expect(page.getByRole("button", { name: /Saturn/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".answer-feedback")).toContainText("B · Saturn");
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("Beitritt und Präsentation passen auf schmale Bildschirme", async ({ page }) => {
  await mockGame(page);
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/join/123456");
  await expect(page.getByLabel("Quiz-Code")).toHaveValue("123456");
  await expectNoHorizontalOverflow(page);
  await screenshot(page, "join.png");
  await page.goto("/present/design");
  await expect(page.locator(".game-title")).toHaveText("Die große Feierabendrunde");
  await expectNoHorizontalOverflow(page);
  await expect(page.locator(".answer-tile").filter({ hasText: "Saturn" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Saturn/ })).toHaveCount(0);
  await expect(page.getByRole("navigation")).toHaveCount(0);
  await expect(page.locator(".answer-confetti")).toHaveCount(0);
});

test("Zentrale Texte und Auswahlmarkierungen erfüllen mindestens 4,5:1 Kontrast", async ({ page }) => {
  await localMode(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expectReadableText(page, ".button, .eyebrow, .expedition-stamp, .expedition-card figcaption, .hero-copy p, .badge, .sample-selected, .sample-confirmation, .trust-chips li, .trust-link, .privacy-section h2, .privacy-section h3, .privacy-section p, .privacy-section li, .privacy-more summary, .footer-privacy summary, .footer-privacy li");
  await page.goto("/admin/quizzes/new");
  await page.getByRole("radio", { name: "Antwort 2 bei Frage 1 ist richtig" }).check();
  await expectReadableText(page, ".is-correct .correct-choice, .selection-summary, .field-error, .outline-link small, .hint");
  await mockGame(page);
  await page.goto("/play/design");
  await page.getByRole("button", { name: /Saturn/ }).click();
  await expect(page.locator(".answer-feedback")).toContainText("Antwort ist drin");
  await expectReadableText(page, ".answer-tile, .answer-state, .answer-feedback, .phase-badge");
});

for (const width of [320, 390, 430, 1440]) {
  test(`Spielphasen und lange Inhalte passen bei ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await mockGame(page);
    await page.goto("/play/design");
    await expect(page.getByText("Noch keine Wertung")).toBeVisible();
    await expect(page.getByRole("timer")).toHaveAttribute("aria-live", "off");
    const normalAnswers = await page.locator(".answer-tile").evaluateAll((elements) =>
      elements.map((element) => element.getBoundingClientRect().height));
    expect(normalAnswers.every((height) => height >= 56)).toBe(true);
    if (width >= 390 && width <= 430) {
      expect(await page.locator(".answer-tile").last().evaluate((element) => element.getBoundingClientRect().bottom)).toBeLessThan(844);
    }
    await screenshot(page, "question.png");
    for (const count of [2, 4, 6]) {
      await updateGame(page, { question: { text: "Eine sehr lange Frage über unser Sonnensystem und seine Planeten: ".repeat(5),
        answers: Array.from({ length: count }, (_, index) => ({ id: `a${index}`, text: `Antwort ${index + 1}: ${"Ausführlicher Antworttext ohne Abschneiden. ".repeat(4)}` })) } });
      await expect(page.locator(".answer-tile")).toHaveCount(count);
      await expectNoHorizontalOverflow(page);
      expect(await page.locator(".answer-text").last().evaluate((element) =>
        element.scrollHeight <= element.clientHeight)).toBe(true);
    }
    await screenshot(page, "long-answers.png");
    await updateGame(page, { question: { text: "Welcher Planet ist für seine Ringe bekannt?",
      answers: [{ id: "a", text: "Mars" }, { id: "b", text: "Saturn" }] }, participantCount: 25, eligibleParticipantCount: 25 });
    await page.getByRole("button", { name: /Saturn/ }).click();
    await expect(page.locator(".answer-feedback")).toContainText("Antwort ist drin");
    await screenshot(page, "answered.png");
    await page.evaluate(() => sessionStorage.setItem("personal-result", JSON.stringify({ totalPoints: 3910 })));
    await setPhase(page, "REVEAL");
    await expect(page.locator(".result-total")).toContainText("3.910 Punkte");
    await expect(page.locator(".result-time")).toContainText("6 Sekunden");
    await expect(page.locator(".correct-answer")).toContainText("B · Saturn");
    await expect(page.locator(".ranking-phase")).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
    await screenshot(page, "reveal.png");
    await updateGame(page, { status: "LEADERBOARD", questionIndex: 4, questionCount: 10, leaderboard: players(25) });
    await expect(page.getByRole("heading", { name: "Dein Zwischenstand: Platz 4" })).toBeVisible();
    await expect(page.locator(".personal-ranking .rank-change")).toContainText("1 Platz gutgemacht");
    await expect(page.locator(".reveal-phase, .question-phase")).toHaveCount(0);
    await expect(page.locator(".leaderboard li")).toHaveCount(3);
    await expectNoHorizontalOverflow(page);
    await screenshot(page, "ranking.png");
    await updateGame(page, { status: "FINISHED", questionIndex: 9 });
    await expect(page.getByRole("heading", { name: "Endstand", exact: true })).toBeVisible();
    await expect(page.locator(".personal-ranking")).toContainText("4 von 10 Fragen richtig beantwortet");
    await expectNoHorizontalOverflow(page);
    await screenshot(page, "final.png");
  });
}

for (const status of ["LEADERBOARD", "FINISHED"]) {
  test(`Gemeinsame Ranglisten-Komponenten erhalten Live-Ansichten für ${status}`, async ({ page }) => {
    await mockGame(page);
    await page.addInitScript((state) => sessionStorage.setItem("game-state", JSON.stringify(state)), {
      status, questionIndex: 4, questionCount: 5, participantCount: 10, leaderboard: players(10),
    });
    await page.goto("/present/design");
    await expect(page.getByRole("heading", { name: status === "FINISHED" ? "Endstand" : "Zwischenstand", exact: true })).toBeVisible();
    await expect(page.locator(".pedestal")).toHaveText(["Platz 2", "Platz 1", "Platz 3"]);
    await expect(page.locator(".podium-player > span")).toHaveText(["3.970 Punkte", "4.000 Punkte", "3.940 Punkte"]);
    await expect(page.locator(".leaderboard .rank-number")).toHaveText(["4", "5", "6", "7", "8"]);
    await expect(page.locator(".leaderboard .is-you")).toHaveCount(0);
    await expectReadableText(page, ".podium-player strong, .podium-player > span, .leaderboard strong, .ranking-intro");
    await expectNoHorizontalOverflow(page);

    await page.goto("/play/design");
    await expect(page.getByRole("heading", { name: `Dein ${status === "FINISHED" ? "Endstand" : "Zwischenstand"}: Platz 4` })).toBeVisible();
    await expect(page.locator(".podium-player")).toHaveCount(0);
    await expect(page.getByRole("list", { name: "Deine benachbarten Plätze" })).toBeVisible();
    await expect(page.locator(".leaderboard .rank-number")).toHaveText(["3", "4", "5"]);
    await expect(page.locator(".leaderboard .is-you .rank-name")).toHaveText("Fröhlicher Fuchs (du)");
    await expect(page.locator(".personal-ranking .points")).toHaveText("3.910");
  });
}

test("Präsentation trennt Phasen, zeigt proportionale Stimmen und das Podest 2–1–3", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await mockGame(page);
  await page.goto("/present/design");
  await updateGame(page, { answerCount: 18, eligibleParticipantCount: 24, participantCount: 24 });
  await expect(page.getByRole("progressbar")).toHaveAttribute("value", "18");
  await expect(page.getByRole("progressbar")).toHaveAttribute("max", "24");
  await expect(page.locator(".answer-progress")).toContainText("18 von 24");
  await expect(page.locator(".correct, .vote-track, .leaderboard")).toHaveCount(0);
  await expect(page.getByRole("navigation")).toHaveCount(0);
  await expect(page.getByRole("button")).toHaveCount(0);
  await screenshot(page, "presentation-question.png");
  await setPhase(page, "REVEAL");
  await updateGame(page, { leaderboard: players(5), reveal: { correctChoiceId: "b", explanation: "",
    distribution: [{ choiceId: "a", count: 3 }, { choiceId: "b", count: 17 }, { choiceId: "c", count: 3 }, { choiceId: "d", count: 1 }] } });
  await expect(page.locator(".reveal-phase")).toBeVisible();
  await expect(page.locator(".ranking-phase, .question-phase, .question-explanation")).toHaveCount(0);
  expect(await page.locator(".result-option.correct .vote-track span").evaluate((element) => (element as HTMLElement).style.width)).toBe("70.8333%");
  await screenshot(page, "presentation-reveal.png");
  await updateGame(page, { status: "LEADERBOARD", leaderboard: players(24), questionIndex: 4 });
  await expect(page.locator(".podium-player")).toHaveCount(3);
  const podium = await page.locator(".pedestal").evaluateAll((elements) =>
    elements.map((element) => ({ text: element.textContent, height: element.getBoundingClientRect().height })));
  expect(podium.map((place) => place.text)).toEqual(["Platz 2", "Platz 1", "Platz 3"]);
  expect(podium[1].height).toBeGreaterThan(podium[0].height);
  expect(podium[0].height).toBeGreaterThan(podium[2].height);
  await expect(page.locator(".leaderboard li")).toHaveCount(5);
  await expectReadableText(page, ".podium-player strong, .podium-player > span, .leaderboard strong, .ranking-intro");
  await expectNoHorizontalOverflow(page);
  expect(await page.locator(".game-view").evaluate((element) => element.getBoundingClientRect().bottom)).toBeLessThanOrEqual(1080);
  await screenshot(page, "presentation-ranking.png");
  await updateGame(page, { status: "FINISHED" });
  await screenshot(page, "presentation-final.png");
});

test("Leere Runde, begrenzte Lobby, kleine Podeste und geteilte Ränge bleiben korrekt", async ({ page }) => {
  await mockGame(page);
  await page.goto("/present/design");
  await updateGame(page, { status: "LOBBY", questionIndex: -1, joinCode: "123456", participants: players(100), participantCount: 100 });
  await expect(page.locator(".player-tag")).toHaveCount(12);
  await expect(page.getByText("+ 88 weitere")).toBeVisible();
  await expect(page.locator(".join-code")).toHaveText("123456");
  await screenshot(page, "lobby.png");
  await updateGame(page, { status: "QUESTION_OPEN", participantCount: 0, eligibleParticipantCount: 0, answerCount: 0 });
  await expect(page.getByRole("progressbar")).toHaveAttribute("value", "0");
  await expect(page.locator(".answer-progress")).toContainText("0 von 0");
  await setPhase(page, "REVEAL");
  await updateGame(page, { reveal: { correctChoiceId: "b", explanation: "", distribution: [] } });
  await expect(page.locator(".distribution-note")).toContainText("0 abgegebene Antworten");
  expect(await page.locator(".vote-track span").evaluateAll((elements) => elements.every((element) => (element as HTMLElement).style.width === "0%"))).toBe(true);
  for (const count of [0, 1, 2, 3]) {
    await updateGame(page, { status: "FINISHED", leaderboard: players(count) });
    await expect(page.locator(".podium-player")).toHaveCount(count);
  }
  const tied = players(3).map((player, index) => ({ ...player, points: index < 2 ? 4000 : 3000, rank: index < 2 ? 1 : 3 }));
  await updateGame(page, { leaderboard: tied });
  await expect(page.locator(".pedestal")).toHaveText(["Platz 1", "Platz 1", "Platz 3"]);
  await expect.poll(() => page.locator(".podium-player").evaluateAll((elements) =>
    elements.every((element) => getComputedStyle(element).transform === "none"))).toBe(true);
  const heights = await page.locator(".pedestal").evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().height));
  expect(heights[0]).toBe(heights[1]);
  await page.setViewportSize({ width: 320, height: 844 });
  await updateGame(page, { leaderboard: tied.map((player) => ({ ...player, displayName: "EinSehrLangerSpielnameOhneTrennstellen".repeat(4) })) });
  await expectNoHorizontalOverflow(page);
  await screenshot(page, "tied-long-names.png");
});

test("Fehlende Antwort, Ergebnisfehler und Wiederherstellung einer verlorenen Bestätigung", async ({ page }) => {
  await mockGame(page);
  await page.goto("/play/design");
  await setPhase(page, "REVEAL");
  await expect(page.locator(".result-message")).toContainText("Zeit abgelaufen · Keine Antwort");
  await expect(page.locator(".correct-answer")).toContainText("Saturn");
  await expect(page.locator(".result-time")).toHaveCount(0);
  await expect(page.locator(".answer-confetti")).toHaveCount(0);
  await setPhase(page, "QUESTION_OPEN", "q2");
  await page.evaluate(() => sessionStorage.setItem("lose-receipt", "true"));
  await page.getByRole("button", { name: /Saturn/ }).click();
  await expect(page.locator(".answer-feedback")).toContainText("Antwort ist drin");
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect(await page.evaluate(() => sessionStorage.getItem("answer-calls"))).toBe("1");
  await page.evaluate(() => sessionStorage.setItem("fail-result", "true"));
  await setPhase(page, "REVEAL", "q2");
  await expect(page.getByRole("alert")).toContainText("Ergebnis nicht erreichbar");
  await expect(page.locator(".correct-answer")).toContainText("Saturn");
  await page.evaluate(() => sessionStorage.removeItem("fail-result"));
  await page.getByRole("button", { name: "Spielstand erneut prüfen" }).click();
  await expect(page.locator(".result-message")).toHaveText("Richtig!");
});

test("Wiederverbindung stellt bestätigte Antworten her und ignoriert alte Versionen", async ({ page }) => {
  await mockGame(page);
  await page.goto("/play/design");
  await expect(page.getByRole("button", { name: /Saturn/ })).toBeEnabled();
  await page.evaluate(() => {
    window.dispatchEvent(new Event("offline"));
    sessionStorage.setItem("q1", "b");
  });
  await expect(page.getByRole("alert")).toContainText("offline");
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(page.locator(".answer-feedback")).toContainText("Antwort ist drin");
  await expect(page.getByRole("alert")).toHaveCount(0);
  await setPhase(page, "SCORING");
  await expect(page.locator(".phase-badge")).toHaveText("Wird ausgewertet");
  await page.evaluate(() => {
    sessionStorage.setItem("game-state", JSON.stringify({ status: "QUESTION_OPEN", version: 1 }));
    window.dispatchEvent(new Event("quiz-test-state"));
  });
  await expect(page.getByRole("button", { name: /Mars/ })).toBeDisabled();
  expect(await page.evaluate(() => sessionStorage.getItem("answer-calls"))).toBeNull();
});

test("Präsentation erholt sich auch von einem Fehler beim ersten Laden", async ({ page }) => {
  await mockGame(page);
  await page.addInitScript(() => sessionStorage.setItem("fail-presentation", "true"));
  await page.goto("/present/design");
  await expect(page.getByRole("alert")).toContainText("Präsentation nicht erreichbar");
  await page.evaluate(() => sessionStorage.removeItem("fail-presentation"));
  await expect(page.locator(".question-phase")).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await setPhase(page, "SCORING");
  await expect(page.locator(".phase-badge")).toHaveText("Wird ausgewertet");
  await expect(page.getByRole("navigation")).toHaveCount(0);
});

test("Vergrößerter Text bleibt bedienbar und die erste Wertung erfindet keinen Rangaufstieg", async ({ page }) => {
  await mockGame(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/play/design");
  await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
  await expectNoHorizontalOverflow(page);
  const answer = page.getByRole("button", { name: /Saturn/ });
  await answer.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".answer-feedback")).toContainText("Antwort ist drin");
  await expectNoHorizontalOverflow(page);
  await expect(answer).toHaveCSS("outline-style", "solid");
  await updateGame(page, { status: "LEADERBOARD", leaderboard: players(6) });
  await expect(page.locator(".personal-ranking")).toContainText("Platz 4");
  await expect(page.locator(".rank-change")).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
  await page.reload();
  await expect(page.locator(".personal-ranking .points")).toHaveText("3.910");
  await updateGame(page, { status: "QUESTION_OPEN", questionIndex: 1, questionId: "q2", leaderboard: [] });
  await expect(page.locator(".player-identity")).toContainText("3.910 Punkte · Zuletzt Platz 4");
});

test("Der Timer sperrt bei Fristende Antworten ohne eigenen Phasenwechsel", async ({ page }) => {
  await mockGame(page);
  await page.goto("/play/design");
  await updateGame(page, { closesAt: Date.now() - 1000 });
  await expect(page.getByRole("timer")).toHaveAccessibleName("Noch 0 Sekunden");
  await expect(page.locator(".phase-badge")).toHaveText("Du bist gefragt");
  const answer = page.getByRole("button", { name: /Saturn/ });
  await expect(answer).toBeDisabled();
  await answer.focus();
  await page.keyboard.press("Enter");
  expect(await page.evaluate(() => sessionStorage.getItem("answer-calls"))).toBeNull();
  await setPhase(page, "REVEAL");
  await expect(page.locator(".result-message")).toContainText("Keine Antwort");
});

test("Antwortwechsel per Tastatur und Maus zählen nur eine Stimme und bleiben nach Neuladen änderbar", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockGame(page);
  await page.goto("/play/design");
  const mars = page.getByRole("button", { name: /Mars/ });
  const saturn = page.getByRole("button", { name: /Saturn/ });
  await mars.click();
  await expect(mars).toHaveClass(/is-selected/);
  await expect(saturn).toBeEnabled();
  const firstTime = await page.evaluate(() => sessionStorage.getItem("accepted-at-q1"));
  await saturn.focus();
  await page.keyboard.press("Enter");
  await expect(saturn).toHaveClass(/is-pending/);
  await expect(mars).toHaveClass(/is-selected/);
  await expect(page.locator(".answer-feedback")).toContainText("Wird gesendet");
  await expect(page.locator(".answer-feedback")).toContainText("B · Saturn");
  await expect(mars).toBeDisabled();
  await mars.focus();
  await page.keyboard.press("Enter");
  expect(await page.evaluate(() => sessionStorage.getItem("answer-calls"))).toBe("2");
  await expect(saturn).toHaveClass(/is-selected/);
  await expect(mars).not.toHaveClass(/is-selected/);
  await expect(page.locator(".answer-progress")).toContainText("1 von 2");
  expect(Number(await page.evaluate(() => sessionStorage.getItem("accepted-at-q1")))).toBeGreaterThan(Number(firstTime));
  await page.reload();
  await expect(saturn).toHaveAttribute("aria-pressed", "true");
  await expect(mars).toBeEnabled();
  await mars.click();
  await expect(mars).toHaveClass(/is-selected/);
  await expect(page.locator(".answer-progress")).toContainText("1 von 2");
  await expectNoHorizontalOverflow(page);
  await setPhase(page, "REVEAL");
  await expect(page.locator(".result-message")).toContainText("Leider daneben");
  await expect(page.locator(".result-option").filter({ hasText: "Mars" })).toContainText("Deine Antwort");
  await expect(page.locator(".result-option.correct")).not.toContainText("Deine Antwort");
});

test("Ein abgelehnter Wechsel behält die alte Antwort und zeigt den Fehler auch nach Wiederherstellung", async ({ page }) => {
  await mockGame(page);
  await page.goto("/play/design");
  const mars = page.getByRole("button", { name: /Mars/ });
  const saturn = page.getByRole("button", { name: /Saturn/ });
  await mars.click();
  await expect(mars).toHaveClass(/is-selected/);
  await page.evaluate(() => sessionStorage.setItem("fail-answer", "true"));
  await saturn.click();
  await expect(page.getByRole("alert")).toContainText("Antwort nicht bestätigt");
  await expect(saturn).toBeEnabled();
  await expect(mars).toHaveAttribute("aria-pressed", "true");
  await expect(saturn).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByRole("alert")).toContainText("Antwort konnte nicht gespeichert werden.");
  expect(await page.evaluate(() => sessionStorage.getItem("q1"))).toBe("a");
  await page.evaluate(() => sessionStorage.removeItem("fail-answer"));
  await saturn.click();
  await expect(saturn).toHaveClass(/is-selected/);
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("Verlorene Wechselbestätigung wird abgeglichen und erlaubt danach weitere Änderungen", async ({ page }) => {
  await mockGame(page);
  await page.goto("/play/design");
  const mars = page.getByRole("button", { name: /Mars/ });
  const saturn = page.getByRole("button", { name: /Saturn/ });
  await mars.click();
  await expect(mars).toHaveClass(/is-selected/);
  await page.evaluate(() => {
    sessionStorage.setItem("lose-receipt", "true");
    sessionStorage.setItem("restore-delay", "700");
  });
  await saturn.click();
  await expect(page.getByRole("alert")).toContainText("Antwort nicht bestätigt");
  await expect(mars).toBeDisabled();
  await expect(saturn).toHaveClass(/is-selected/);
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect(await page.evaluate(() => sessionStorage.getItem("answer-calls"))).toBe("2");
  await page.evaluate(() => {
    sessionStorage.removeItem("lose-receipt");
    sessionStorage.removeItem("restore-delay");
    window.dispatchEvent(new Event("offline"));
  });
  await expect(page.getByRole("alert")).toContainText("offline");
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(saturn).toHaveAttribute("aria-pressed", "true");
  await mars.click();
  await expect(mars).toHaveClass(/is-selected/);
});

test("Fristende sperrt auch Wechsel, während die zuletzt bestätigte Antwort sichtbar bleibt", async ({ page }) => {
  await mockGame(page);
  await page.goto("/play/design");
  const mars = page.getByRole("button", { name: /Mars/ });
  const saturn = page.getByRole("button", { name: /Saturn/ });
  await saturn.click();
  await expect(saturn).toHaveClass(/is-selected/);
  await updateGame(page, { closesAt: Date.now() - 1 });
  await expect(page.getByRole("timer")).toHaveAccessibleName("Noch 0 Sekunden");
  await expect(mars).toBeDisabled();
  await mars.focus();
  await page.keyboard.press("Enter");
  expect(await page.evaluate(() => sessionStorage.getItem("answer-calls"))).toBe("1");
  await expect(saturn).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".phase-badge")).toHaveText("Du bist gefragt");
});

test("Eine verspätete Sendebestätigung setzt die nächste Frage nicht zurück", async ({ page }) => {
  await mockGame(page);
  await page.goto("/play/design");
  await page.evaluate(() => sessionStorage.setItem("receipt-delay", "1800"));
  await page.getByRole("button", { name: /Saturn/ }).click();
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem("q1"))).toBe("b");
  await setPhase(page, "QUESTION_OPEN", "q2");
  await page.evaluate(() => sessionStorage.removeItem("receipt-delay"));
  const mars = page.getByRole("button", { name: /Mars/ });
  await mars.click();
  await expect(mars).toHaveClass(/is-selected/);
  await page.waitForTimeout(2000);
  await expect(mars).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".answer-feedback")).toContainText("A · Mars");
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("Ein verspäteter Restore überschreibt keine Auswahl der nächsten Frage", async ({ page }) => {
  await mockGame(page);
  await page.goto("/play/design");
  await page.getByRole("button", { name: /Saturn/ }).click();
  await expect(page.getByRole("button", { name: /Mars/ })).toBeEnabled();
  await page.evaluate(() => {
    sessionStorage.setItem("restore-delay", "1800");
    window.dispatchEvent(new Event("offline"));
  });
  const before = Number(await page.evaluate(() => sessionStorage.getItem("restore-calls")));
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect.poll(() => page.evaluate(() => Number(sessionStorage.getItem("restore-calls")))).toBeGreaterThan(before);
  await page.evaluate(() => sessionStorage.removeItem("restore-delay"));
  await setPhase(page, "QUESTION_OPEN", "q2");
  const mars = page.getByRole("button", { name: /Mars/ });
  await mars.click();
  await expect(mars).toHaveClass(/is-selected/);
  await page.waitForTimeout(2000);
  await expect(mars).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("Quizmaster steuert ausschließlich zulässige Schritte, Sonderaktionen bleiben nachrangig", async ({ page }) => {
  await mockGame(page);
  await page.route("**/src/AdminAuth.tsx", (route) => route.fulfill({
    contentType: "application/javascript", body: "export function AdminGate({children}) { return children; }",
  }));
  await page.goto("/admin/sessions/design");
  const controls = page.getByRole("complementary", { name: "Sitzung steuern" });
  await updateGame(page, { status: "LOBBY", questionIndex: -1 });
  await expect(page.locator(".join-code")).toHaveCount(1);
  await expect(controls.locator(".primary")).toHaveText("Erste Frage starten");
  await page.getByRole("button", { name: "Erste Frage starten" }).click();
  expect(JSON.parse(await page.evaluate(() => sessionStorage.getItem("last-control")) ?? "{}").action).toBe("startQuestion");
  await updateGame(page, { status: "COUNTDOWN", questionIndex: 0, opensAt: Date.now() + 3000 });
  await expect(controls.locator(".primary")).toHaveCount(0);
  await updateGame(page, { status: "QUESTION_OPEN" });
  await expect(page.getByRole("button", { name: "Frage vorzeitig schließen" })).toHaveClass(/secondary/);
  await setPhase(page, "REVEAL");
  await expect(controls.locator(".primary")).toHaveText("Zwischenstand anzeigen");
  await page.getByRole("button", { name: "Zwischenstand anzeigen" }).click();
  expect(JSON.parse(await page.evaluate(() => sessionStorage.getItem("last-control")) ?? "{}").action).toBe("showLeaderboard");
  await updateGame(page, { status: "LEADERBOARD", leaderboard: players(24), participantCount: 24 });
  await expect(controls.locator(".primary")).toHaveText("Nächste Frage starten");
  await updateGame(page, { questionIndex: 1 });
  await expect(controls.locator(".primary")).toHaveText("Endstand anzeigen");
  await screenshot(page, "quizmaster.png");
  await page.getByRole("button", { name: "Sitzung abbrechen" }).click();
  const dialog = page.getByRole("alertdialog", { name: "Sitzung abbrechen?" });
  await expect(dialog).toContainText("endet sofort für alle Teilnehmenden");
  await expectReadableText(page, ".confirm-dialog h2, .confirm-description, .confirm-dialog .eyebrow, .confirm-dialog .button");
  await dialog.getByRole("button", { name: "Abbrechen", exact: true }).click();
  expect(JSON.parse(await page.evaluate(() => sessionStorage.getItem("last-control")) ?? "{}").action).toBe("showLeaderboard");
  await page.getByRole("button", { name: "Sitzung abbrechen" }).click();
  await dialog.getByRole("button", { name: "Sitzung abbrechen" }).click();
  expect(JSON.parse(await page.evaluate(() => sessionStorage.getItem("last-control")) ?? "{}").action).toBe("cancelSession");
  await updateGame(page, { status: "FINISHED" });
  await expect(page.getByRole("button", { name: "Sitzung abbrechen" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Präsentationsansicht öffnen/ })).toHaveAttribute("target", "_blank");
});

test("Spieldaten-Löschdialog schützt laufende Fragen und zeigt fehlgeschlagene Löschungen", async ({ page }) => {
  await mockGame(page);
  await page.goto("/play/design");
  const trigger = page.getByRole("button", { name: "Meine Spieldaten löschen" });
  await expect(trigger).toBeDisabled();
  await setPhase(page, "REVEAL");
  await trigger.click();
  const dialog = page.getByRole("alertdialog", { name: "Spieldaten löschen?" });
  const confirm = dialog.getByRole("button", { name: "Ja, endgültig löschen" });
  await expect(dialog).toContainText("Teilnahme, Antworten und Punkte");
  await updateGame(page, { status: "QUESTION_OPEN" });
  await expect(confirm).toBeDisabled();
  await expect(dialog).toContainText("Bitte warte auf die Auflösung");
  await page.keyboard.press("Escape");
  expect(await page.evaluate(() => sessionStorage.getItem("deleted-participation"))).toBeNull();
  await setPhase(page, "FINISHED");
  await trigger.click();
  await page.evaluate(() => sessionStorage.setItem("fail-delete", "1"));
  await confirm.click();
  await expect(page.getByRole("alert")).toContainText("Löschen nicht möglich");
  await page.evaluate(() => sessionStorage.removeItem("fail-delete"));
  await trigger.click();
  await confirm.click();
  await expect(page.getByRole("heading", { name: "Deine Spieldaten wurden gelöscht" })).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem("deleted-participation"))).toBe("design");
});

test("Datenhinweis ist prominent eingebettet, wahrheitsgemäß und per Tastatur aufklappbar", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockGame(page);
  await page.goto("/");
  await expect(page.locator(".privacy-banner")).toHaveCount(0);
  const chips = page.getByRole("list", { name: "Mitspielen auf einen Blick" });
  await expect(chips).toContainText("Ohne Konto");
  await expect(chips).toContainText("Ohne E-Mail");
  await page.getByRole("link", { name: "Was wird gespeichert?" }).click();
  const section = page.getByRole("region", { name: "Mitspielen ohne Name und E-Mail." });
  await expect(section).toBeFocused();
  await expect(section).toBeInViewport();
  await expect(section).toContainText("Antwortzeiten und Punkte");
  await expect(section).toContainText("Erstellung der Sitzung gelöscht");
  const more = section.locator("summary");
  await more.focus();
  await page.keyboard.press("Enter");
  await expect(section.getByText("Quizmaster-Konten:", { exact: true })).toBeVisible();
  await expect(section).toContainText("E-Mail-Adresse gespeichert");
  await expectNoHorizontalOverflow(page);

  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/join");
  const note = page.locator(".join-card .privacy-note");
  await expect(note).toContainText("Ohne Name und E-Mail dabei.");
  await note.locator("summary").focus();
  await page.keyboard.press("Enter");
  await expect(note).toContainText("Antwortzeiten und Punkte werden gespeichert");
  await expect(note).toContainText("zeitversetzt");
  await expectNoHorizontalOverflow(page);
  await page.keyboard.press("Enter");
  await expect(note.getByText("Aufbewahrung:", { exact: true })).toBeHidden();

  await page.goto("/play/design");
  const footerPrivacy = page.locator("footer .footer-privacy");
  await footerPrivacy.locator("summary").click();
  await expect(footerPrivacy).toContainText("Für ein Konto wird eine E-Mail-Adresse gespeichert.");
  await expectNoHorizontalOverflow(page);
});

for (const viewport of [{ width: 360, height: 640 }, { width: 375, height: 667 }, { width: 390, height: 844 }]) {
  test(`Live-Frage für Mitspielende ist kompakt und passt ohne Scrollen bei ${viewport.width}×${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await mockGame(page);
    await page.goto("/play/design");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Welcher Planet ist für seine Ringe bekannt?");
    await expect(page.locator(".timer-pill")).toBeVisible();
    await expect(page.locator(".game-footnote")).toHaveCount(0);
    await expect(page.locator(".answer-grid.answer-columns-2")).toHaveCount(1);
    const fit = await page.evaluate(() => {
      const tiles = [...document.querySelectorAll(".answer-tile")].map((tile) => tile.getBoundingClientRect());
      const feedback = document.querySelector(".answer-feedback")!.getBoundingClientRect();
      return { lastTile: Math.max(...tiles.map((tile) => tile.bottom)), feedback: feedback.bottom, height: window.innerHeight,
        minTile: Math.min(...tiles.map((tile) => tile.height)) };
    });
    expect(fit.lastTile, JSON.stringify(fit)).toBeLessThanOrEqual(fit.height);
    expect(fit.feedback, JSON.stringify(fit)).toBeLessThanOrEqual(fit.height);
    expect(fit.minTile).toBeGreaterThanOrEqual(44);
    await expectNoHorizontalOverflow(page);
    await screenshot(page, `live-compact-${viewport.width}.png`);
  });
}

test("Gamification: Live-Punkte und Rangaufstieg feiern echte Ereignisse, nicht erneutes Laden", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockGame(page);
  await page.goto("/play/design");
  await page.getByRole("button", { name: /Saturn/ }).click();
  await expect(page.locator(".answer-feedback")).toContainText("Antwort ist drin");
  await page.evaluate(() => sessionStorage.setItem("personal-result", JSON.stringify({
    points: 950, totalPoints: 2850, streak: 3, maxStreak: 3,
    streakBonusPoints: 100, badges: ["FIRST_CORRECT", "STREAK_3"],
  })));
  await setPhase(page, "REVEAL");
  await expect(page.locator(".score-award .animated-points")).toHaveAttribute("aria-label", "950");
  await expect(page.locator(".streak-bonus")).toContainText("+100");
  await expect(page.locator(".achievement-badges")).toContainText("Dreier-Serie");
  await expect(page.locator(".answer-confetti")).toHaveCount(1);
  await expect(page.locator(".points-pop")).toHaveCount(1);
  await expect(page.locator(".score-award .animated-points")).toHaveText("950");
  await expect.poll(() => page.locator(".points-pop").evaluate((element) =>
    typeof element.getAnimations()[0]?.startTime)).toBe("number");
  const started = await page.locator(".points-pop").evaluate((element) => element.getAnimations()[0]?.startTime);
  await updateGame(page, { status: "REVEAL", questionIndex: 2 });
  expect(await page.locator(".points-pop").evaluate((element) => element.getAnimations()[0]?.startTime)).toBe(started);
  await page.evaluate(() => window.dispatchEvent(new Event("offline")));
  await expect(page.getByText("Du bist offline.", { exact: false })).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(page.getByText("Du bist offline.", { exact: false })).toHaveCount(0);
  expect(await page.locator(".points-pop").evaluate((element) => element.getAnimations()[0]?.startTime)).toBe(started);
  await updateGame(page, { status: "LEADERBOARD", questionIndex: 2, leaderboard: players(10) });
  await expect(page.locator(".rank-rise-animated")).toContainText("1 Platz gutgemacht");
  await page.reload();
  await expect(page.locator(".rank-rise")).toContainText("1 Platz gutgemacht");
  await expect(page.locator(".rank-rise-animated")).toHaveCount(0);
  await expect(page.locator(".points-pop, .answer-confetti")).toHaveCount(0);
  await updateGame(page, { status: "FINISHED" });
  await expect(page.locator(".finale-banner")).toContainText("Geschafft");
  await expect(page.locator(".final-confetti")).toHaveCount(1);
  await expectNoHorizontalOverflow(page);
});

test("Gamification: Reduced Motion behält Punkte und Abzeichen ohne Zählerfahrt oder Konfetti", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await mockGame(page);
  await page.goto("/play/design");
  await page.getByRole("button", { name: /Saturn/ }).click();
  await expect(page.locator(".answer-feedback")).toContainText("Antwort ist drin");
  await page.evaluate(() => sessionStorage.setItem("personal-result", JSON.stringify({
    points: 950, totalPoints: 2850, streak: 3, maxStreak: 3,
    streakBonusPoints: 100, badges: ["FIRST_CORRECT", "STREAK_3"],
  })));
  await setPhase(page, "REVEAL");
  await expect(page.locator(".score-award .animated-points")).toHaveText("950");
  await expect(page.locator(".score-award .animated-points")).toHaveAttribute("aria-label", "950");
  await expect(page.locator(".answer-confetti")).toHaveCount(0);
  await expect(page.locator(".achievement-badges")).toContainText("Dreier-Serie");
  expect(await page.locator(".milestone-pop").evaluate((element) => getComputedStyle(element).animationName)).toBe("none");
  await updateGame(page, { status: "FINISHED", questionIndex: 4, questionCount: 5, participantCount: 4, leaderboard: players(4) });
  await expect(page.locator('.finale-banner img[src$="/finale-participant.png"]')).toBeVisible();
  await expect(page.locator(".final-confetti")).toHaveCount(0);
  expect(await page.locator(".finale-banner").evaluate((element) => getComputedStyle(element).animationName)).toBe("none");
});

test("Gamification-Assets: alle 26 Motive und 72 lokalen Varianten sind erreichbar", async ({ request }) => {
  expect(gamificationManifest.assets).toHaveLength(26);
  const files = gamificationManifest.assets.flatMap((asset) => asset.files);
  expect(new Set(files).size).toBe(72);
  await Promise.all(files.map(async (file) => {
    expect(file).toMatch(/^public\/assets\/gamification\//);
    const response = await request.get(`/${file.slice("public/".length)}`);
    expect(response.ok(), file).toBe(true);
    const bytes = await response.body();
    if (file.endsWith(".svg")) {
      expect(bytes.toString("utf8"), file).toMatch(/<svg[\s\S]*viewBox=/);
    } else {
      const size = Number(file.match(/\/(64|128|256|512|1024)\//)?.[1]);
      expect(size, file).toBeGreaterThan(0);
      expect(bytes.subarray(0, 8).toString("hex"), file).toBe("89504e470d0a1a0a");
      expect(bytes.readUInt32BE(16), file).toBe(size);
      expect(bytes.readUInt32BE(20), file).toBe(size);
      expect([4, 6], file).toContain(bytes[25]);
    }
  }));
});

test("Gamification-Assets: bestätigte Punkte, Meilensteine und alle Badge-IDs behalten ihre Bedeutung", async ({ page }) => {
  await mockGame(page);
  await page.goto("/play/design");
  await page.getByRole("button", { name: /Saturn/ }).click();
  await expect(page.locator('.answer-feedback img[src$="/answer-saved.svg"]')).toBeVisible();
  await page.evaluate(() => sessionStorage.setItem("personal-result", JSON.stringify({
    points: 950, totalPoints: 2850, streak: 5, maxStreak: 5, streakBonusPoints: 200,
    badges: ["FIRST_CORRECT", "STREAK_3", "STREAK_5", "PERFECT", "__proto__"],
  })));
  await setPhase(page, "REVEAL");
  await expect(page.locator('.moment-visual img[src$="/answer-celebrate.png"]')).toBeVisible();
  await expect(page.locator('.moment-visual img[src$="/answer-celebrate.png"]'))
    .toHaveAttribute("srcset", /\/illustrations\/1024\/answer-celebrate\.png 2x$/);
  await expect(page.locator('.moment-visual img[src$="/answer-correct.svg"]')).toBeVisible();
  await expect(page.locator('.score-award img[src$="/points.svg"]')).toBeVisible();
  await expect(page.locator('.streak-bonus img[src$="/streak-active.svg"]')).toBeVisible();
  await expect(page.locator('.milestone-pop img[src$="/streak-milestone.svg"]')).toBeVisible();
  await expect(page.locator(".achievement-badges li")).toHaveText([
    "Erstes Aha!", "Dreier-Serie", "Unaufhaltsam", "Perfekte Runde", "__proto__",
  ]);
  expect(await page.locator(".achievement-badges img").evaluateAll((images) =>
    images.map((image) => image.getAttribute("src")?.split("/").at(-1)))).toEqual([
    "first-correct.svg", "streak-3.svg", "streak-5.svg", "perfect.svg", "badge-generic.svg",
  ]);
  await expect(page.locator('.badge-pop img[src$="/badge-generic.svg"]')).toBeVisible();
  await expectGameImagesLoaded(page);
});

for (const answered of [false, true]) {
  test(`Gamification-Assets: ${answered ? "falsche" : "fehlende"} Antwort feiert keinen Punktgewinn`, async ({ page }) => {
    await mockGame(page);
    await page.goto("/play/design");
    if (answered) {
      await page.getByRole("button", { name: /Mars/ }).click();
      await expect(page.locator(".answer-feedback")).toContainText("Antwort ist drin");
    }
    await setPhase(page, "REVEAL");
    await expect(page.locator(".result-message")).toHaveText(answered ? "Leider daneben" : "Zeit abgelaufen · Keine Antwort");
    await expect(page.locator('.moment-visual img[src$="/answer-encourage.png"]')).toBeVisible();
    await expect(page.locator(`.moment-visual img[src$="/${answered ? "answer-incorrect" : "timer"}.svg"]`)).toBeVisible();
    await expect(page.locator(".score-award .animated-points")).toHaveAttribute("aria-label", "0");
    await expect(page.locator(".points-pop, .answer-confetti")).toHaveCount(0);
    await expectGameImagesLoaded(page);
    const own = { ...players(4)[3], rank: 1, correctAnswers: 0 };
    await updateGame(page, { status: "FINISHED", leaderboard: [own] });
    await expect(page.locator(".finale-banner")).toBeVisible();
    await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    await expect(page.locator(".final-confetti, .finale-celebrating")).toHaveCount(0);
  });
}

test("Gamification-Assets: Rangaufstieg, Rangverlust und gleicher Rang verwenden die passenden Symbole", async ({ page }) => {
  await mockGame(page);
  await page.goto("/play/design");
  const leaderboard = players(4);
  for (const [change, symbol, label] of [
    [1, "rank-up", "1 Platz gutgemacht"],
    [-2, "rank-down", "2 Plätze zurück"],
    [0, "rank-steady", "Platz gehalten"],
  ] as const) {
    leaderboard[3] = { ...leaderboard[3], previousRank: 4 + change, rank: 4, rankChange: change };
    await updateGame(page, { status: "LEADERBOARD", questionIndex: 1, leaderboard });
    await expect(page.locator(".rank-change")).toContainText(label);
    await expect(page.locator(`.rank-change img[src$="/${symbol}.svg"]`)).toBeVisible();
    await expect(page.locator(".rank-rise-animated")).toHaveCount(change > 0 ? 1 : 0);
  }
  await expectGameImagesLoaded(page);
});

test("Gamification-Assets: ein bestätigter Live-Sieg zeigt das Siegerlama nur einmal", async ({ page }) => {
  await mockGame(page);
  await page.goto("/play/design");
  await page.getByRole("button", { name: /Saturn/ }).click();
  await expect(page.locator(".answer-feedback")).toContainText("Antwort ist drin");
  await setPhase(page, "REVEAL");
  await expect(page.locator(".result-message")).toHaveText("Richtig!");
  const own = { ...players(4)[3], rank: 1, previousRank: 2, rankChange: 1 };
  await updateGame(page, { status: "FINISHED", leaderboard: [own] });
  await expect(page.locator('.finale-banner img[src$="/finale-winner.png"]')).toBeVisible();
  await expect(page.locator(".final-confetti")).toHaveCount(1);
  await page.reload();
  await expect(page.locator('.finale-banner img[src$="/finale-winner.png"]')).toBeVisible();
  await expect(page.locator(".final-confetti, .finale-celebrating")).toHaveCount(0);
});

test("Gamification-Assets: geteilte Siege und das Präsentationsfinale bleiben bei 1920 px korrekt", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await mockGame(page);
  await page.goto("/present/design");
  const tied = players(24).map((player, index) => ({
    ...player, points: index < 2 ? 4000 : player.points, rank: index < 2 ? 1 : index + 1,
  }));
  await updateGame(page, { status: "FINISHED", questionIndex: 4, questionCount: 5, participantCount: 24, leaderboard: tied });
  await expect(page.locator('.finale-banner img[src$="/finale-participant.png"]')).toBeVisible();
  await expect(page.locator(".finale-banner")).toContainText("gemeinsam zu feiern");
  await expect(page.locator(".podium-rank-1 .podium-crown")).toHaveCount(2);
  await expect(page.locator(".podium-rank-3 .podium-crown")).toHaveCount(0);
  await expect(page.locator(".final-confetti")).toHaveCount(1);
  await expect.poll(() => page.locator(".podium-player").evaluateAll((elements) =>
    elements.every((element) => getComputedStyle(element).transform === "none"))).toBe(true);
  const heights = await page.locator(".pedestal").evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().height));
  expect(heights[0]).toBe(heights[1]);
  expect(await page.locator(".game-view").evaluate((element) => element.getBoundingClientRect().bottom)).toBeLessThanOrEqual(1080);
  await expectNoHorizontalOverflow(page);
  await expectGameImagesLoaded(page);
  await screenshot(page, "gamification-final-1920.png");
  await page.reload();
  await expect(page.locator(".finale-banner")).toBeVisible();
  await expect(page.locator(".final-confetti, .finale-celebrating")).toHaveCount(0);
});

for (const width of [320, 390, 430]) {
  test(`Gamification-Assets: Lobby, Countdown, Auflösung und persönliches Finale passen bei ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await mockGame(page);
    await page.goto("/play/design");
    await updateGame(page, { status: "LOBBY", participantCount: 2 });
    await expect(page.locator('.lobby-intro img[src$="/lobby-welcome.png"]')).toBeVisible();
    await expect(page.locator(".player-identity")).toContainText("Fröhlicher Fuchs");
    await expectNoHorizontalOverflow(page);
    await updateGame(page, { status: "COUNTDOWN", opensAt: Date.now() + 60_000 });
    await expect(page.locator('.moment-visual img[src$="/countdown-ready.png"]')).toBeVisible();
    await expect(page.locator('.moment-visual img[src$="/ready.svg"]')).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await setPhase(page, "QUESTION_OPEN");
    await page.getByRole("button", { name: /Saturn/ }).click();
    await expect(page.locator(".answer-feedback")).toContainText("Antwort ist drin");
    await setPhase(page, "REVEAL");
    await expect(page.locator('.moment-visual img[src$="/answer-celebrate.png"]')).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await updateGame(page, { status: "FINISHED", questionIndex: 4, questionCount: 5, participantCount: 4, leaderboard: players(4) });
    await expect(page.locator('.finale-banner img[src$="/finale-participant.png"]')).toBeVisible();
    await expect(page.locator('.personal-ranking img[src$="/trophy.svg"]')).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expect.poll(() => page.locator(".leaderboard li").evaluateAll((elements) =>
      elements.every((element) => getComputedStyle(element).transform === "none"))).toBe(true);
    const vertical = await page.evaluate(() => ({
      list: document.querySelector(".leaderboard")!.getBoundingClientRect().bottom,
      footnote: document.querySelector(".game-footnote")!.getBoundingClientRect().top,
    }));
    expect(vertical.list).toBeLessThanOrEqual(vertical.footnote);
    await expectGameImagesLoaded(page);
    await screenshot(page, `gamification-final-${width}.png`);
  });
}

test.describe("Gamification-Assets: lokale Fallbacks", () => {
  test.use({ deviceScaleFactor: 2 });

  test("SVG fällt auf PNG, defekte Badges auf Lucide und Illustrationen auf 1x bzw. Sticker zurück", async ({ page }) => {
    const warnings: string[] = [];
    page.on("console", (message) => { if (message.type() === "warning") warnings.push(message.text()); });
    await mockGame(page);
    await page.route("**/assets/gamification/**", (route) => {
      const path = new URL(route.request().url()).pathname;
      return [
        "/icons/timer.svg", "/badges/first-correct.svg", "/badges/png/256/first-correct.png",
        "/illustrations/1024/answer-celebrate.png",
      ].some((suffix) => path.endsWith(suffix)) ? route.abort() : route.continue();
    });
    await page.goto("/play/design");
    await expect(page.locator('.answer-feedback img[src$="/icons/png/128/timer.png"]')).toBeVisible();
    await page.getByRole("button", { name: /Saturn/ }).click();
    await expect(page.locator(".answer-feedback")).toContainText("Antwort ist drin");
    await page.evaluate(() => sessionStorage.setItem("personal-result", JSON.stringify({ badges: ["FIRST_CORRECT"] })));
    await setPhase(page, "REVEAL");
    const illustration = page.locator('.moment-visual img[src$="/answer-celebrate.png"]');
    await expect(illustration).toBeVisible();
    await expect.poll(() => illustration.evaluate((element) => (element as HTMLImageElement).currentSrc))
      .toContain("/illustrations/512/answer-celebrate.png");
    await expect(page.locator(".achievement-badges svg.game-icon")).toBeVisible();
    await expect(page.locator(".achievement-badges")).toContainText("Erstes Aha!");
    await expect(page.locator(".result-message")).toHaveText("Richtig!");
    expect(warnings.some((warning) => warning.includes("Gamification-Grafik konnte nicht geladen werden"))).toBe(true);

    await page.route("**/illustrations/512/answer-celebrate.png", (route) => route.abort());
    await page.reload();
    await expect(page.locator(".result-message")).toHaveText("Richtig!");
    await expect(page.locator(".moment-visual")).toHaveCount(0);
    await expect(page.locator('.personal-result .result-sticker img[src$="/answer-correct.svg"]')).toBeVisible();
    await expect(page.locator(".points-pop, .answer-confetti")).toHaveCount(0);
  });
});
