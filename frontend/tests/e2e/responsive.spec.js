import { test, expect } from '@playwright/test';
import { signIn, assertNoHorizontalOverflow } from './helpers';

const viewports = [
  { name: 'small mobile 320x700', width: 320, height: 700 },
  { name: 'mobile 375x812', width: 375, height: 812 },
  { name: 'tablet 768x1024', width: 768, height: 1024 },
  { name: 'desktop 1366x768', width: 1366, height: 768 },
  { name: 'wide desktop 1920x1080', width: 1920, height: 1080 },
];

for (const viewport of viewports) {
  test(`dashboard and navigation fit ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await signIn(page);
    await expect(page.getByRole('heading', { name: 'Your financial snapshot' })).toBeVisible();
    await assertNoHorizontalOverflow(page);

    if (viewport.width <= 768) {
      await page.getByRole('button', { name: 'Open navigation' }).click();
      await expect(page.getByRole('link', { name: 'Transactions' })).toBeVisible();
      await page.getByRole('link', { name: 'Transactions' }).click();
    } else {
      await page.getByRole('link', { name: 'Transactions' }).click();
    }
    await expect(page.getByRole('heading', { name: 'Transactions' })).toBeVisible();
    await assertNoHorizontalOverflow(page);

    await page.getByRole('button', { name: 'Open banking assistant' }).click();
    await expect(page.getByRole('region', { name: 'Banking assistant' })).toBeVisible();
    await assertNoHorizontalOverflow(page);
    await page.screenshot({
      path: `test-results/responsive-${viewport.width}x${viewport.height}.png`,
      fullPage: true,
    });
  });
}
