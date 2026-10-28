import { test, expect } from '@playwright/test';

const baseUrl = 'https://practice.expandtesting.com';
const validUsername = process.env.TOVERNI_TEST_USERNAME;
const validPassword = process.env.TOVERNI_TEST_PASSWORD;

// Use explicitly approved test data, never credentials scraped from a site.
test.beforeEach(async ({ page }) => {
  test.skip(!validUsername || !validPassword,
    'Set TOVERNI_TEST_USERNAME and TOVERNI_TEST_PASSWORD with approved demo credentials.');
  await page.goto(`${baseUrl}/login`);
  await expect(page.getByRole('button', { name: 'Login', exact: true })).toBeVisible();
});

test('successful login shows secure area and logout', async ({ page }) => {
  await page.getByLabel('Username', { exact: true }).fill(validUsername!);
  await page.getByLabel('Password', { exact: true }).fill(validPassword!);
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page).toHaveURL(`${baseUrl}/secure`);
  await expect(page.getByText('You logged into a secure area!', { exact: false })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Logout' })).toBeVisible();
});

test('invalid username is rejected', async ({ page }) => {
  await page.getByLabel('Username', { exact: true }).fill('wrongUser');
  await page.getByLabel('Password', { exact: true }).fill(validPassword!);
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page).toHaveURL(`${baseUrl}/login`);
  await expect(page.getByRole('alert')).toContainText(/invalid username/i);
});

test('invalid password is rejected', async ({ page }) => {
  await page.getByLabel('Username', { exact: true }).fill(validUsername!);
  await page.getByLabel('Password', { exact: true }).fill('WrongPassword');
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page).toHaveURL(`${baseUrl}/login`);
  await expect(page.getByRole('alert')).toContainText(/invalid password/i);
});
