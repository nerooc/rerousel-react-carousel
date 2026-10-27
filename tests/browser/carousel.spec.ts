import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function position(page: Page) {
  return page.getByRole('region', { name: 'Fixture carousel' }).evaluate((el) => Math.abs(el.scrollLeft));
}
async function next(page: Page) {
  const previous = await position(page);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect.poll(() => position(page)).not.toBe(previous);
  await page.waitForTimeout(500);
}

test('live state, refs, IDs and inputs survive repeated forward/backward loops', async ({ page }) => {
  await page.goto('/tests/fixture.html');
  await page.getByRole('button', { name: 'Count 0: 0' }).click();
  await page.getByLabel('Note 0').fill('Keep my input');
  await page.getByLabel('Note 0').evaluate((el) => {
    (el as HTMLInputElement).dataset.identity = 'original';
  });
  for (let i = 0; i < 8; i++) await next(page);
  await page.getByRole('region', { name: 'Fixture carousel' }).focus();
  await page.keyboard.press('Home');
  await expect.poll(() => position(page)).toBe(0);
  await expect(page.getByRole('button', { name: 'Count 0: 1' })).toBeVisible();
  await expect(page.getByLabel('Note 0')).toHaveValue('Keep my input');
  await expect(page.getByLabel('Note 0')).toHaveAttribute('data-identity', 'original');
  expect(await page.locator('#note-0').count()).toBe(1);
  await page.getByRole('button', { name: 'Previous', exact: true }).click();
  await expect.poll(() => position(page)).toBeGreaterThan(100);
});

test('native keyboard navigation, descendants and RTL work', async ({ page }) => {
  await page.goto('/tests/fixture.html?rtl=true');
  const carousel = page.getByRole('region', { name: 'Fixture carousel' });
  await carousel.focus();
  await page.keyboard.press('ArrowLeft');
  await expect.poll(() => position(page)).toBeGreaterThan(100);
  await page.waitForTimeout(500);
  await page.keyboard.press('Home');
  await expect.poll(() => position(page)).toBe(0);
  await page.getByLabel('Note 0').fill('abc');
  const before = await position(page);
  await page.keyboard.press('ArrowLeft');
  await page.waitForTimeout(100);
  expect(await position(page)).toBe(before);
  await expect(page.getByLabel('Note 0')).toBeFocused();
  await expect(page.getByLabel('Note 0')).toHaveValue('abc');
});

test('autoplay pauses on focus and resumes when focus leaves', async ({ page, isMobile }) => {
  await page.goto('/tests/fixture.html?auto=true');
  // Move the desktop pointer away so hover does not mask the focus check.
  if (!isMobile) await page.mouse.move(1, 1);
  await expect.poll(() => position(page), { timeout: 4000 }).toBeGreaterThan(100);
  await page.getByLabel('Note 1').focus();
  await page.waitForTimeout(600);
  const focused = await position(page);
  await page.waitForTimeout(1300);
  expect(await position(page)).toBe(focused);
  await expect(page.getByLabel('Note 1')).toBeFocused();
  await page.getByRole('button', { name: 'Outside', exact: true }).focus();
  await expect.poll(() => position(page), { timeout: 4000 }).not.toBe(focused);
});

test('reduced motion disables autoplay and makes manual navigation immediate', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/tests/fixture.html?auto=true');
  await page.waitForTimeout(1300);
  expect(await position(page)).toBe(0);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  expect(await position(page)).toBeGreaterThan(100);
});

test('finite mode, responsive widths and dynamic children remain usable', async ({ page }) => {
  await page.goto('/tests/fixture.html');
  await page.getByRole('button', { name: 'Loop: true' }).click();
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.waitForTimeout(700);
  const before = await position(page);
  await page.getByRole('button', { name: 'Resize', exact: true }).click();
  await page.getByRole('button', { name: 'Remove slide' }).click();
  await expect(page.locator('[data-slide]')).toHaveCount(3);
  await page.getByRole('region', { name: 'Fixture carousel' }).focus();
  await page.keyboard.press('End');
  const end = await position(page);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.waitForTimeout(600);
  expect(await position(page)).toBe(end);
  expect(before).toBeGreaterThan(0);
});

test('demo settings, code copy, interactive slides and accessibility work', async ({
  page,
  context,
  browserName,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?paused=true');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Your content.');
  await page.getByLabel('Interactive', { exact: true }).check();
  await page.getByRole('button', { name: 'Add one' }).click();
  await expect(page.locator('.counter-value')).toHaveText('1');
  await page.locator('#interval').fill('4500');
  await page.getByLabel('Loop at the end').uncheck();
  await expect(page.locator('#example pre')).toContainText('interval={4500}');
  await expect(page.locator('#example pre')).toContainText('loop={false}');
  expect(page.url()).toContain('demo=interactive');
  expect(page.url()).toContain('interval=4500');
  if (browserName === 'chromium') {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.getByRole('button', { name: 'Copy command' }).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('npm install rerousel');
  }
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(results.violations).toEqual([]);
  expect(errors).toEqual([]);
});

test('demo fits desktop, tablet, phone and landscape without overflow', async ({ page }) => {
  for (const [width, height] of [
    [1440, 900],
    [768, 1024],
    [390, 844],
    [375, 812],
    [844, 390],
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto('/?paused=true');
    await page.evaluate(() => document.fonts.ready);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  }
});

test('a real native touch swipe scrolls the carousel', async ({ browser, browserName }) => {
  test.skip(
    browserName !== 'chromium',
    'CDP touch dispatch is Chromium-specific; mobile WebKit is covered by the remaining interaction tests.',
  );
  const context = await browser.newContext({
    hasTouch: true,
    isMobile: true,
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4173/tests/fixture.html');
  const box = await page.getByRole('region', { name: 'Fixture carousel' }).boundingBox();
  if (!box) throw new Error('Missing carousel');
  const session = await context.newCDPSession(page);
  const x = box.x + box.width - 30;
  const y = box.y + 24;
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  for (let i = 1; i <= 10; i++) {
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: x - i * 24, y }],
    });
    await page.waitForTimeout(20);
  }
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect.poll(() => position(page)).toBeGreaterThan(100);
  expect(await page.evaluate(() => window.scrollX)).toBe(0);
  await context.close();
});
