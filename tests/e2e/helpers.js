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

  // Wait until the app has either asked for a name or gone straight in —
  // a player who has been here before skips the name.
  await page.waitForFunction(
    () => {
      const app = /** @type {any} */ (window).bullsCows;
      if (app?.session?.self) return true;
      return Boolean(document.querySelector('[data-screen="join"]'));
    },
    undefined,
    { timeout: 30_000 },
  );

  const nameField = page.getByTestId('name-input');
  if (await nameField.isVisible()) {
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

  // Give the host a moment to register the new player and publish the
  // updated state.
  await page.waitForTimeout(800);
}

/**
 * The secret number, read from the Host's own memory.
 *
 * The UI masks it during play, and the *broadcast* state never carries it
 * before the game ends — but the Host's session still holds it, because the
 * Host has to score every guess against it. A test that wants to drive the
 * game to a win has to know it, exactly as a cheating host would.
 *
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<string>}
 */
export async function secretOf(page) {
  const secret = await page.evaluate(() => {
    const app = /** @type {any} */ (window).bullsCows;
    return app?.session?.state?.secret ?? null;
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

/**
 * Opens a tab on the game screen.
 *
 * The tab bar only exists on a narrow viewport — on a wide screen every
 * panel is visible at once — so this is a no-op there.
 *
 * @param {import('@playwright/test').Page} page
 * @param {'players' | 'history' | 'chat'} tab
 */
export async function openTab(page, tab) {
  const button = page.locator(`[data-tab="${tab}"]`);
  if (await button.isVisible().catch(() => false)) {
    await button.click();
  }
}
