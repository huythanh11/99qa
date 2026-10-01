import type { Locator, Page } from '@playwright/test';
import { alertFrom } from '../helpers/dialogs.js';

export class ProductPage {
  readonly name: Locator;
  readonly price: Locator;
  readonly addToCartLink: Locator;

  constructor(readonly page: Page) {
    this.name = page.locator('.name');
    this.price = page.locator('.price-container');
    this.addToCartLink = page.getByRole('link', { name: 'Add to cart', exact: true });
  }

  async open(productId: number) {
    await this.page.goto(`/prod.html?idp_=${productId}`);
  }

  /** Clicks Add to cart and returns the text of the confirmation alert. */
  async addToCart(): Promise<string> {
    return alertFrom(this.page, () => this.addToCartLink.click());
  }
}
