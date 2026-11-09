import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..', '..', '..', '..');

test('refreshes code fold controls after loading and folding', async ({ page }) => {
  const indexPath = join(projectRoot, 'event-model-viewer.html');
  const fixturePath = join(projectRoot, 'viewer', 'dev-tools', 'tests', 'fixtures', 'simple-event-model.json');

  await page.goto(`file:///${indexPath.replace(/\\/g, '/')}`);
  await page.locator('#fileInput').setInputFiles(fixturePath);
  await page.waitForSelector('.event-model-diagram');
  await page.waitForTimeout(500);

  const collapseButton = page.locator('#codeCollapseBtn');
  const expandButton = page.locator('#codeExpandBtn');

  await expect(collapseButton).toBeEnabled();
  await expect(expandButton).toBeDisabled();

  await collapseButton.click();
  await expect(collapseButton).toBeEnabled();
  await expect(expandButton).toBeEnabled();
});
