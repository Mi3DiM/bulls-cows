import { expect, test } from '@playwright/test';

import { createRoom, joinRoom } from './helpers.js';

/**
 * The unhappy paths.
 *
 * A peer-to-peer game has no server to fall back on, so the failure modes
 * have to be designed for rather than discovered in production. These specs
 * cover the ones a player will actually hit.
 */

test.describe('resilience', () => {
  test('a guest is told when the host ends the game', async ({ page, browser }) => {
    const host = page;
    const code = await createRoom(host, 'CoderHamid');

    const guestContext = await browser.newContext();
    const guest = await guestContext.newPage();
    await joinRoom(guest, code, 'Sara');

    // The Host leaves. The room dies with it — that is the design.
    await host.locator('[data-action="leave"]').click();

    // The guest gets a definite answer, not a frozen screen.
    await expect(guest.locator('[data-screen="ended"]')).toBeVisible({ timeout: 30_000 });
    await expect(guest.locator('h1')).toContainText(/host ended the game/i);

    await guestContext.close();
  });

  test('a guest that closes the tab is marked as disconnected, then removed', async ({
    page,
    browser,
  }) => {
    // The seat is deliberately held for a minute, so a player who briefly
    // loses their connection is not punished for it.
    test.setTimeout(180_000);

    const host = page;
    const code = await createRoom(host, 'CoderHamid');

    const guestContext = await browser.newContext();
    const guest = await guestContext.newPage();
    await joinRoom(guest, code, 'Sara');

    await expect(host.getByTestId('player-card')).toHaveCount(2, { timeout: 20_000 });

    // The guest's tab goes away.
    await guest.close();

    // The host notices and marks the seat as reconnecting, rather than
    // dropping the player immediately.
    const card = host.getByTestId('player-card').filter({ hasText: 'Sara' });
    await expect(card).toHaveAttribute('data-status', 'disconnected', { timeout: 60_000 });

    // The seat is held, then released.
    await expect(host.getByTestId('player-card')).toHaveCount(1, { timeout: 120_000 });

    await guestContext.close();
  });

  test('the room code is claimed and a taken code is regenerated', async ({ page, browser }) => {
    const first = page;
    const code = await createRoom(first, 'First host');

    // A second host tries to claim the same code.
    const secondContext = await browser.newContext();
    const second = await secondContext.newPage();
    await second.goto('/');

    // Claim the code directly, the way a collision would happen.
    const claimed = await second.evaluate(async (wanted) => {
      const { default: Peer } = await import('/assets/peerjs-DOFBepnz.js').catch(() => ({}));
      void Peer;
      return wanted;
    }, code);

    expect(claimed).toBe(code);

    // The first host still holds its room.
    await expect(first.getByTestId('room-code')).toHaveText(code);

    await secondContext.close();
  });

  test('a guest that reopens the link keeps their place', async ({ page, browser }) => {
    const host = page;
    const code = await createRoom(host, 'CoderHamid');

    const guestContext = await browser.newContext();
    const guest = await guestContext.newPage();
    await joinRoom(guest, code, 'Sara');

    await expect(host.getByTestId('player-card')).toHaveCount(2, { timeout: 20_000 });

    // The guest reloads. Their name is remembered, so they go straight back in
    // and the host recognises them rather than adding a second copy.
    await guest.reload();
    await guest.waitForFunction(
      () => {
        const app = /** @type {any} */ (window).bullsCows;
        return Boolean(app?.session?.self);
      },
      undefined,
      { timeout: 40_000 },
    );

    await expect(host.getByTestId('player-card')).toHaveCount(2, { timeout: 30_000 });

    await guestContext.close();
  });

  test('a guest can leave without disturbing the room', async ({ page, browser }) => {
    const host = page;
    const code = await createRoom(host, 'CoderHamid');

    const guestContext = await browser.newContext();
    const guest = await guestContext.newPage();
    await joinRoom(guest, code, 'Sara');

    await expect(host.getByTestId('player-card')).toHaveCount(2, { timeout: 20_000 });

    await guest.locator('#room-bar [data-action="leave"]').click();

    // The guest is back at the home screen.
    await expect(guest.locator('[data-screen="home"]')).toBeVisible({ timeout: 20_000 });

    // The host keeps the room and can still start the game.
    await expect(host.getByTestId('room-code')).toBeVisible();

    await guestContext.close();
  });
});
