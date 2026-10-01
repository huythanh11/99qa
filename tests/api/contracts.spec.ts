import { randomUUID } from 'node:crypto';
import { endpoints } from '../../src/api/endpoints.js';
import { newAccount } from '../../src/data/account.js';
import { test, expect } from '../../src/fixtures/test.fixture.js';

test('API-001 catalog exposes usable product IDs, names and prices', { tag: '@smoke' }, async ({ api }) => {
  // catalog() already checks the shape of each product, so only uniqueness is left.
  const products = await api.catalog();
  expect(new Set(products.map((p) => p.id)).size).toBe(products.length);
});

test(
  'API-002 LOGIN-002 invalid password returns a business error',
  { tag: '@smoke' },
  async ({ http, api, identity }) => {
    const wrong = { ...identity.account, password: 'wrong-password' };
    const { status, body } = await http.post(endpoints.login, { data: api.encodeCredentials(wrong) });
    expect(status).toBe(200);
    expect(body).toEqual({ errorMessage: 'Wrong password.' });
  },
);

test(
  'API-003 CART-010 cart mutations are isolated from another identity',
  { tag: ['@smoke', '@regression'] },
  async ({ api, identity, cleanCart: _cleanCart }) => {
    const second = newAccount();
    await api.register(second);
    const secondToken = await api.login(second);
    const [product] = await api.catalog();
    try {
      const itemId = await api.add(identity.token, product.id);
      await expect
        .poll(() => api.cart(identity.token))
        .toContainEqual(expect.objectContaining({ id: itemId, prod_id: product.id }));
      expect(await api.cart(secondToken)).toEqual([]);
      await api.delete(itemId);
      expect(await api.cart(identity.token)).toEqual([]);
    } finally {
      await api.clear(secondToken);
    }
  },
);

test(
  'API-004 valid token resolves to its owner; malformed token is a business error',
  { tag: '@regression' },
  async ({ http, identity }) => {
    const valid = await http.post(endpoints.check, { data: { token: identity.token } });
    expect(valid.body).toMatchObject({ Item: { username: identity.account.username, token: identity.token } });

    const malformed = { errorMessage: 'Bad parameter, token malformed.' };
    const check = await http.post(endpoints.check, { data: { token: 'not-a-token' } });
    expect(check.body).toEqual(malformed);
    const viewCart = await http.post(endpoints.viewCart, { data: { cookie: 'not-a-token', flag: true } });
    expect(viewCart.body).toEqual(malformed);
  },
);

test('API-005 missing required parameters are rejected by name', { tag: '@regression' }, async ({ http }) => {
  const viewCart = await http.post(endpoints.viewCart, { data: { flag: true } });
  expect(viewCart).toEqual({ status: 200, body: { errorMessage: 'Bad parameter, missing cookie' } });
  const login = await http.post(endpoints.login, { data: {} });
  expect(login).toEqual({ status: 200, body: { errorMessage: 'Bad parameter, missing username' } });
});

test('API-006 unknown cart row and product IDs return Not found', { tag: '@regression' }, async ({ http }) => {
  const notFound = { errorMessage: 'Not found.' };
  const deleteItem = await http.post(endpoints.deleteItem, { data: { id: randomUUID() } });
  expect(deleteItem.body).toEqual(notFound);
  const view = await http.post(endpoints.view, { data: { id: '999999999' } });
  expect(view.body).toEqual(notFound);
});

// Known bug F-009. Fails against the live API until it is fixed; excluded from the default suites.
test(
  'API-007 F-009 empty credential and token values must return a business error, not a server error',
  { tag: '@known-bug' },
  async ({ http }) => {
    const emptyValues: [string, object][] = [
      [endpoints.login, { username: '', password: '' }],
      [endpoints.check, { token: '' }],
      [endpoints.viewCart, { cookie: '', flag: true }],
    ];
    for (const [path, data] of emptyValues) {
      const { status } = await http.post(path, { data, expectOk: false });
      expect.soft(status, `${path} with an empty value`).toBeLessThan(500);
    }
  },
);
