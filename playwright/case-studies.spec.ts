/**
 * Screenshot harness for the case-study walkthroughs.
 *
 * For each case study, navigates once to `case-studies.html?case=<id>`, waits
 * for the builder to finish (`window.__caseStudyReady`), then advances
 * through every stage via `window.__setStage(n)` and screenshots each.
 *
 * Output layout: `results/case-studies/<case>-stage-<NN>-<id>.png`
 *
 * Stage IDs come from the page (`window.__stageMeta`), so adding a new stage
 * to a builder automatically picks up a new screenshot file.
 */

import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, "..", "results", "case-studies");
mkdirSync(outDir, { recursive: true });

interface StageMeta {
  id: string;
  label: string;
}

const cases = ["flange", "bracket", "hub", "flange-ab"] as const;

for (const caseId of cases) {
  test(`${caseId}: capture every stage`, async ({ page }) => {
    await page.goto(`/case-studies.html?case=${caseId}`);

    // Wait for the case study to finish building (initial stage 1 ready).
    await expect
      .poll(() => page.evaluate(() => window.__caseStudyReady === true), {
        timeout: 90_000,
        intervals: [500, 1000, 2000],
      })
      .toBe(true);

    const meta = await page.evaluate(() => window.__stageMeta ?? []);
    expect(
      meta.length,
      `${caseId} should expose stage metadata`,
    ).toBeGreaterThan(0);

    for (let i = 0; i < meta.length; i++) {
      const stage = meta[i] as StageMeta;
      const stageNum = i + 1;

      // Switch stages via the in-page API so we don't pay the build cost again.
      await page.evaluate((n) => {
        window.__caseStudyReady = false;
        window.__setStage?.(n);
      }, stageNum);

      await expect
        .poll(() => page.evaluate(() => window.__caseStudyReady === true), {
          timeout: 30_000,
          intervals: [200, 500],
        })
        .toBe(true);

      // Settle one extra animation frame so the canvas reflects the new stage.
      await page.evaluate(
        () => new Promise<void>((r) => requestAnimationFrame(() => r())),
      );

      const padded = String(stageNum).padStart(2, "0");
      const file = resolve(outDir, `${caseId}-stage-${padded}-${stage.id}.png`);
      await page.screenshot({ path: file, fullPage: false });
    }
  });
}
