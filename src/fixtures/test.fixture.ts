import { test as base, expect } from '@playwright/test';
import { DemoBlazeClient } from '../api/demoblaze-client.js';
import type { Account, Product } from '../api/schema.js';
import { environment } from '../config/environment.js';
import { newAccount } from '../data/account.js';
import { ApiClient } from '../helpers/api-client.js';
import { expectSignedIn } from '../helpers/assertions.js';
import { CartPage } from '../pages/cart.page.js';
import { LoginModal } from '../pages/components/login-modal.component.js';
import { Navbar } from '../pages/components/navbar.component.js';
import { OrderModal } from '../pages/components/order-modal.component.js';
import { HomePage } from '../pages/home.page.js';
import { ProductPage } from '../pages/product.page.js';

type WorkerFixtures = {
  /** Generic HTTP helper bound to API_URL. Use it for raw calls in API tests. */
  http: ApiClient;
  /** DemoBlaze business calls: register, login, catalog, cart. */
  api: DemoBlazeClient;
  /** One registered account per worker, with its API token. */
  identity: { account: Account; token: string };
};

type TestFixtures = {
  homePage: HomePage;
  productPage: ProductPage;
  cartPage: CartPage;
  navbar: Navbar;
  loginModal: LoginModal;
  orderModal: OrderModal;
  /** Empties the worker account's cart before and after the test. */
  cleanCart: void;
  /** Signs in by setting the session cookie, then opens the home page. Cart is cleaned around the test. */
  signInViaApi: () => Promise<void>;
  /** Signs in, puts the first `itemCount` catalog products in the cart and opens the order form. */
  startCheckout: (itemCount?: number) => Promise<Product[]>;
};

export const test = base.extend<TestFixtures, WorkerFixtures>({
  http: [
    async ({ playwright }, use) => {
      const request = await playwright.request.newContext({ baseURL: environment.apiURL, timeout: 15_000 });
      await use(new ApiClient(request));
      await request.dispose();
    },
    { scope: 'worker' },
  ],

  api: [async ({ http }, use) => use(new DemoBlazeClient(http)), { scope: 'worker' }],

  identity: [
    async ({ api }, use) => {
      const account = newAccount();
      await api.register(account);
      const token = await api.login(account);
      await use({ account, token });
    },
    { scope: 'worker' },
  ],

  cleanCart: async ({ api, identity }, use) => {
    await api.clear(identity.token);
    try {
      await use();
    } finally {
      await api.clear(identity.token);
    }
  },

  homePage: async ({ page }, use) => use(new HomePage(page)),
  productPage: async ({ page }, use) => use(new ProductPage(page)),
  cartPage: async ({ page }, use) => use(new CartPage(page)),
  navbar: async ({ page }, use) => use(new Navbar(page)),
  loginModal: async ({ page }, use) => use(new LoginModal(page)),
  orderModal: async ({ page }, use) => use(new OrderModal(page)),

  // cleanCart is listed only so that it runs; it has no value to use.
  signInViaApi: async ({ context, identity, homePage, navbar, cleanCart: _cleanCart }, use) => {
    await use(async () => {
      await context.addCookies([{ name: 'tokenp_', value: identity.token, url: environment.baseURL }]);
      await homePage.open();
      await expectSignedIn(navbar, identity.account.username);
    });
  },

  startCheckout: async ({ signInViaApi, api, identity, cartPage, orderModal }, use) => {
    await use(async (itemCount = 1) => {
      const products = (await api.catalog()).slice(0, itemCount);
      await signInViaApi();
      for (const product of products) await api.add(identity.token, product.id);
      await cartPage.open();
      await orderModal.open();
      return products;
    });
  },
});

export { expect };
