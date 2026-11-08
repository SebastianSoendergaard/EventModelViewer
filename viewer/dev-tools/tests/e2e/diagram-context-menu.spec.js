import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..', '..', '..', '..');

test.describe('Diagram context menu', () => {
  test.beforeEach(async ({ page }) => {
    const indexPath = join(projectRoot, 'event-model-viewer.html');
    const fixturePath = join(projectRoot, 'viewer', 'dev-tools', 'tests', 'fixtures', 'simple-event-model.json');

    await page.goto(`file:///${indexPath.replace(/\\/g, '/')}`);
    await page.locator('#fileInput').setInputFiles(fixturePath);
    await page.waitForSelector('.event-model-diagram');
    await page.waitForTimeout(1200);
  });

  test('adds a slice from the diagram background', async ({ page }) => {
    await page.locator('#diagram').click({ button: 'right', position: { x: 10, y: 10 } });
    const menu = page.locator('.diagram-context-menu');
    await expect(menu.locator('button')).toHaveCount(1);
    await menu.locator('[data-context-menu-action="add-slice"]').click();

    await expect(page.locator('.slice-header')).toHaveCount(3);
    await expect(page.locator('.slice-header').last()).toContainText('New slice');
  });

  test('offers slice element actions and adds an event', async ({ page }) => {
    await page.locator('.slice-header').first().click({ button: 'right' });
    const menu = page.locator('.diagram-context-menu');
    await expect(menu.locator('button')).toHaveCount(10);
    expect(await menu.locator('button').allTextContents()).toEqual([
      'Edit',
      'Delete',
      'Add Trigger',
      'Add view',
      'Add command',
      'Add event',
      'Add note',
      'Add hotspot',
      'Add test',
      'Add slice'
    ]);

    await menu.locator('[data-context-menu-action="add-event"]').click();
    await expect(page.locator('.element.event')).toHaveCount(1);
    await expect(page.locator('.element.event').first()).toContainText('New Event');
  });

  test('edits and deletes a slice from its context menu', async ({ page }) => {
    const slice = page.locator('.slice-header').first();
    await slice.click({ button: 'right' });
    const menu = page.locator('.diagram-context-menu');
    await expect(menu.locator('button').first()).toHaveText('Edit');
    await expect(menu.locator('button').nth(1)).toHaveText('Delete');

    await menu.locator('[data-context-menu-action="edit-element"]').click();
    await expect(page.locator('[data-inline-editor]')).toBeVisible();
    await page.locator('[data-inline-editor] .inline-edit-actions button:first-child').click();

    await slice.click({ button: 'right' });
    await page.locator('.diagram-context-menu [data-context-menu-action="delete-element"]').click();
    await expect(page.locator('.slice-header')).toHaveCount(1);
  });

  test('adds test items from Given, When, and Then context menus', async ({ page }) => {
    await page.locator('.slice-header').first().click({ button: 'right' });
    await page.locator('.diagram-context-menu [data-context-menu-action="add-test"]').click();
    await expect(page.locator('.test-case')).toHaveCount(2);

    const given = page.locator('[data-context-menu-test-section="given"]').last();
    await given.click({ button: 'right' });
    await expect(page.locator('.diagram-context-menu button')).toHaveText(['Add event']);
    await page.locator('.diagram-context-menu [data-context-menu-action="add-test-event"]').click();

    const when = page.locator('[data-context-menu-test-section="when"]').last();
    await when.click({ button: 'right' });
    await expect(page.locator('.diagram-context-menu button')).toHaveText(['Add command']);
    await page.locator('.diagram-context-menu [data-context-menu-action="add-test-command"]').click();

    const then = page.locator('[data-context-menu-test-section="then"]').last();
    await then.click({ button: 'right' });
    await page.locator('.diagram-context-menu [data-context-menu-action="add-test-event"]').click();
    await then.click({ button: 'right' });
    await page.locator('.diagram-context-menu [data-context-menu-action="add-test-view"]').click();

    const testCase = page.locator('.test-case').last();
    await expect(testCase.locator('.test-event')).toHaveCount(2);
    await expect(testCase.locator('.test-command')).toHaveCount(1);
    await expect(testCase.locator('.test-view')).toHaveCount(1);

    await testCase.locator('.test-event').first().click({ button: 'right' });
    await expect(page.locator('.diagram-context-menu button')).toHaveText(['Edit', 'Delete']);
    await page.locator('.diagram-context-menu [data-context-menu-action="edit-element"]').click();
    const itemEditor = page.locator('[data-inline-editor]');
    const itemName = itemEditor.locator('[data-inline-edit-field="name"]');
    await expect(itemName).toHaveValue('New Event');
    await expect(itemName.locator('option')).toHaveText(['New Event (unavailable)', 'Order Created - Order Created']);
    await itemName.selectOption('Order Created');
    await itemEditor.locator('.inline-edit-actions button:last-child').click();
    await expect(testCase.locator('.test-event').first()).toContainText('Order Created');

    await testCase.locator('.test-event').first().click({ button: 'right' });
    await expect(page.locator('.diagram-context-menu button')).toHaveText(['Edit', 'Delete']);
    await page.locator('.diagram-context-menu [data-context-menu-action="delete-element"]').click();
    await expect(page.locator('.test-case')).toHaveCount(2);
    await expect(testCase.locator('.test-event')).toHaveCount(1);
  });

  test('offers edit and delete for diagram elements', async ({ page }) => {
    await page.locator('.slice-header').first().click({ button: 'right' });
    await page.locator('.diagram-context-menu [data-context-menu-action="add-event"]').click();
    const newEvent = page.locator('.element.event').filter({ hasText: 'New Event' }).first();

    await newEvent.click({ button: 'right' });
    const menu = page.locator('.diagram-context-menu');
    await expect(menu.locator('button')).toHaveText(['Edit', 'Delete']);
    await menu.locator('[data-context-menu-action="edit-element"]').click();
    await expect(page.locator('[data-inline-editor]')).toBeVisible();
    await page.locator('[data-inline-editor] .inline-edit-actions button:first-child').click();

    await newEvent.click({ button: 'right' });
    await page.locator('.diagram-context-menu [data-context-menu-action="delete-element"]').click();
    await expect(page.locator('.element.event').filter({ hasText: 'New Event' })).toHaveCount(0);
  });
});
