import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repositoryRoot = join(__dirname, '..', '..', '..', '..');

test('exports the visible event model as native Draw.io XML', async ({ page }) => {
  const viewerPath = join(repositoryRoot, 'event-model-viewer.html');
  const fixturePath = join(repositoryRoot, 'viewer', 'dev-tools', 'tests', 'fixtures', 'simple-event-model.json');

  await page.goto(`file:///${viewerPath.replace(/\\/g, '/')}`);
  await page.locator('#fileInput').setInputFiles(fixturePath);
  await page.locator('.event-model-diagram').waitFor({ state: 'visible' });

  const downloadPromise = page.waitForEvent('download');
  await page.locator('#exportDrawioBtn').click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  let xml = '';
  for await (const chunk of stream) {
    xml += chunk.toString();
  }

  expect(download.suggestedFilename()).toBe('event-model-diagram.drawio');
  expect(xml).toContain('<mxCell id="0"/>');
  expect(xml).toContain('<mxCell id="1" parent="0"/>');
  expect(xml).toContain('value="Create Order"');
  expect(xml).toContain('fillColor=#3498db');
  expect(xml).toContain('container=1');
  expect(xml).toContain('parent="node-');
  expect(xml).toContain('edge="1"');
  expect(xml).toContain('source="node-');
  expect(xml).toContain('target="node-');

  const parserError = await page.evaluate(xmlText => {
    const document = new DOMParser().parseFromString(xmlText, 'application/xml');
    return document.querySelector('parsererror')?.textContent || null;
  }, xml);
  expect(parserError).toBeNull();
});
