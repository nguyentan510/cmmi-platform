import { expect, test } from '@playwright/test';

test('real API: sign in, create/edit content, filter, calendar, keys, settings and mobile', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.getByLabel('Email', { exact: true }).fill('browser@example.com');
  await page.getByLabel('Password', { exact: true }).fill('BrowserFixturePassword123!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Content workspace' })).toBeVisible();
  await page.getByRole('button', { name: 'New content' }).click();
  await page.getByLabel('Title', { exact: true }).fill('A real end-to-end story');
  await page
    .getByLabel('Body', { exact: true })
    .fill('Created through the browser, persisted by the API.');
  await page.getByRole('button', { name: 'Save content' }).click();
  await expect(page.getByText('A real end-to-end story', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Edit A real end-to-end story', exact: true }).click();
  await page.getByRole('combobox', { name: 'Status', exact: true }).selectOption('SCHEDULED');
  const now = new Date();
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T14:00`;
  await page.getByLabel('Scheduled at · local time', { exact: true }).fill(date);
  await page.getByRole('button', { name: 'Save content' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Calendar view' }).click();
  await expect(page.getByText('A real end-to-end story', { exact: true })).toBeVisible();
  await page.screenshot({ path: 'test-results/workspace-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'API keys', exact: true }).click();
  await page.getByLabel('Key name').fill('Acceptance agent');
  await page.getByRole('button', { name: 'Create key' }).click();
  await expect(page.getByRole('dialog')).toContainText('cmmi_live_');
  await page.getByRole('button', { name: 'I saved this key' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('Acceptance agent', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByLabel('Retention days', { exact: true }).fill('14');
  await page.getByRole('button', { name: 'Save settings' }).click();
  await expect(page.getByRole('status')).toContainText('Settings saved');
  await page.getByRole('button', { name: 'Content workspace', exact: true }).click();
  await page.getByRole('link', { name: 'Meet your workspace' }).click();
  await expect(page.getByRole('heading', { name: 'Help & docs' })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('button', { name: 'Content workspace', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Content workspace' })).toBeVisible();
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 390);
  await expect(page.locator('html')).toHaveJSProperty('scrollWidth', 390);
  await page.screenshot({ path: 'test-results/workspace-mobile.png', fullPage: true });
  expect(errors).toEqual([]);
});
