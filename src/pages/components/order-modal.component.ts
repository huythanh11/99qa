import { expect, type Dialog, type Locator, type Page } from '@playwright/test';
import type { OrderDetails } from '../../data/order.js';

export type OrderOutcome = { kind: 'rejected' | 'success'; message: string };

export class OrderModal {
  readonly root: Locator;
  readonly total: Locator;
  readonly purchaseButton: Locator;
  readonly closeButton: Locator;
  readonly confirmation: Locator;
  private readonly fields: Record<keyof OrderDetails, Locator>;

  constructor(readonly page: Page) {
    this.root = page.locator('#orderModal');
    this.total = this.root.locator('#totalm');
    this.purchaseButton = this.root.getByRole('button', { name: 'Purchase', exact: true });
    // The header "x" button is also named Close, so match on the visible text too.
    this.closeButton = this.root.getByRole('button', { name: 'Close', exact: true }).filter({ hasText: /^Close$/ });
    this.confirmation = page.locator('.sweet-alert');
    this.fields = {
      name: this.root.locator('#name'),
      country: this.root.locator('#country'),
      city: this.root.locator('#city'),
      card: this.root.locator('#card'),
      month: this.root.locator('#month'),
      year: this.root.locator('#year'),
    };
  }

  async open() {
    await this.page.getByRole('button', { name: 'Place Order', exact: true }).click();
    await this.root.waitFor({ state: 'visible' });
  }

  async fill(details: OrderDetails) {
    for (const key of Object.keys(this.fields) as (keyof OrderDetails)[]) {
      await this.fields[key].fill(details[key]);
    }
  }

  async purchase() {
    await this.purchaseButton.click();
  }

  async close() {
    await this.closeButton.click();
  }

  /** Clicks OK on the success popup. The site then goes back to the home page. */
  async acknowledgeConfirmation() {
    // The popup ignores its OK callback until it gets the "visible" class, 500 ms after it opens.
    // An earlier click only closes the popup and the page stays on the cart.
    await expect(this.confirmation).toHaveClass(/\bvisible\b/);
    await this.confirmation.getByRole('button', { name: 'OK', exact: true }).click();
  }

  /**
   * Clicks Purchase and waits until the site either shows a rejection alert or the success popup.
   * Used by the known-bug tests, where the expected rejection may never come.
   */
  async submitOutcome(): Promise<OrderOutcome> {
    let rejection: string | undefined;
    const onDialog = async (dialog: Dialog) => {
      rejection = dialog.message();
      await dialog.accept();
    };
    this.page.on('dialog', onDialog);
    try {
      await this.purchase();
      await expect
        .poll(async () => rejection !== undefined || (await this.confirmation.isVisible()), {
          message: 'Purchase should end in a rejection alert or the success popup',
        })
        .toBe(true);
      if (await this.confirmation.isVisible()) {
        return { kind: 'success', message: await this.confirmation.innerText() };
      }
      return { kind: 'rejected', message: rejection! };
    } finally {
      this.page.off('dialog', onDialog);
    }
  }
}
