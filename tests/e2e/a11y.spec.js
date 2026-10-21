import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { createRoom, joinRoom } from './helpers.js';

/**
 * Accessibility gate (G7).
 *
 * axe-core checks the rendered page. Every screen that a player can reach
 * is checked, in the state a player would actually see it in.
 */

/** @type {import('@playwright/test').Page} */
let page;

test.beforeEach(async ({ browser }) => {
  const context = await browser.newContext();
  page = await context.newPage();
});

/**
 * Runs axe against the page and fails on a serious or critical violation.
 *
 * @param {import('@playwright/test').Page} target
 */
async function expectNoViolations(target) {
  const results = await new AxeBuilder({ page: target })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  const serious = results.violations.filter(
    (violation) => violation.impact === 'critical' || violation.impact === 'serious',
  );

  const summary = serious
    .map(
      (violation) =>
        `${violation.id} (${violation.impact}): ${violation.help}\n  ${violation.nodes
          .map((node) => node.target.join(' '))
          .join('\n  ')}`,
    )
    .join('\n');

  expect(summary, `Accessibility violations:\n${summary}`).toBe('');
}

test.describe('accessibility', () => {
  test('the home screen has no serious violations', async () => {
    await page.goto('/');
    await expect(page.locator('[data-screen="home"]')).toBeVisible();
    await expectNoViolations(page);
  });

  test('the join screen has no serious violations', async () => {
    await page.goto('/?room=K7P4');
    await expect(page.locator('[data-screen="join"]')).toBeVisible();
    await expectNoViolations(page);
  });

  test('the waiting room has no serious violations', async () => {
    await createRoom(page, 'CoderHamid');
    await expect(page.locator('[data-screen="room"]')).toBeVisible();
    await expectNoViolations(page);
  });

  test('the game screen has no serious violations', async () => {
    await createRoom(page, 'CoderHamid');
    await page.locator('[data-action="start-game"]').click();
    await expect(page.locator('[data-screen="game"]')).toBeVisible();
    await expectNoViolations(page);
  });

  test('the result screen has no serious violations', async () => {
    await createRoom(page, 'CoderHamid');
    await page.locator('[data-action="start-game"]').click();
    await expect(page.locator('[data-screen="game"]')).toBeVisible();

    // The Host solves it, which reveals the result screen.
    const secret = await page.evaluate(() => {
      const app = /** @type {any} */ (window).bullsCows;
      return app?.session?.state?.secret ?? null;
    });
    expect(secret).toBeTruthy();

    for (const digit of String(secret)) {
      await page.locator(`[data-key="${digit}"]`).click();
    }
    await page.locator('[data-action="send-guess"]').click();

    await expect(page.locator('[data-screen="result"]')).toBeVisible({ timeout: 20_000 });
    await expectNoViolations(page);
  });

  test('the chat and the attempts board have no serious violations', async () => {
    const code = await createRoom(page, 'CoderHamid');

    const context = await page.context().browser()?.newContext();
    const guest = await context?.newPage();
    expect(guest).toBeTruthy();
    await joinRoom(/** @type {any} */ (guest), code, 'Sara');

    await page.locator('[data-action="start-game"]').click();
    await expect(page.locator('[data-screen="game"]')).toBeVisible();

    // Fill the chat so the panel has real content to be judged on.
    await page.getByTestId('chat-input').fill('Go Hamed!');
    await page.getByTestId('chat-input').press('Enter');
    await expect(page.getByTestId('chat-log')).toContainText('Go Hamed!');

    await expectNoViolations(page);

    await context?.close();
  });
});
