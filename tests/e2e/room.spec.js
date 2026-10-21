import { expect, test } from '@playwright/test';

import { createRoom, joinRoom } from './helpers.js';

test.describe('room', () => {
  test('the host creates a room and sees the code', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('[data-screen="home"]')).toBeVisible();
    await expect(page.getByTestId('room-code-input')).toBeVisible();

    await page.getByTestId('name-input').fill('CoderHamid');
    await page.locator('[data-action="create-room"]').click();

    const code = page.getByTestId('room-code');
    await expect(code).toBeVisible({ timeout: 30_000 });
    await expect(code).toHaveText(/^[A-Z0-9]{4}$/);

    // The room bar is pinned at the top on every screen.
    await expect(page.locator('#room-bar')).toContainText(/[A-Z0-9]{4}/);
  });

  test('a guest joins with the code and the host sees them', async ({ page, browser }) => {
    const host = page;
    const code = await createRoom(host, 'CoderHamid');

    // A separate browser context, so the guest has its own storage and is
    // asked for a name — exactly like a guest on another device.
    const guestContext = await browser.newContext();
    const guest = await guestContext.newPage();
    await joinRoom(guest, code, 'Sara');

    // The host's player list grows to two.
    await expect(host.getByTestId('player-card')).toHaveCount(2);
    await expect(host.getByTestId('player-name').filter({ hasText: 'Sara' })).toBeVisible();

    await guestContext.close();
  });

  test('the share link carries the room code', async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-action="create-room"]').click();

    await expect(page.getByTestId('room-code')).toBeVisible({ timeout: 30_000 });

    const url = new URL(page.url());
    expect(url.searchParams.get('room')).toMatch(/^[A-Z0-9]{4}$/);
  });

  test('a guest who opens the share link lands in the room', async ({ page, browser }) => {
    const code = await createRoom(page, 'Host');

    const guestContext = await browser.newContext();
    const guest = await guestContext.newPage();
    await guest.goto(`/?room=${code}`);

    await expect(guest.locator('[data-screen="join"]')).toBeVisible();
    await expect(guest.locator('#room-bar')).toContainText(code, { timeout: 30_000 });

    await guestContext.close();
  });

  test('an unknown room code is reported clearly', async ({ page }) => {
    // A well-formed code that nobody is hosting.
    await page.goto('/?room=QQQQ');

    // The guest picks a name and tries to join.
    await page.getByTestId('name-input').fill('Guest');
    await page.locator('[data-action="join-room"]').click();

    // The room does not exist, so the guest gets a definite answer rather
    // than an endless spinner.
    await expect(page.locator('[data-screen="ended"]')).toBeVisible({ timeout: 40_000 });
    await expect(page.locator('h1')).toContainText(/room not found/i);
  });

  test('a malformed room code in the link is reported on the home screen', async ({ page }) => {
    // "O" and "I" are not in the code alphabet, so this can never be a room.
    await page.goto('/?room=OOII');

    await expect(page.locator('[data-screen="home"]')).toBeVisible();
    await expect(page.getByTestId('join-error')).toBeVisible();
  });

  test('an invalid room code is rejected on the home screen', async ({ page }) => {
    await page.goto('/');

    await page.getByTestId('room-code-input').fill('OOII');
    await page.locator('[data-action="join-room"]').click();

    await expect(page.getByTestId('join-error')).toBeVisible();
    await expect(page.locator('[data-screen="home"]')).toBeVisible();
  });
});
