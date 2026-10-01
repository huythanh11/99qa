import { expect } from '@playwright/test';
import type { Product } from '../api/schema.js';
import type { CartPage, CartRow } from '../pages/cart.page.js';
import type { Navbar } from '../pages/components/navbar.component.js';
import type { ProductPage } from '../pages/product.page.js';
import { parsePrice } from './price.js';

/** After login the site reloads and then checks the token, which can be slow on the public API. */
export async function expectSignedIn(navbar: Navbar, username: string, timeout = 25_000) {
  await expect(navbar.welcome).toHaveText(`Welcome ${username}`, { timeout });
}

export async function expectProductDetails(productPage: ProductPage, product: Product) {
  await expect(productPage.name).toHaveText(product.title);
  await expect.poll(async () => parsePrice(await productPage.price.innerText())).toBe(product.price);
}

export function expectAddedToCart(alertMessage: string) {
  expect(alertMessage).toMatch(/^Product added\.?$/);
}

/** Cart rows and total must match the catalog data of the given products, in any order. */
export async function expectCart(cartPage: CartPage, products: Product[]) {
  await expect(cartPage.rows).toHaveCount(products.length);

  const byTitle = (a: CartRow, b: CartRow) => (a.title ?? '').localeCompare(b.title ?? '');
  const expectedRows: CartRow[] = products.map((p) => ({ title: p.title, price: p.price }));
  expect((await cartPage.contents()).sort(byTitle)).toEqual(expectedRows.sort(byTitle));

  if (products.length === 0) {
    // An empty cart shows a blank total.
    await expect(cartPage.total).toHaveText(/^(0)?$/);
    return;
  }
  const sum = products.reduce((total, p) => total + p.price, 0);
  await expect(cartPage.total).toHaveText(String(sum));
}
