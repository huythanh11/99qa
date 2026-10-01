import type { Locator, Page } from '@playwright/test';

export class HomePage {
  readonly productCards: Locator;

  constructor(readonly page: Page) {
    this.productCards = page.locator('#tbodyid .card');
  }

  async open() {
    // Third-party assets can hold back the load event, so wait for the first product card instead.
    await this.page.goto('/', { waitUntil: 'domcontentloaded' });
    await this.productCards.first().waitFor({ state: 'visible' });
  }

  async openProduct(title: string) {
    await this.page.locator('#tbodyid').getByRole('link', { name: title, exact: true }).click();
  }
}
