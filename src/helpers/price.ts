/**
 * Reads the amount from the product page price, e.g. "$360 *includes tax" -> 360.
 * Returns null for anything that is not exactly one dollar amount.
 */
export function parsePrice(text: string): number | null {
  const match = text.trim().match(/^\$(\d+(?:\.\d+)?)\s*(?:\*includes tax)?$/);
  return match ? Number(match[1]) : null;
}
