import { test, expect } from '@playwright/test';
import { signIn, installRuntimeErrorGuards } from './helpers';

test('real UI supports dashboard navigation, transaction search, and key workflows', async ({
  page,
}) => {
  const failures = [];
  await installRuntimeErrorGuards(page, failures);
  await signIn(page);

  await expect(page.getByText('Fictional demo balance')).toBeVisible();
  await page.getByRole('link', { name: 'Transactions' }).click();
  await expect(page.getByRole('heading', { name: 'Transactions' })).toBeVisible();
  await page.locator('.filters').getByPlaceholder('Search transactions…').fill('FreshMart');
  await expect(page.getByText('FreshMart Groceries')).toBeVisible();
  await expect(page.getByText('Salary Deposit')).toHaveCount(0);

  await page.getByRole('link', { name: 'Transfer', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Transfer money' })).toBeVisible();
  await page.getByLabel('Amount').fill('-1');
  await page.getByRole('button', { name: /review transfer/i }).click();
  await expect(page.getByRole('alert')).toContainText('valid amount');
  await page.getByLabel('Amount').fill('12.50');
  await page.getByRole('button', { name: /review transfer/i }).click();
  await expect(page.getByRole('heading', { name: 'Review transfer' })).toBeVisible();
  await page.getByRole('button', { name: /confirm demo transfer/i }).click();
  await expect(
    page.getByRole('heading', { name: 'Transfer simulated successfully' }),
  ).toBeVisible();
  await expect(page.getByText('No money moved.')).toBeVisible();

  await page.getByRole('button', { name: 'Open banking assistant' }).click();
  await expect(page.getByRole('region', { name: 'Banking assistant' })).toBeVisible();
  await page.getByRole('button', { name: 'What is my current balance?' }).click();
  await expect(
    page.getByText(/TEST PROVIDER \(not AI\): The fictional demo total balance is \$37,340\.55/i),
  ).toBeVisible();

  expect(failures, failures.join('\n')).toEqual([]);
});

test('beneficiary add/edit and card freeze controls work in the actual UI', async ({ page }) => {
  await signIn(page);
  await page.getByRole('link', { name: 'Beneficiaries' }).click();
  await page.getByRole('button', { name: /add beneficiary/i }).click();
  await page.getByLabel('Recipient name').fill('Taylor Demo');
  await page.getByLabel('Bank name').fill('Example Demo Bank');
  await page.getByLabel('Last four digits of demo account').fill('1234');
  await page.getByRole('button', { name: 'Save demo details' }).click();
  await expect(page.getByRole('heading', { name: 'Taylor Demo' })).toBeVisible();

  await page.getByRole('link', { name: 'Cards' }).click();
  const firstCard = page.locator('.card-management').first();
  await firstCard.getByRole('button', { name: /freeze demo card/i }).click();
  await expect(firstCard.getByRole('button', { name: /unfreeze demo card/i })).toBeVisible();
});

test('unknown routes show a not-found page instead of a blank screen', async ({ page }) => {
  await page.goto('/route-that-does-not-exist');
  await expect(page.getByText(/page not found|not found/i).first()).toBeVisible();
});

test('bill payment review and confirmation use the live API', async ({ page }) => {
  await signIn(page);
  await page.getByRole('link', { name: 'Bill payments' }).click();
  await expect(page.getByRole('heading', { name: 'Bill payments' })).toBeVisible();
  await page.getByRole('button', { name: /review payment/i }).click();
  await expect(page.getByRole('heading', { name: 'Review bill payment' })).toBeVisible();
  await page.getByRole('button', { name: /confirm demo payment/i }).click();
  await expect(page.getByRole('heading', { name: 'Bill payment simulated' })).toBeVisible();
  await expect(page.getByText(/no real payment was sent/i)).toBeVisible();
});

test('chatbot displays a clear message when its API request fails', async ({ page }) => {
  await signIn(page);
  await page.route('**/api/chat', (route) => route.abort('failed'));
  await page.getByRole('button', { name: 'Open banking assistant' }).click();
  await page.getByRole('button', { name: 'What is my current balance?' }).click();
  await expect(page.getByText(/cannot connect to the demo api/i)).toBeVisible();
});

test('notification and settings controls respond to user actions', async ({ page }) => {
  await signIn(page);
  await page.getByRole('link', { name: 'Notifications' }).click();
  await expect(page.getByRole('heading', { name: 'Notifications' })).toBeVisible();
  await page
    .getByRole('button', { name: /mark read/i })
    .first()
    .click();
  await expect(page.getByRole('button', { name: /mark read/i })).toHaveCount(1);

  await page.getByRole('link', { name: 'Settings' }).click();
  const notificationsToggle = page.getByRole('button', { name: 'Disable notifications' });
  await expect(notificationsToggle).toHaveAttribute('aria-pressed', 'true');
  await notificationsToggle.click();
  await expect(page.getByRole('button', { name: 'Enable notifications' })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
});
