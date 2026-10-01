import { endpoints } from '../../src/api/endpoints.js';
import { environment } from '../../src/config/environment.js';
import { order } from '../../src/data/order.js';
import { test, expect } from '../../src/fixtures/test.fixture.js';
import { expectAddedToCart, expectCart, expectProductDetails, expectSignedIn } from '../../src/helpers/assertions.js';
import { alertFrom } from '../../src/helpers/dialogs.js';

test(
  'ORDER-001 ORDER-007 login, add to cart and place order',
  { tag: ['@demo', '@smoke'] },
  async (
    { page, homePage, loginModal, navbar, productPage, cartPage, orderModal, identity, api, cleanCart: _cleanCart },
    testInfo,
  ) => {
    const [product] = await api.catalog();

    await test.step('Login with valid credentials', async () => {
      await homePage.open();
      await loginModal.loginAs(identity.account);
      await expectSignedIn(navbar, identity.account.username);
    });

    await test.step('Add a product and check the cart', async () => {
      await homePage.openProduct(product.title);
      await expectProductDetails(productPage, product);
      expectAddedToCart(await productPage.addToCart());
      await cartPage.open();
      await expectCart(cartPage, [product]);
    });

    await test.step('Place the order and check the confirmation', async () => {
      await orderModal.open();
      await expect(orderModal.total).toHaveText(`Total: ${product.price}`);
      await orderModal.fill(order);
      await orderModal.purchase();
      await expect(orderModal.confirmation).toBeVisible();
      await expect(orderModal.confirmation).toContainText('Thank you for your purchase!');
      await expect(orderModal.confirmation).toContainText(`Amount: ${product.price} USD`);
      await expect(orderModal.confirmation).toContainText(`Name: ${order.name}`);
      await expect(orderModal.confirmation).toContainText(/Id: \d+/);
      await testInfo.attach('purchase-confirmation', { body: await page.screenshot(), contentType: 'image/png' });
    });

    await test.step('Cart is empty after the purchase', async () => {
      await expect.poll(async () => (await api.cart(identity.token)).length).toBe(0);
      await orderModal.acknowledgeConfirmation();
      await expect(page).toHaveURL(/\/index\.html$/);
      await cartPage.open();
      await expectCart(cartPage, []);
    });
  },
);

test(
  'ORDER-002 multi-item checkout reconciles the summed total',
  { tag: ['@smoke', '@regression'] },
  async ({ signInViaApi, cartPage, orderModal, api, identity }) => {
    const products = (await api.catalog()).slice(0, 3);
    const total = products.reduce((sum, p) => sum + p.price, 0);
    await signInViaApi();
    for (const product of products) await api.add(identity.token, product.id);
    await cartPage.open();
    await expectCart(cartPage, products);

    await orderModal.open();
    await expect(orderModal.total).toHaveText(`Total: ${total}`);
    await orderModal.fill(order);
    await orderModal.purchase();
    await expect(orderModal.confirmation).toContainText(`Amount: ${total} USD`);
    await expect.poll(async () => (await api.cart(identity.token)).length).toBe(0);
  },
);

const missingRequiredField = [
  { id: 'ORDER-003', field: 'name' },
  { id: 'ORDER-004', field: 'card' },
] as const;

for (const { id, field } of missingRequiredField) {
  test(
    `${id} checkout rejects missing ${field} and retains cart`,
    { tag: '@regression' },
    async ({ startCheckout, page, orderModal, api, identity }) => {
      await startCheckout();
      await orderModal.fill({ ...order, [field]: '' });
      expect(await alertFrom(page, () => orderModal.purchase())).toBe('Please fill out Name and Creditcard.');
      await expect(orderModal.confirmation).toBeHidden();
      expect(await api.cart(identity.token)).toHaveLength(1);
    },
  );
}

test(
  'ORDER-006 cancelling checkout preserves the cart',
  { tag: '@regression' },
  async ({ startCheckout, cartPage, orderModal }) => {
    const [product] = await startCheckout();
    await orderModal.fill(order);
    await orderModal.close();
    await expect(orderModal.root).toBeHidden();
    await expectCart(cartPage, [product]);
  },
);

