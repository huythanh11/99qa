import { expect, type Locator, type Page } from '@playwright/test';
import { endpoints } from '../api/endpoints.js';

export type CartRow = { title?: string; price: number };

export class CartPage {
  readonly rows: Locator;
  readonly total: Locator;

  constructor(readonly page: Page) {
    this.rows = page.locator('#tbodyid tr');
    this.total = page.locator('#totalp');
  }

  /** Opens the cart and waits until the table shows one row per item in the /viewcart response. */
  async open() {
    const [response] = await Promise.all([
      this.page.waitForResponse((r) => r.url().endsWith(endpoints.viewCart) && r.request().method() === 'POST'),
      this.page.goto('/cart.html'),
    ]);
    const items: unknown = (await response.json()).Items;
    if (!Array.isArray(items)) throw new Error('Cart response has no Items array');
    await expect(this.rows).toHaveCount(items.length);
  }

  row(title: string) {
    return this.rows.filter({ has: this.page.getByRole('cell', { name: title, exact: true }) });
  }

  async deleteItem(title: string) {
    await this.row(title).getByRole('link', { name: 'Delete' }).click();
  }

  /** Title and price of every row. Columns are: picture, title, price, delete link. */
  async contents(): Promise<CartRow[]> {
    return this.rows.evaluateAll((rows) =>
      rows.map((row) => ({
        title: row.children[1].textContent?.trim(),
        price: Number(row.children[2].textContent),
      })),
    );
  }
}
