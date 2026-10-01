import { endpoints } from '../../src/api/endpoints.js';
import { environment } from '../../src/config/environment.js';
import { test, expect } from '../../src/fixtures/test.fixture.js';
import { expectAddedToCart, expectCart, expectProductDetails } from '../../src/helpers/assertions.js';
import { ProductPage } from '../../src/pages/product.page.js';

const addToCartUrl = `${environment.apiURL}${endpoints.addToCart}`;

test(
  'CART-001 CART-007 add an item and retain it after reload',
  { tag: '@smoke' },
  async ({ signInViaApi, productPage, cartPage, api }) => {
    const [product] = await api.catalog();
    await signInViaApi();
    await productPage.open(product.id);
    await expectProductDetails(productPage, product);
    expectAddedToCart(await productPage.addToCart());

    await cartPage.open();
    await expectCart(cartPage, [product]);
    await cartPage.open();
    await expectCart(cartPage, [product]);
  },
);

test(
  'CART-003 CART-005 multiple items total correctly and deletion updates total',
  { tag: ['@smoke', '@regression'] },
  async ({ signInViaApi, productPage, cartPage, api }) => {
    const products = (await api.catalog()).slice(0, 2);
    await signInViaApi();
    for (const product of products) {
      await productPage.open(product.id);
      await expectProductDetails(productPage, product);
      expectAddedToCart(await productPage.addToCart());
    }

    await cartPage.open();
    await expectCart(cartPage, products);
    await cartPage.deleteItem(products[0].title);
    await expectCart(cartPage, [products[1]]);
  },
);

test(
  'CART-004 repeated deliberate adds create two units',
  { tag: '@regression' },
  async ({ signInViaApi, productPage, cartPage, api }) => {
    const [product] = await api.catalog();
    await signInViaApi();
    await productPage.open(product.id);
    await expectProductDetails(productPage, product);
    expectAddedToCart(await productPage.addToCart());
    expectAddedToCart(await productPage.addToCart());

    await cartPage.open();
    await expectCart(cartPage, [product, product]);
  },
);

test(
  'CART-006 deleting the last item leaves an empty cart',
  { tag: '@regression' },
  async ({ signInViaApi, page, cartPage, api, identity }) => {
    const [product] = await api.catalog();
    await signInViaApi();
    await api.add(identity.token, product.id);
    await cartPage.open();
    await expectCart(cartPage, [product]);

    const deletion = page.waitForResponse((r) => r.url().endsWith(endpoints.deleteItem));
    await cartPage.deleteItem(product.title);
    await deletion;
    await expectCart(cartPage, []);
    expect(await api.cart(identity.token)).toEqual([]);
  },
);

test(
  'CART-015 failed add does not mutate cart; explicit retry adds once',
  { tag: '@regression' },
  async ({ signInViaApi, page, productPage, cartPage, api, identity }) => {
    const [product] = await api.catalog();
    await signInViaApi();
    await productPage.open(product.id);
    await expectProductDetails(productPage, product);

    await page.route(addToCartUrl, (route) => route.abort('failed'));
    const failure = page.waitForEvent('requestfailed', (r) => r.url() === addToCartUrl);
    await productPage.addToCartLink.click();
    await failure;
    expect(await api.cart(identity.token)).toEqual([]);

    await page.unroute(addToCartUrl);
    expectAddedToCart(await productPage.addToCart());
    await cartPage.open();
    await expectCart(cartPage, [product]);
  },
);

test(
  'CART-017 mobile cart supports two items, deletion and opening checkout',
  { tag: ['@mobile', '@smoke'] },
  async ({ signInViaApi, cartPage, orderModal, api, identity }) => {
    const products = (await api.catalog()).slice(0, 2);
    await signInViaApi();
    for (const product of products) await api.add(identity.token, product.id);

    await cartPage.open();
    await expectCart(cartPage, products);
    await cartPage.deleteItem(products[0].title);
    await expectCart(cartPage, [products[1]]);
    await expect
      .poll(async () => (await api.cart(identity.token)).map((item) => item.prod_id))
      .toEqual([products[1].id]);

    await orderModal.open();
    await expect(orderModal.total).toHaveText(`Total: ${products[1].price}`);
  },
);

// Known bug F-006. Fails against the live site until it is fixed; excluded from the default suites.
// The home page sets a per-visitor `user` cookie, the product page does not. A guest who lands
// directly on a product page sends cookie:"" and so shares one cart with every other such guest.
test(
  'CART-019 F-006 deep-linked guests must not share one cart',
  { tag: '@known-bug' },
  async ({ browser, api }, testInfo) => {
    const [product] = await api.catalog();
    const guestA = await browser.newContext();
    const guestB = await browser.newContext();
    let addedRowId: string | undefined;

    try {
      // Guest A opens the product page directly and adds the product.
      const pageA = await guestA.newPage();
      const productPageA = new ProductPage(pageA);
      await productPageA.open(product.id);
      await expect(productPageA.name).toHaveText(product.title);
      const addRequest = pageA.waitForRequest((r) => r.url().endsWith(endpoints.addToCart));
      expectAddedToCart(await productPageA.addToCart());
      const sent = (await addRequest).postDataJSON() as { id: string; cookie: string };
      addedRowId = sent.id;

      // Guest B opens the cart in a separate browser context.
      const pageB = await guestB.newPage();
      const [cartResponse] = await Promise.all([
        pageB.waitForResponse((r) => r.url().endsWith(endpoints.viewCart)),
        pageB.goto('/cart.html'),
      ]);
      const itemsSeenByB = (await cartResponse.json()).Items as { id: string }[];
      await testInfo.attach('guest-b-cart', { body: await pageB.screenshot(), contentType: 'image/png' });

      expect(
        itemsSeenByB.some((item) => item.id === addedRowId),
        "guest B must not see guest A's cart row",
      ).toBe(false);
      expect(sent.cookie, 'guest request must carry a per-visitor cookie').not.toBe('');
    } finally {
      // The guest cart is shared with other visitors, so remove only the row this test added.
      try {
        if (addedRowId) await api.delete(addedRowId);
      } finally {
        await guestA.close();
        await guestB.close();
      }
    }
  },
);
