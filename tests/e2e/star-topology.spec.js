import { expect, test } from '@playwright/test';

import { createRoom, joinRoom } from './helpers.js';

test.describe('star topology', () => {
  test('one host and four guests all connect', async ({ page, browser }) => {
    const host = page;
    const code = await createRoom(host, 'CoderHamid');

    const contexts = [];
    const guests = [];

    for (let i = 0; i < 4; i += 1) {
      const context = await browser.newContext();
      const guest = await context.newPage();
      await joinRoom(guest, code, `Player ${i + 1}`);
      contexts.push(context);
      guests.push(guest);
    }

    // The Host sees five players: itself and four guests.
    await expect(host.getByTestId('player-card')).toHaveCount(5, { timeout: 30_000 });

    // Every guest sees the whole table too.
    for (const guest of guests) {
      await expect(guest.getByTestId('player-card')).toHaveCount(5, { timeout: 30_000 });
    }

    // And the attempts board has a column for each of them.
    await host.locator('[data-action="start-game"]').click();
    await expect(host.locator('[data-screen="game"]')).toBeVisible();
    await expect(host.locator('[data-column-player]')).toHaveCount(5, { timeout: 20_000 });

    for (const context of contexts) {
      await context.close();
    }
  });
});
