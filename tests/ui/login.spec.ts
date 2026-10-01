import { randomUUID } from 'node:crypto';
import type { Locator } from '@playwright/test';
import { endpoints } from '../../src/api/endpoints.js';
import { environment } from '../../src/config/environment.js';
import { test, expect } from '../../src/fixtures/test.fixture.js';
import { expectSignedIn } from '../../src/helpers/assertions.js';
import { alertFrom } from '../../src/helpers/dialogs.js';

const loginUrl = `${environment.apiURL}${endpoints.login}`;

test(
  'LOGIN-001 LOGIN-009 LOGIN-010 valid login, refresh and logout',
  { tag: ['@demo', '@smoke'] },
  async ({ page, homePage, loginModal, navbar, identity }) => {
    await test.step('Sign in through the UI', async () => {
      await homePage.open();
      await loginModal.loginAs(identity.account);
      await expectSignedIn(navbar, identity.account.username);
      await expect(loginModal.root).toBeHidden();
    });

    await test.step('Session survives refresh', async () => {
      await page.reload();
      await expectSignedIn(navbar, identity.account.username);
    });

    await test.step('Logout clears the session', async () => {
      await navbar.logout();
      await expect(navbar.welcome).toBeHidden();
      await page.reload();
      await expect(navbar.welcome).toBeHidden();
      const cookies = await page.context().cookies();
      expect(cookies.find((c) => c.name === 'tokenp_')).toBeUndefined();
    });
  },
);

const missingCredentials = [
  { id: 'LOGIN-004', username: '', password: '' },
  { id: 'LOGIN-005', username: '', password: 'example' },
  { id: 'LOGIN-006', username: 'example', password: '' },
];

for (const { id, username, password } of missingCredentials) {
  test(
    `${id} missing credentials remain unauthenticated`,
    { tag: '@regression' },
    async ({ page, homePage, loginModal, navbar }) => {
      await homePage.open();
      await loginModal.open();
      await loginModal.fill({ username, password });
      expect(await alertFrom(page, () => loginModal.submit())).toBe('Please fill out Username and Password.');
      await expect(loginModal.root).toBeVisible();
      await expect(navbar.welcome).toBeHidden();
    },
  );
}

test(
  'LOGIN-002 wrong password can be corrected without reload',
  { tag: '@smoke' },
  async ({ page, homePage, loginModal, navbar, identity }) => {
    await homePage.open();
    await loginModal.open();
    await loginModal.fill({ ...identity.account, password: `${identity.account.password}-wrong` });
    expect(await alertFrom(page, () => loginModal.submit())).toBe('Wrong password.');
    await expect(navbar.welcome).toBeHidden();

    await loginModal.fill(identity.account);
    await loginModal.submit();
    await expectSignedIn(navbar, identity.account.username);
  },
);

test(
  'LOGIN-003 unknown account is rejected',
  { tag: '@regression' },
  async ({ page, homePage, loginModal, navbar }) => {
    await homePage.open();
    await loginModal.open();
    await loginModal.fill({ username: `missing_${randomUUID()}`, password: 'NotAnAccount!' });
    expect(await alertFrom(page, () => loginModal.submit())).toBe('User does not exist.');
    await expect(navbar.welcome).toBeHidden();
  },
);

test('LOGIN-008 password input masks entered text', { tag: '@regression' }, async ({ homePage, loginModal }) => {
  await homePage.open();
  await loginModal.open();
  await expect(loginModal.password).toHaveAttribute('type', 'password');
});

test(
  'LOGIN-012 keyboard-only navigation can complete login',
  { tag: '@regression' },
  async ({ page, homePage, loginModal, navbar, identity, browserName, isMobile }) => {
    test.skip(isMobile, 'Needs a hardware keyboard. Mobile login is covered by LOGIN-018.');

    // Safari on macOS only tabs through links and buttons with Option+Tab.
    const tabKey = browserName === 'webkit' && process.platform === 'darwin' ? 'Alt+Tab' : 'Tab';
    const tabTo = async (target: Locator, maxPresses: number) => {
      for (let i = 0; i < maxPresses; i++) {
        if (await target.evaluate((el) => el === document.activeElement)) break;
        await page.keyboard.press(tabKey);
      }
      await expect(target).toBeFocused();
    };

    await homePage.open();
    // Keyboard only from here: no clicks and no focus() calls.
    await tabTo(navbar.loginLink, 15);
    await page.keyboard.press('Enter');
    await expect(loginModal.root).toBeVisible();
    await tabTo(loginModal.username, 8);
    await page.keyboard.type(identity.account.username);
    await tabTo(loginModal.password, 2);
    await page.keyboard.type(identity.account.password);
    await tabTo(loginModal.submitButton, 5);
    await page.keyboard.press('Enter');
    await expectSignedIn(navbar, identity.account.username);
  },
);

test(
  'LOGIN-015 failed login transport cannot authenticate and a retry recovers',
  { tag: '@regression' },
  async ({ page, homePage, loginModal, navbar, identity }) => {
    await homePage.open();
    await loginModal.open();
    await loginModal.fill(identity.account);

    await page.route(loginUrl, (route) => route.abort('failed'));
    const failure = page.waitForEvent('requestfailed', (r) => r.url() === loginUrl);
    await loginModal.submit();
    await failure;
    await expect(navbar.welcome).toBeHidden();
    await expect(loginModal.root).toBeVisible();

    await page.unroute(loginUrl);
    await loginModal.submit();
    await expectSignedIn(navbar, identity.account.username);
  },
);

test(
  'LOGIN-018 mobile navigation supports login and logout',
  { tag: ['@mobile', '@smoke'] },
  async ({ homePage, loginModal, navbar, identity }) => {
    await homePage.open();
    await loginModal.loginAs(identity.account);
    await expectSignedIn(navbar, identity.account.username);
    await navbar.logout();
    await expect(navbar.welcome).toBeHidden();
    await loginModal.open();
    await expect(loginModal.root).toBeVisible();
  },
);