// Known bugs below (@known-bug). Each test asserts the behaviour a customer should get, so it fails
// against the live site until the bug is fixed. Default suites skip the tag; run `npm run test:known-bugs`.

test(
  'ORDER-010 F-001 empty cart must not produce purchase success',
  { tag: '@known-bug' },
  async ({ signInViaApi, page, cartPage, orderModal, api, identity }, testInfo) => {
    await signInViaApi();
    await cartPage.open();
    await expectCart(cartPage, []);
    await orderModal.open();
    await orderModal.fill(order);

    const outcome = await orderModal.submitOutcome();
    await testInfo.attach('empty-cart-checkout', { body: await page.screenshot(), contentType: 'image/png' });
    expect(outcome.kind, outcome.message).toBe('rejected');
    expect(outcome.message).toMatch(/cart|empty|item/i);
    expect(await api.cart(identity.token)).toEqual([]);
  },
);

test(
  'ORDER-011 F-002 confirmation date must match the browser date',
  { tag: '@known-bug' },
  async ({ startCheckout, page, orderModal }, testInfo) => {
    await startCheckout();
    await orderModal.fill(order);
    const today = await page.evaluate(() => {
      const d = new Date();
      return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
    });

    await orderModal.purchase();
    await expect(orderModal.confirmation).toBeVisible();
    await testInfo.attach('receipt-date', { body: await page.screenshot(), contentType: 'image/png' });
    await expect(orderModal.confirmation).toContainText(`Date: ${today}`);
  },
);

test(
  'ORDER-012 F-003 failed cart clearing must not claim successful checkout',
  { tag: '@known-bug' },
  async ({ startCheckout, page, orderModal, api, identity }, testInfo) => {
    await startCheckout();
    await orderModal.fill(order);
    await page.route(`${environment.apiURL}${endpoints.deleteCart}`, (route) =>
      route.fulfill({ status: 503, body: 'Unavailable' }),
    );
    const failedResponse = page.waitForResponse((r) => r.url().endsWith(endpoints.deleteCart) && r.status() === 503);

    const outcome = await orderModal.submitOutcome();
    await failedResponse;
    expect(await api.cart(identity.token)).toHaveLength(1);
    await testInfo.attach('false-success', { body: await page.screenshot(), contentType: 'image/png' });
    expect(outcome.kind, outcome.message).toBe('rejected');
    expect(outcome.message).toMatch(/fail|unavailable|retry|unable/i);
  },
);

const invalidCards = [
  { label: 'non-numeric card', card: 'not-a-card-number' },
  { label: 'single-digit card', card: '1' },
];

for (const { label, card } of invalidCards) {
  test(
    `ORDER-008 F-004 checkout must reject ${label}`,
    { tag: '@known-bug' },
    async ({ startCheckout, page, orderModal, api, identity }, testInfo) => {
      await startCheckout();
      await orderModal.fill({ ...order, card });

      const outcome = await orderModal.submitOutcome();
      await testInfo.attach(`F-004-${label}`, { body: await page.screenshot(), contentType: 'image/png' });
      expect(outcome.kind, outcome.message).toBe('rejected');
      expect(outcome.message).toMatch(/card|format|invalid/i);
      expect(await api.cart(identity.token)).toHaveLength(1);
    },
  );
}

test(
  'ORDER-009 F-005 checkout must reject an expired card date',
  { tag: '@known-bug' },
  async ({ startCheckout, page, orderModal, api, identity }, testInfo) => {
    await startCheckout();
    await orderModal.fill({ ...order, month: '01', year: '2000' });

    const outcome = await orderModal.submitOutcome();
    await testInfo.attach('F-005-expired-card', { body: await page.screenshot(), contentType: 'image/png' });
    expect(outcome.kind, outcome.message).toBe('rejected');
    expect(outcome.message).toMatch(/expir|date|month|year/i);
    expect(await api.cart(identity.token)).toHaveLength(1);
  },
);
