import type { Page } from '@playwright/test';

/** Runs an action that opens a native alert, accepts it, and returns its message. */
export async function alertFrom(page: Page, action: () => Promise<unknown>): Promise<string> {
  const dialogPromise = page.waitForEvent('dialog');
  const actionPromise = action();
  const dialog = await dialogPromise;
  const message = dialog.message();
  await dialog.accept();
  await actionPromise;
  return message;
}
