import { randomUUID } from 'node:crypto';
import type { Account } from '../api/schema.js';

/** Unique throwaway account. DemoBlaze has no delete-account endpoint, so names are never reused. */
export function newAccount(): Account {
  return {
    username: `qa_${randomUUID().replaceAll('-', '').slice(0, 20)}`,
    password: `Qa!${randomUUID()}`,
  };
}
