import { expect, test } from '@playwright/test';

import { createRoom, openTab } from './helpers.js';

/**
 * The Arabic locale and the right-to-left layout.
 *
 * Switching locale flips the document direction, so the whole layout has to
 * mirror. These specs check that it does, and that nothing overflows
 * horizontally when it does.
 */

test.describe('Arabic and right-to-left', () => {
  test('the language toggle switches the locale and the direction', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');

    await page.locator('[data-locale="ar"]').click();

    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');

    // The interface is in Arabic.
    await expect(page.locator('h1')).toContainText('ثور');
  });

  test('the choice survives a reload', async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-locale="ar"]').click();
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');

    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  });

  test('the layout mirrors and does not overflow', async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-locale="ar"]').click();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test('the game screen mirrors without overflowing', async ({ page }) => {
    await createRoom(page, 'CoderHamid');

    await page.locator('[data-locale="ar"]').click();
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');

    await page.locator('[data-action="start-game"]').click();
    await expect(page.locator('[data-screen="game"]')).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);

    // The interface is in Arabic.
    await expect(page.getByTestId('turn-text')).toContainText('دورك');
  });

  test('a guest can join and play in Arabic', async ({ page, browser }) => {
    const host = page;
    const code = await createRoom(host, 'CoderHamid');

    const guestContext = await browser.newContext();
    const guest = await guestContext.newPage();
    await guest.goto(`/?room=${code}`);

    await guest.getByTestId('name-input').fill('سارة');
    await guest.locator('[data-action="join-room"]').click();
    await guest.locator('[data-locale="ar"]').click();
    await expect(guest.locator('html')).toHaveAttribute('dir', 'rtl');

    await host.locator('[data-action="start-game"]').click();
    await expect(guest.locator('[data-screen="game"]')).toBeVisible({ timeout: 20_000 });

    await openTab(guest, 'history');
    await expect(guest.getByTestId('attempts-board')).toBeVisible();

    await guestContext.close();
  });
});
