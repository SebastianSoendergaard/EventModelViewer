import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..', '..', '..', '..');

test.describe('Code editor diagram selection following', () => {
  test.beforeEach(async ({ page }) => {
    const indexPath = join(projectRoot, 'event-model-viewer.html');
    const fixturePath = join(projectRoot, 'viewer', 'dev-tools', 'tests', 'fixtures', 'simple-event-model.json');

    await page.goto(`file:///${indexPath.replace(/\\/g, '/')}`);
    await page.locator('#fileInput').setInputFiles(fixturePath);
    await page.waitForSelector('.event-model-diagram');
    await page.waitForTimeout(1200);
  });

  const cursor = page => page.evaluate(() => {
    const editor = window.ace.edit(document.getElementById('codeEditor'));
    const position = editor.getCursorPosition();
    return {
      row: position.row,
      line: editor.session.getLine(position.row)
    };
  });

  test('follows clicked elements only when enabled', async ({ page }) => {
    const followButton = page.locator('#codeFollowSelectionBtn');
    await expect(followButton).toHaveAttribute('aria-pressed', 'false');

    await page.locator('.element.command').first().click();
    const lineWhileDisabled = await cursor(page);

    await page.locator('.element.view').first().click();
    expect(await cursor(page)).toEqual(lineWhileDisabled);

    await followButton.click();
    await expect(followButton).toHaveAttribute('aria-pressed', 'true');

    await page.locator('.element.view').first().click();
    await expect.poll(async () => (await cursor(page)).line).toContain('Order Details');
  });

  test('locates selections in YAML documents', async ({ page }) => {
    const yamlPath = join(projectRoot, 'em.emy');
    await page.locator('#fileInput').setInputFiles(yamlPath);
    await page.waitForTimeout(1200);

    await page.locator('#codeFollowSelectionBtn').click();
    await page.locator('.element.view').first().click();
    await expect.poll(async () => (await cursor(page)).line).toContain('name: Cart items');
  });

  test('shares the toggle state and target with the tree editor', async ({ page }) => {
    await page.locator('#codeFollowSelectionBtn').click();
    await expect(page.locator('#treeFollowSelectionBtn')).toHaveAttribute('aria-pressed', 'true');

    await page.locator('.element.view').first().click();
    await page.locator('[data-tab="tree"]').click();

    await expect(page.locator('.tree-box.diagram-selection-target')).toContainText('Order Details');

    await page.locator('#treeFollowSelectionBtn').click();
    await expect(page.locator('#codeFollowSelectionBtn')).toHaveAttribute('aria-pressed', 'false');
  });
});
