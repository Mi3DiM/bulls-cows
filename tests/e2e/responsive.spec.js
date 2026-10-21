import { expect, test } from '@playwright/test';

import { createRoom, openTab } from './helpers.js';

/**
 * The mobile layout.
 *
 * The game is played on phones more than anywhere else, so the narrow
 * layout gets its own spec: no horizontal overflow, the room code always
 * visible, the keypad reachable, and the tab bar switching panels.
 */

test.describe('mobile', () => {
  test('the home screen fits the viewport', async ({ page }) => {
    await page.goto('/');

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test('the room code stays visible at the top of every screen', async ({ page }) => {
    await createRoom(page, 'CoderHamid');

    const bar = page.locator('#room-bar');
    await expect(bar).toBeVisible();
    await expect(bar).toContainText(/[A-Z0-9]{4}/);

    // Still visible once the game starts.
    await page.locator('[data-action="start-game"]').click();
    await expect(page.locator('[data-screen="game"]')).toBeVisible();
    await expect(bar).toBeVisible();
  });

  test('the game screen fits the viewport', async ({ page }) => {
    await createRoom(page, 'CoderHamid');
    await page.locator('[data-action="start-game"]').click();
    await expect(page.locator('[data-screen="game"]')).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test('the tab bar switches between the panels', async ({ page }) => {
    await createRoom(page, 'CoderHamid');
    await page.locator('[data-action="start-game"]').click();
    await expect(page.locator('[data-screen="game"]')).toBeVisible();

    const tabBar = page.getByTestId('tab-bar');
    await expect(tabBar).toBeVisible();

    await openTab(page, 'history');
    await expect(page.getByTestId('attempts-board')).toBeVisible();

    await openTab(page, 'chat');
    await expect(page.getByTestId('chat-input')).toBeVisible();

    await openTab(page, 'players');
    await expect(page.getByTestId('player-list')).toBeVisible();
  });

  test('the keypad targets are big enough to tap', async ({ page }) => {
    await createRoom(page, 'CoderHamid');
    await page.locator('[data-action="start-game"]').click();
    await expect(page.locator('[data-screen="game"]')).toBeVisible();

    const tooSmall = await page.evaluate(() => {
      const keys = Array.from(document.querySelectorAll('[data-key]'));
      return keys
        .map((key) => {
          const rect = key.getBoundingClientRect();
          return { label: key.getAttribute('data-key'), width: rect.width, height: rect.height };
        })
        .filter((key) => key.width < 44 || key.height < 44);
    });

    expect(tooSmall).toEqual([]);
  });
});
