import { test, expect } from '@playwright/test';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..', '..', '..', '..');

test('standalone task export delivers every generated file', async ({ page }) => {
  const model = {
    title: 'Download test model',
    slices: Array.from({ length: 5 }, (_, index) => ({
      id: `slice-${index + 1}`,
      name: `Slice ${index + 1}`
    }))
  };
  const expectedFileCount = model.slices.length * 2 + 2;
  const downloads = [];

  page.on('download', download => downloads.push(download.suggestedFilename()));
  page.on('dialog', dialog => dialog.accept());
  await page.goto(`file:///${join(projectRoot, 'event-model-viewer.html').replace(/\\/g, '/')}`);
  await page.locator('#fileInput').setInputFiles({
    name: 'download-test.emj',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(model))
  });
  await page.waitForTimeout(1000);

  await page.locator('#exportTasksBtn').click();
  await page.waitForTimeout(5000);

  expect(downloads).toHaveLength(expectedFileCount);
});
