import { randomUUID } from 'node:crypto';
import { expect } from '@playwright/test';

import type { ApiClient } from '../helpers/api-client.js';
import { endpoints } from './endpoints.js';
import { parseCartItem, parseProduct, type Account, type CartItem, type Product } from './schema.js';

/** DemoBlaze business calls: accounts, catalog and cart. HTTP details live in ApiClient. */
export class DemoBlazeClient {
  constructor(private readonly http: ApiClient) {}

  /** The site sends the password base64-encoded. */
  encodeCredentials(account: Account): Account {
    return { username: account.username, password: Buffer.from(account.password, 'utf8').toString('base64') };
  }

  async register(account: Account): Promise<void> {
    const { body } = await this.http.post(endpoints.signup, { data: this.encodeCredentials(account) });
    expect(body, 'Signup of a new account').toBe('');
  }

  async login(account: Account): Promise<string> {
    const { body } = await this.http.post(endpoints.login, { data: this.encodeCredentials(account) });
    expect(body, 'Login returns a token').toEqual(expect.stringMatching(/^Auth_token: .+/));
    return (body as string).replace('Auth_token: ', '');
  }

  async catalog(): Promise<Product[]> {
    const { body } = await this.http.get<{ Items?: unknown[] }>(endpoints.entries);
    expect(body.Items, 'Catalog response contains Items').toEqual(expect.any(Array));
    expect(body.Items!.length).toBeGreaterThan(1);
    return body.Items!.map(parseProduct);
  }

  async cart(token: string): Promise<CartItem[]> {
    const { body } = await this.http.post<{ Items?: unknown[] }>(endpoints.viewCart, {
      data: { cookie: token, flag: true },
    });
    expect(body.Items, 'Cart response contains Items').toEqual(expect.any(Array));
    return body.Items!.map(parseCartItem);
  }

  /** Adds a product to the cart and returns the id of the new cart row. */
  async add(token: string, productId: number): Promise<string> {
    const id = randomUUID();
    const { body } = await this.http.post(endpoints.addToCart, {
      data: { id, cookie: token, prod_id: productId, flag: true },
    });
    expect(body, 'Add to cart returns an empty body').toBe('');
    return id;
  }

  async delete(id: string): Promise<void> {
    const { body } = await this.http.post(endpoints.deleteItem, { data: { id } });
    expect(body).toBe('Item deleted.');
  }

  async clear(token: string): Promise<void> {
    for (const item of await this.cart(token)) await this.delete(item.id);
    await expect.poll(async () => (await this.cart(token)).length, { message: 'Cart is empty after cleanup' }).toBe(0);
  }
}
