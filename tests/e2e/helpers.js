import { expect } from '@playwright/test';

/**
 * Shared helpers for the end-to-end specs.
 */

/**
 * Creates a room and returns the room code.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} [name]
 * @returns {Promise<string>}
 */
export async function createRoom(page, name = 'Host') {
  await page.goto('/');
  await page.getByTestId('name-input').fill(name);
  await page.locator('[data-action="create-room"]').click();

  const code = page.getByTestId('room-code');
  await expect(code).toBeVisible({ timeout: 30_000 });

  const value = (await code.textContent())?.trim() ?? '';
  expect(value).toMatch(/^[A-Z0-9]{4}$/);
  return value;
}

/**
 * Joins a room and waits for the guest to be registered.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} code
 * @param {string} [name]
 */
export async function joinRoom(page, code, name = 'Guest') {
  await page.goto(`/?room=${code}`);

  // A first-time guest picks a name before joining.
  const nameField = page.getByTestId('name-input');
  if (await nameField.isVisible().catch(() => false)) {
    await nameField.fill(name);
    await page.locator('[data-action="join-room"]').click();
  }

  // The guest introduces itself as soon as the channel opens, and the Host
  // answers with a welcome that carries its identity.
  await page.waitForFunction(
    () => {
      const app = /** @type {any} */ (window).bullsCows;
      return Boolean(app && app.session && app.session.self);
    },
    undefined,
    { timeout: 40_000 },
  );

  // Give the host a moment to register the new player.
  await page.waitForTimeout(500);
}

/**
 * The secret number, read from the Host's own memory.
 *
 * The UI masks it during play, but the Host's state holds it. A test that
 * wants to drive the game to a win has to know it — exactly as a cheating
 * host would.
 *
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<string>}
 */
export async function secretOf(page) {
  const secret = await page.evaluate(() => {
    const app = /** @type {any} */ (window).bullsCows;
    return app?.state?.secret ?? null;
  });
  expect(secret).toBeTruthy();
  return /** @type {string} */ (secret);
}

/**
 * Enters a guess with the on-screen keypad.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} digits
 */
export async function typeGuess(page, digits) {
  for (const digit of digits) {
    // Sequential on purpose: each keypress must land before the next.
    // eslint-disable-next-line no-await-in-loop
    await page.locator(`[data-key="${digit}"]`).click();
  }
}

/**
 * Submits the current guess.
 *
 * @param {import('@playwright/test').Page} page
 */
export async function submitGuess(page) {
  await page.locator('[data-action="send-guess"]').click();
}
