import { test, expect } from '@playwright/test';
import { parsePrice } from './price.js';

test('price parser reads the full amount and accepts the tax suffix', () => {
  expect(parsePrice('$360 *includes tax')).toBe(360);
  expect(parsePrice('$360')).toBe(360);
  expect(parsePrice('$3600 *includes tax')).toBe(3600);
  expect(parsePrice(' $790.5 *includes tax ')).toBe(790.5);
});

test('price parser rejects text that is not exactly one dollar amount', () => {
  for (const text of ['360', '$', 'Price: $360', '$360 USD', '$360 $3600', ''])
    expect(parsePrice(text), text).toBeNull();
});
