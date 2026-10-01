import { test, expect } from '@playwright/test';
import { parseCartItem, parseProduct } from './schema.js';

test('schema parsers accept valid payloads and reject malformed ones', () => {
  expect(parseProduct({ id: 1, title: 'Phone', price: 360 })).toMatchObject({ id: 1, price: 360 });
  expect(() => parseProduct({ id: 1, title: 'Phone', price: '360' })).toThrow('catalog product');
  expect(() => parseProduct({ id: '1', title: ' ', price: 360 })).toThrow('catalog product');
  expect(() => parseCartItem({ id: 'row', prod_id: '1' })).toThrow('cart item');
  expect(() => parseCartItem(null)).toThrow('cart item');
});
