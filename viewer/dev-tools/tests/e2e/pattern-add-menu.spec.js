import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const viewerDirectory = join(__dirname, '..', '..', '..');
const standaloneViewerPath = join(viewerDirectory, '..', 'event-model-viewer.html');
const templateTestPath = join(viewerDirectory, 'tests', 'full-slice-template.test.html');

test('the shared Add menu retains existing actions and offers each pattern', async ({ page }) => {
  await page.goto(`file:///${standaloneViewerPath.replace(/\\/g, '/')}`);

  const menu = page.locator('#addSliceContextMenu');
  await expect(menu.locator('[data-action]')).toHaveCount(6);
  await expect(menu.locator('[data-action="full-slice"]')).toHaveText('Full slice');
  await expect(menu.locator('[data-action="event-slice"]')).toHaveText('Event in empty slice');
  await expect(menu.locator('[data-action="command-pattern"]')).toHaveText('Command Pattern');
  await expect(menu.locator('[data-action="view-pattern"]')).toHaveText('View Pattern');
  await expect(menu.locator('[data-action="automation-pattern"]')).toHaveText('Automation Pattern');
  await expect(menu.locator('[data-action="translation-pattern"]')).toHaveText('Translation Pattern');
});

test('each pattern action adds a slice with its diagram elements', async ({ page }) => {
  await page.goto(`file:///${standaloneViewerPath.replace(/\\/g, '/')}`);
  await page.locator('#fileInput').setInputFiles({
    name: 'empty-pattern-model.emj',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ title: 'Patterns', slices: [] }))
  });

  const actions = [
    'command-pattern',
    'view-pattern',
    'automation-pattern',
    'translation-pattern'
  ];

  for (let index = 0; index < actions.length; index++) {
    await page.locator('#codeAddSliceBtn:visible, #treeAddSliceBtn:visible').first().click();
    await page.locator(`#addSliceContextMenu [data-action="${actions[index]}"]`).click();
    await expect(page.locator('.element.trigger')).toHaveCount(index + 1);
  }

  await expect(page.locator('.element.trigger')).toHaveCount(4);
  await expect(page.locator('.element.command')).toHaveCount(3);
  await expect(page.locator('.element.view')).toHaveCount(3);
  await expect(page.locator('.element.event')).toHaveCount(6);
});

test('pattern template browser tests pass', async ({ page }) => {
  await page.goto(`file:///${templateTestPath.replace(/\\/g, '/')}`);

  const results = page.locator('#testResults');
  await expect(results).toContainText('Translation Pattern marks only its input Event external');
  await expect(results).not.toContainText('FAIL');
});
