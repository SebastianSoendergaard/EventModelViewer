import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const testDirectory = dirname(fileURLToPath(import.meta.url));
const devToolsDirectory = join(testDirectory, '..', '..');
const repositoryRoot = join(devToolsDirectory, '..', '..');
const viewerUrl = pathToFileURL(join(repositoryRoot, 'event-model-viewer.html')).href;
const simpleModel = JSON.parse(readFileSync(join(devToolsDirectory, 'tests', 'fixtures', 'simple-event-model.json'), 'utf8'));
const wideModel = {
  title: 'Wide Event Model',
  slices: Array.from({ length: 20 }, (_, index) => ({
    id: `slice-${index + 1}`,
    name: `Slice ${index + 1}`,
    trigger: { type: 'input-ui', role: 'User' },
    command: { name: `Command ${index + 1}` },
    events: [{ name: `Event ${index + 1}`, swimlane: `System ${index + 1}` }]
  }))
};

async function loadFile(page, model, fileName) {
  await page.evaluate(({ model, fileName }) => {
    EventBus.emit(Events.FILE_LOADED, {
      json: model,
      fileName,
      format: 'json',
      presentationIdentity: { type: 'standalone', fileName }
    });
  }, { model, fileName });
  await expect(page.locator('.event-model-diagram')).toBeVisible();
  await page.waitForTimeout(50);
}

test('restores per-file filters and zoom after switching files and reloading changed content', async ({ page }) => {
  await page.goto(viewerUrl);
  await loadFile(page, simpleModel, 'orders.emj');

  await page.locator('#showTests').uncheck();
  await page.locator('#zoomInBtn').click();
  const savedZoom = await page.locator('#zoomLevel').textContent();

  await page.reload();
  await expect(page.locator('.event-model-diagram')).toBeVisible();
  await expect(page.locator('#showTests')).not.toBeChecked();
  await expect(page.locator('#zoomLevel')).toHaveText(savedZoom);

  await loadFile(page, simpleModel, 'other.emj');
  await expect(page.locator('#showTests')).toBeChecked();

  const changedModel = { ...simpleModel, title: 'Updated Orders' };
  await loadFile(page, changedModel, 'orders.emj');
  await expect(page.locator('#showTests')).not.toBeChecked();
  await expect(page.locator('#zoomLevel')).toHaveText(savedZoom);

  await page.evaluate(() => {
    EventBus.emit(Events.PRESENTATION_STATE_CHANGED, {
      zoom: 0.4,
      scrollLeft: 20,
      scrollTop: 10
    });
  });
  await page.waitForTimeout(150);
  await loadFile(page, changedModel, 'orders.emj');
  await expect(page.locator('#zoomLevel')).toHaveText('40%');
});

test('restores pan after the saved zoom is reapplied', async ({ page }) => {
  await page.goto(viewerUrl);
  await loadFile(page, wideModel, 'wide.emj');

  await page.evaluate(() => {
    EventBus.emit(Events.PRESENTATION_STATE_CHANGED, {
      zoom: 2.5,
      scrollLeft: 90,
      scrollTop: 70
    });
  });
  await loadFile(page, wideModel, 'wide.emj');

  await expect(page.locator('#zoomLevel')).toHaveText('250%');
  await expect.poll(() => page.locator('#diagramContainer').evaluate(container => container.scrollLeft)).toBe(90);
  await expect.poll(() => page.locator('#diagramContainer').evaluate(container => container.scrollTop)).toBe(70);
});
