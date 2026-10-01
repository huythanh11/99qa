import type { Locator, Page } from '@playwright/test';

export class Navbar {
  readonly welcome: Locator;
  readonly loginLink: Locator;
  readonly logoutLink: Locator;

  constructor(readonly page: Page) {
    this.welcome = page.locator('#nameofuser');
    this.loginLink = page.locator('#login2');
    this.logoutLink = page.locator('#logout2');
  }

  /** On narrow viewports the links sit behind the hamburger toggle. */
  private async follow(link: Locator) {
    if (!(await link.isVisible())) await this.page.getByRole('button', { name: 'Toggle navigation' }).click();
    await link.click();
  }

  async openLogin() {
    await this.follow(this.loginLink);
  }

  async logout() {
    await this.follow(this.logoutLink);
  }
}
