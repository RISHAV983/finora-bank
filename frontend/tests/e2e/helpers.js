import { expect } from '@playwright/test';

export async function signIn(page) {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Sign in to Finora' })).toBeVisible();
  await page.getByLabel('Email address').fill('e2e-finora@example.test');
  await page.getByLabel('Password').fill('e2e-demo-password');
  await page.getByRole('button', { name: /^sign in/i }).click();
  await expect(page.getByRole('heading', { name: 'Your financial snapshot' })).toBeVisible();
}

export async function installRuntimeErrorGuards(page, failures) {
  page.on('pageerror', (error) => failures.push(`Uncaught page error: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') failures.push(`Console error: ${message.text()}`);
  });
  page.on('requestfailed', (request) => {
    const url = request.url();
    if (url.includes('/api/'))
      failures.push(
        `Failed API request: ${request.method()} ${url} (${request.failure()?.errorText || 'unknown error'})`,
      );
  });
}

export async function assertNoHorizontalOverflow(page) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(
    dimensions.scrollWidth,
    `Unexpected horizontal overflow: ${JSON.stringify(dimensions)}`,
  ).toBeLessThanOrEqual(dimensions.clientWidth + 1);
}
