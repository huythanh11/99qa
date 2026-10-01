import { test, expect } from '@playwright/test';
import { OrderModal } from './order-modal.component.js';

test('submitOutcome waits for a success popup that appears late', async ({ page }) => {
  await page.setContent(`
    <div id="orderModal">
      <button onclick="setTimeout(() => document.querySelector('.sweet-alert').hidden = false, 350)">Purchase</button>
    </div>
    <div class="sweet-alert" hidden>Thank you</div>`);
  expect((await new OrderModal(page).submitOutcome()).kind).toBe('success');
});

test('submitOutcome reports the alert text as a rejection', async ({ page }) => {
  await page.setContent(`
    <div id="orderModal">
      <button onclick="alert('Please fill out Name and Creditcard.')">Purchase</button>
    </div>
    <div class="sweet-alert" hidden></div>`);
  expect(await new OrderModal(page).submitOutcome()).toEqual({
    kind: 'rejected',
    message: 'Please fill out Name and Creditcard.',
  });
});
