import type { Locator, Page } from '@playwright/test';
import type { Account } from '../../api/schema.js';
import { Navbar } from './navbar.component.js';

export class LoginModal {
  readonly root: Locator;
  readonly username: Locator;
  readonly password: Locator;
  readonly submitButton: Locator;
  private readonly navbar: Navbar;

  constructor(readonly page: Page) {
    this.root = page.locator('#logInModal');
    this.username = this.root.locator('#loginusername');
    this.password = this.root.locator('#loginpassword');
    this.submitButton = this.root.getByRole('button', { name: 'Log in', exact: true });
    this.navbar = new Navbar(page);
  }

  async open() {
    await this.navbar.openLogin();
    await this.root.waitFor({ state: 'visible' });
  }

  async fill(account: Account) {
    await this.username.fill(account.username);
    await this.password.fill(account.password);
  }

  async submit() {
    await this.submitButton.click();
  }

  async loginAs(account: Account) {
    await this.open();
    await this.fill(account);
    await this.submit();
  }
}
