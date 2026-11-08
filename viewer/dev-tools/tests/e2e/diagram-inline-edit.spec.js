import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..', '..', '..', '..');

test.describe('Diagram inline editor', () => {
  test.beforeEach(async ({ page }) => {
    const indexPath = join(projectRoot, 'event-model-viewer.html');
    const fixturePath = join(projectRoot, 'viewer', 'dev-tools', 'tests', 'fixtures', 'simple-event-model.json');

    await page.goto(`file:///${indexPath.replace(/\\/g, '/')}`);
    await page.locator('#fileInput').setInputFiles(fixturePath);
    await page.waitForSelector('.event-model-diagram');
    await page.waitForTimeout(1200);
    await page.locator('#zoomInBtn').click();
    await page.locator('#zoomInBtn').click();

    await page.locator('.element.command').first().dblclick();
  });

  test('opens as a centered overlay above the diagram', async ({ page }) => {

    const editor = page.locator('[data-inline-editor]');
    await expect(editor).toBeVisible();
    await expect(editor).toHaveAttribute('data-inline-editor', 'true');

    const assertCentered = async () => {
      const containerBox = await page.locator('#diagramContainer').boundingBox();
      const editorBox = await editor.boundingBox();
      expect(containerBox).not.toBeNull();
      expect(editorBox).not.toBeNull();
      expect(Math.abs((editorBox.x + editorBox.width / 2) - (containerBox.x + containerBox.width / 2))).toBeLessThan(2);
      expect(Math.abs((editorBox.y + editorBox.height / 2) - (containerBox.y + containerBox.height / 2))).toBeLessThan(2);
    };

    await assertCentered();
    await page.locator('#diagramContainer').evaluate(element => {
      element.scrollLeft = element.scrollWidth;
      element.scrollTop = element.scrollHeight;
    });
    await page.waitForTimeout(100);
    await assertCentered();

    expect(await editor.evaluate(element => element.parentElement.id)).toBe('diagramContainer');
    expect(await editor.evaluate(element => Number.parseInt(getComputedStyle(element).zIndex, 10))).toBeGreaterThan(10);
  });

  test('keeps editor fields editable', async ({ page }) => {
    const editor = page.locator('[data-inline-editor]');
    const name = editor.locator('[data-inline-edit-field="name"]');
    const nameBox = await name.boundingBox();
    expect(nameBox).not.toBeNull();
    await page.mouse.move(nameBox.x + nameBox.width / 2, nameBox.y + nameBox.height / 2);
    await page.waitForTimeout(500);
    await expect(editor).toBeVisible();
    const stableNameBox = await name.boundingBox();
    expect(stableNameBox).not.toBeNull();
    await page.mouse.click(stableNameBox.x + stableNameBox.width / 2, stableNameBox.y + stableNameBox.height / 2);
    await expect(name).toBeFocused();
    await name.fill('Create purchase');
    await expect(name).toHaveValue('Create purchase');
    const id = editor.locator('[data-inline-edit-field="id"]');
    const idEnabled = editor.locator('[data-inline-edit-field="idEnabled"]');
    await expect(id).toBeDisabled();
    await expect(id).toHaveValue('Create purchase');
    await idEnabled.check();
    await expect(id).toBeEnabled();
  });

  test('keeps changes open when clicking outside until explicitly closed', async ({ page }) => {
    const editor = page.locator('[data-inline-editor]');
    const name = editor.locator('[data-inline-edit-field="name"]');
    await name.fill('Create purchase outside');

    await page.locator('#diagram').click({ position: { x: 10, y: 10 } });
    await expect(editor).toBeVisible();
    await expect(name).toHaveValue('Create purchase outside');
    await expect(page.locator('.element.command').first()).toContainText('Create Order');

    await editor.locator('.inline-edit-actions button:first-child').click();
    await expect(editor).toHaveCount(0);
    await expect(page.locator('.element.command').first()).toContainText('Create Order');
  });

  test('saves changes only through the Save action', async ({ page }) => {
    const editor = page.locator('[data-inline-editor]');
    await editor.locator('[data-inline-edit-field="name"]').fill('Create purchase saved');
    await editor.locator('.inline-edit-actions button:last-child').click();

    await expect(page.locator('[data-inline-editor]')).toHaveCount(0);
    await expect(page.locator('.element.command').first()).toContainText('Create purchase saved');
  });

  test('dismisses changes with Escape', async ({ page }) => {
    const editor = page.locator('[data-inline-editor]');
    await editor.locator('[data-inline-edit-field="name"]').fill('Create purchase escaped');
    await page.keyboard.press('Escape');

    await expect(editor).toHaveCount(0);
    await expect(page.locator('.element.command').first()).toContainText('Create Order');
  });

  test('selects and deselects trigger view dependencies', async ({ page }) => {
    await page.locator('.inline-edit-actions button:last-child').click();
    await page.locator('.element.trigger').first().dblclick();

    const editor = page.locator('[data-inline-editor]');
    const views = editor.locator('[data-inline-edit-field="views"]');
    await expect(views.locator('option')).toHaveText(['Order Details - Order Details']);

    await views.selectOption('Order Details');
    await editor.locator('.inline-edit-actions button:last-child').click();
    await page.locator('.element.trigger').first().dblclick();
    await expect(views.locator('option:checked')).toHaveCount(1);

    await views.selectOption([]);
    await editor.locator('.inline-edit-actions button:last-child').click();
    await page.locator('.element.trigger').first().dblclick();
    await expect(views.locator('option:checked')).toHaveCount(0);
  });

  test('selects and deselects command and view event dependencies', async ({ page }) => {
    const commandEditor = page.locator('[data-inline-editor]');
    const commandEvents = commandEditor.locator('[data-inline-edit-field="events"]');
    await expect(commandEvents.locator('option')).toHaveText(['Order Created - Order Created']);
    await expect(commandEvents.locator('option:checked')).toHaveCount(1);

    await commandEvents.selectOption([]);
    await commandEditor.locator('.inline-edit-actions button:last-child').click();
    await page.locator('.element.command').first().dblclick();
    await expect(page.locator('[data-inline-editor] [data-inline-edit-field="events"] option:checked'))
      .toHaveCount(0);
    await page.locator('[data-inline-editor] .inline-edit-actions button:last-child').click();

    await page.locator('.element.view').first().dblclick();
    const viewEditor = page.locator('[data-inline-editor]');
    const viewEvents = viewEditor.locator('[data-inline-edit-field="events"]');
    await expect(viewEvents.locator('option')).toHaveText(['Order Created - Order Created']);
    await expect(viewEvents.locator('option:checked')).toHaveCount(1);

    await viewEvents.selectOption([]);
    await viewEditor.locator('.inline-edit-actions button:last-child').click();
    await page.locator('.element.view').first().dblclick();
    await expect(page.locator('[data-inline-editor] [data-inline-edit-field="events"] option:checked'))
      .toHaveCount(0);
  });

  test('edits slice metadata from the diagram', async ({ page }) => {
    await page.locator('.inline-edit-actions button:last-child').click();
    const slice = page.locator('.slice-header').first();
    await slice.dblclick();

    const editor = page.locator('[data-inline-editor]');
    await editor.locator('[data-inline-edit-field="name"]').fill('Create checkout');
    await editor.locator('[data-inline-edit-field="border"]').fill('#ff00ff');
    await editor.locator('[data-inline-edit-field="hints"]').fill('Keep the command idempotent\nReview the projection');
    await editor.locator('.inline-edit-actions button:last-child').click();

    await expect(page.locator('.slice-header').first()).toContainText('Create checkout');
  });

  test('disables the slice ID input when its checkbox is unchecked', async ({ page }) => {
    await page.locator('.inline-edit-actions button:last-child').click();
    await page.locator('.slice-header').first().dblclick();

    const editor = page.locator('[data-inline-editor]');
    const id = editor.locator('[data-inline-edit-field="id"]');
    const idEnabled = editor.locator('[data-inline-edit-field="idEnabled"]');
    await expect(idEnabled).toBeChecked();
    await idEnabled.uncheck();
    await expect(id).toBeDisabled();
    await expect(id).toHaveCSS('background-color', 'rgb(224, 224, 224)');
  });
});
