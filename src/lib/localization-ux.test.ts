import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { formatAbsoluteDate, relativeDay } from "./dates.ts";

const settingsRoute = readFileSync(new URL("../routes/app.settings.tsx", import.meta.url), "utf8");
const appShell = readFileSync(new URL("../components/app/AppShell.tsx", import.meta.url), "utf8");
const materialsRoute = readFileSync(new URL("../routes/app.materials.tsx", import.meta.url), "utf8");
const materialRoute = readFileSync(new URL("../routes/app.material.tsx", import.meta.url), "utf8");
const processingRoute = readFileSync(new URL("../routes/app.processing.tsx", import.meta.url), "utf8");
const overviewRoute = readFileSync(new URL("../routes/app.index.tsx", import.meta.url), "utf8");
const knowledgeMap = readFileSync(new URL("../components/app/KnowledgeMap.tsx", import.meta.url), "utf8");
const i18nSource = readFileSync(new URL("./i18n.tsx", import.meta.url), "utf8");

test("relative dates follow the selected NEXA locale", () => {
  const now = new Date(2026, 8, 2, 12);
  const today = now.toISOString();
  const yesterday = new Date(2026, 8, 1, 12).toISOString();
  const threeDaysAgo = new Date(2026, 7, 30, 12).toISOString();

  assert.equal(relativeDay(today, "en", now), "Today");
  assert.equal(relativeDay(yesterday, "en", now), "Yesterday");
  assert.equal(relativeDay(threeDaysAgo, "en", now), "3 days ago");
  assert.equal(relativeDay(today, "pt-BR", now), "Hoje");
  assert.equal(relativeDay(yesterday, "pt-BR", now), "Ontem");
  assert.equal(relativeDay(threeDaysAgo, "pt-BR", now), "Há 3 dias");
});

test("absolute dates use the selected NEXA locale rather than the browser default", () => {
  const iso = "2026-09-02T12:00:00.000Z";
  const options: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short", year: "numeric" };

  assert.equal(formatAbsoluteDate(iso, "en"), new Intl.DateTimeFormat("en", options).format(new Date(iso)));
  assert.equal(
    formatAbsoluteDate(iso, "pt-BR"),
    new Intl.DateTimeFormat("pt-BR", options).format(new Date(iso)),
  );
});

test("language save feedback is translated with the newly selected locale", () => {
  assert.match(settingsRoute, /translate\(selectedLocale, "settings\.languageSaved"\)/);
  assert.match(settingsRoute, /settings\.languagePortuguese/);
  assert.match(i18nSource, /"settings\.languagePortuguese": "Português \(Brasil\)"/);
});

test("pasted-note labels and material creation are localized", () => {
  assert.match(materialRoute, /createTextDocument\(text, t\("material\.pastedNotes"\)\)/);
  assert.match(processingRoute, /name: t\("material\.pastedNotes"\)/);
  assert.match(processingRoute, /lastStudied: t\("dates\.justNow"\)/);
  assert.match(i18nSource, /"material\.pastedNotes": "Pasted notes"/);
  assert.match(i18nSource, /"material\.pastedNotes": "Anotações coladas"/);
});

test("completed session CTA describes replay while active sessions still continue", () => {
  const activeBranch = overviewRoute.slice(overviewRoute.indexOf("{activeSession ? ("), overviewRoute.indexOf(") : (", overviewRoute.indexOf("{activeSession ? (")));
  const completedBranch = overviewRoute.slice(overviewRoute.indexOf('to="/app/sessions/$sessionId"'));

  assert.match(activeBranch, /overview\.continueSession/);
  assert.match(completedBranch, /overview\.viewLastSession/);
});

test("the inactive global search is removed and affected aria labels are localized", () => {
  assert.doesNotMatch(appShell, /type="search"/);
  assert.doesNotMatch(appShell, /<Search/);
  assert.match(appShell, /nav\.workspaceAria/);
  assert.match(appShell, /nav\.closeNavigation/);
  assert.match(materialsRoute, /materials\.renameAria/);
  assert.match(materialsRoute, /materials\.deleteAria/);
  assert.match(knowledgeMap, /knowledgeMap\.aria/);
});
