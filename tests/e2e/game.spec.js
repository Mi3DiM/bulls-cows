import { expect, test } from '@playwright/test';

import { createRoom, joinRoom, openTab, secretOf, submitGuess, typeGuess } from './helpers.js';

test.describe('game', () => {
  test('a full round reaches the win screen', async ({ page, browser }) => {
    const host = page;
    const code = await createRoom(host, 'CoderHamid');

    const guestContext = await browser.newContext();
    const guest = await guestContext.newPage();
    await joinRoom(guest, code, 'Sara');

    // The Host starts the game.
    await host.locator('[data-action="start-game"]').click();
    await expect(host.locator('[data-screen="game"]')).toBeVisible();

    // The secret is known to the Host's own memory, which is how a test
    // drives the game to a win.
    const secret = await secretOf(host);
    expect(secret).toMatch(/^\d{4}$/);

    // The Host plays first.
    await expect(host.getByTestId('turn-text')).toContainText(/your turn/i);
    await typeGuess(host, secret);
    await submitGuess(host);

    // The win screen is shown, with the secret revealed.
    await expect(host.locator('[data-screen="result"]')).toBeVisible({ timeout: 20_000 });
    await expect(host.getByTestId('secret')).toHaveText(secret);
    await expect(host.locator('h1')).toContainText(/you cracked it/i);

    // The guest sees it too.
    await expect(guest.locator('[data-screen="result"]')).toBeVisible({ timeout: 20_000 });

    await guestContext.close();
  });

  test('a wrong guess is scored and the turn advances', async ({ page, browser }) => {
    const host = page;
    const code = await createRoom(host, 'CoderHamid');

    const guestContext = await browser.newContext();
    const guest = await guestContext.newPage();
    await joinRoom(guest, code, 'Sara');

    await host.locator('[data-action="start-game"]').click();
    await expect(host.locator('[data-screen="game"]')).toBeVisible();

    const secret = await secretOf(host);

    // A guess that is definitely wrong.
    const wrong = secret === '0247' ? '1359' : '0247';
    await typeGuess(host, wrong);
    await submitGuess(host);

    // The attempt appears in the Host's column, with its bulls and cows.
    const attempt = host.locator(`[data-attempt="${wrong}"]`).first();
    await expect(attempt).toBeVisible({ timeout: 15_000 });

    // The turn has passed to the guest.
    await expect(host.getByTestId('turn-text')).toContainText(/Sara/, { timeout: 15_000 });

    // The guest can now guess.
    await expect(guest.getByTestId('turn-text')).toContainText(/your turn/i, { timeout: 15_000 });

    await guestContext.close();
  });

  test('the attempts board shows one column per player', async ({ page, browser }) => {
    const host = page;
    const code = await createRoom(host, 'CoderHamid');

    const guestContext = await browser.newContext();
    const guest = await guestContext.newPage();
    await joinRoom(guest, code, 'Sara');

    await host.locator('[data-action="start-game"]').click();
    await expect(host.locator('[data-screen="game"]')).toBeVisible();

    // One column per player.
    await expect(host.locator('[data-column-player]')).toHaveCount(2);

    const secret = await secretOf(host);
    const wrong = secret === '0247' ? '1359' : '0247';
    await typeGuess(host, wrong);
    await submitGuess(host);

    // The attempt lands in the Host's column.
    const hostColumn = host.locator('[data-column-player]').first();
    await expect(hostColumn.locator(`[data-attempt="${wrong}"]`)).toBeVisible({ timeout: 15_000 });

    await guestContext.close();
  });

  test('a chat message reaches the other player', async ({ page, browser }) => {
    const host = page;
    const code = await createRoom(host, 'CoderHamid');

    const guestContext = await browser.newContext();
    const guest = await guestContext.newPage();
    await joinRoom(guest, code, 'Sara');

    await host.locator('[data-action="start-game"]').click();
    await expect(host.locator('[data-screen="game"]')).toBeVisible();

    // Switch to the chat tab.
    await openTab(host, 'chat');

    await host.getByTestId('chat-input').fill('Go Hamed!');
    await host.getByTestId('chat-input').press('Enter');

    await expect(host.getByTestId('chat-log')).toContainText('Go Hamed!', { timeout: 15_000 });

    // The guest sees it in their log.
    await openTab(guest, 'chat');
    await expect(guest.getByTestId('chat-log')).toContainText('Go Hamed!', { timeout: 15_000 });

    await guestContext.close();
  });

  test('the leaderboard shows both players', async ({ page, browser }) => {
    const host = page;
    const code = await createRoom(host, 'CoderHamid');

    const guestContext = await browser.newContext();
    const guest = await guestContext.newPage();
    await joinRoom(guest, code, 'Sara');

    await host.locator('[data-action="start-game"]').click();
    await expect(host.locator('[data-screen="game"]')).toBeVisible();

    await openTab(host, 'history');
    await expect(host.getByTestId('leaderboard-list').locator('li')).toHaveCount(2);

    await guestContext.close();
  });

  test('a player who is not on turn cannot guess', async ({ page, browser }) => {
    const host = page;
    const code = await createRoom(host, 'CoderHamid');

    const guestContext = await browser.newContext();
    const guest = await guestContext.newPage();
    await joinRoom(guest, code, 'Sara');

    await host.locator('[data-action="start-game"]').click();
    await expect(host.locator('[data-screen="game"]')).toBeVisible();

    // It is the Host's turn, so the guest's keypad is inert — and says so.
    await expect(guest.locator('[data-key="5"]')).toBeDisabled();
    await expect(host.locator('[data-key="5"]')).toBeEnabled();

    // The send button stays disabled until the guess is complete.
    await expect(host.locator('[data-action="send-guess"]')).toBeDisabled();
    await typeGuess(host, '1359');
    await expect(host.locator('[data-action="send-guess"]')).toBeEnabled();

    await guestContext.close();
  });
});
