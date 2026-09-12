import { expect, type Page } from '@playwright/test';
import { config } from './config.js';
import type { RunLog } from './log.js';

export async function runBasicAddToCart(page: Page, log: RunLog) {
  log.add(`Opening ${config.siteUrl}`);
  await page.goto(config.siteUrl, { waitUntil: 'domcontentloaded' });

  log.add('Going to shop page');
  await page.getByRole('link', { name: /shop/i }).first().click();
  await page.waitForLoadState('networkidle').catch(() => undefined);

  log.add('Opening first visible product');
  const productLink = page.locator('a[href^="/product/"]').first();
  await expect(productLink).toBeVisible({ timeout: 15000 });
  await productLink.click();
  await page.waitForLoadState('networkidle').catch(() => undefined);

  log.add('Adding product to cart');
  const addButton = page.getByRole('button', { name: /add to cart/i }).first();
  await expect(addButton).toBeVisible({ timeout: 15000 });
  await addButton.click();

  log.add('Checking cart UI appeared');
  await expect(page.getByText(/continue shopping/i).first()).toBeVisible({
    timeout: 15000
  });
}
