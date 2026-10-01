export type Account = { username: string; password: string };
export type Product = { id: number; title: string; price: number };
export type CartItem = { id: string; prod_id: number };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Checks the payload at runtime so a changed API response fails here, not later in a test. */
export function parseProduct(value: unknown): Product {
  const valid =
    isRecord(value) &&
    Number.isInteger(value.id) &&
    typeof value.title === 'string' &&
    value.title.trim() !== '' &&
    typeof value.price === 'number' &&
    Number.isFinite(value.price) &&
    value.price > 0;
  if (!valid) throw new Error(`Unexpected catalog product shape: ${JSON.stringify(value)}`);
  return value as Product;
}

export function parseCartItem(value: unknown): CartItem {
  const valid = isRecord(value) && typeof value.id === 'string' && value.id !== '' && Number.isInteger(value.prod_id);
  if (!valid) throw new Error(`Unexpected cart item shape: ${JSON.stringify(value)}`);
  return value as CartItem;
}
