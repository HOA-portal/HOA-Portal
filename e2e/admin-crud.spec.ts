import { test, expect, type Page } from '@playwright/test'

// NOTE: These tests require a seeded test database with a known admin account.
// Set TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD as environment variables in CI
// and locally via a .env.test.local file.
const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL ?? ''
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD ?? ''

// Skip all admin CRUD tests when credentials are not available
test.beforeEach(async ({}, testInfo) => {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    testInfo.skip(true, 'TEST_ADMIN_EMAIL / TEST_ADMIN_PASSWORD not set — skipping admin CRUD tests')
  }
})

async function loginAsAdmin(page: Page) {
  await page.goto('/login')
  await page.fill('input[type="email"]', ADMIN_EMAIL)
  await page.fill('input[type="password"]', ADMIN_PASSWORD)
  await page.getByRole('button', { name: /sign in/i }).click()
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 })
}

test.describe('Admin — Work Orders', () => {
  test('work orders page loads and shows table', async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto('/admin/work-orders')
    await expect(page.getByRole('heading', { name: /work orders/i })).toBeVisible()
  })

  test('opening a work order shows detail modal', async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto('/admin/work-orders')
    const firstRow = page.locator('table tbody tr').first()
    await firstRow.click()
    // Modal should open
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 })
    await expect(page.getByRole('button', { name: /save/i })).toBeVisible()
  })
})

test.describe('Admin — Announcements', () => {
  test('announcements page loads', async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto('/admin/announcements')
    await expect(page.getByRole('button', { name: /new announcement/i })).toBeVisible()
  })

  test('new announcement modal opens and closes', async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto('/admin/announcements')
    await page.getByRole('button', { name: /new announcement/i }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.getByRole('button', { name: /cancel/i }).click()
    await expect(page.getByRole('dialog')).not.toBeVisible()
  })
})

test.describe('Admin — Violations', () => {
  test('violations page loads', async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto('/admin/violations')
    await expect(page.getByRole('heading', { name: /violations/i })).toBeVisible()
  })
})

test.describe('Admin — Complaints', () => {
  test('complaints page loads', async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto('/admin/complaints')
    await expect(page.getByRole('heading', { name: /complaints/i })).toBeVisible()
  })
})
