import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const viewerDirectory = join(__dirname, '..', '..', '..');
const standaloneViewerPath = join(viewerDirectory, '..', 'event-model-viewer.html');

async function readArrowGeometry(page) {
  return page.evaluate(() => {
    const path = document.querySelector('#arrow-svg path:not(.arrow-hitarea)');
    const command = document.querySelector('.element.command');
    const event = document.querySelector('.element.event');
    const matrix = path.getScreenCTM();
    const endpoint = path.getPointAtLength(path.getTotalLength());
    const eventRect = event.getBoundingClientRect();
    const eventTop = new DOMPoint(
      eventRect.left + eventRect.width / 2,
      eventRect.top
    ).matrixTransform(matrix.inverse());

    return {
      endpoint: { x: endpoint.x, y: endpoint.y },
      eventTop: { x: eventTop.x, y: eventTop.y },
      commandHeight: command.getBoundingClientRect().height
    };
  });
}

function expectEndpointToTrackEvent(before, after) {
  expect(after.endpoint.y - after.eventTop.y)
    .toBeCloseTo(before.endpoint.y - before.eventTop.y, 0);
}

test('arrows track box geometry across filter changes and restored state', async ({ page }) => {
  await page.goto(`file:///${standaloneViewerPath.replace(/\\/g, '/')}`);
  await page.locator('#fileInput').setInputFiles({
    name: 'type-filter-arrow-geometry.emj',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({
      title: 'Type Filter Arrow Geometry',
      slices: [{
        id: 'command-slice',
        name: 'Command slice',
        command: {
          name: 'Create item',
          properties: [
            { name: 'Id', type: 'Very Long Identifier Type Name With Extra Words' },
            { name: 'Code', type: 'Very Long Identifier Type Name With Extra Words' },
            { name: 'Name', type: 'Very Long Identifier Type Name With Extra Words' },
            { name: 'Status', type: 'Very Long Identifier Type Name With Extra Words' }
          ],
          events: ['item-created']
        },
        events: [{
          id: 'item-created',
          name: 'Item created',
          properties: []
        }]
      }]
    }))
  });

  await page.waitForSelector('.element.command');
  await page.waitForSelector('#arrow-svg path:not(.arrow-hitarea)', { state: 'attached' });

  const showTypes = page.locator('#showTypes');
  await showTypes.check();
  const withTypes = await readArrowGeometry(page);

  await showTypes.uncheck();
  const withoutTypes = await readArrowGeometry(page);
  expect(withoutTypes.commandHeight).toBeLessThan(withTypes.commandHeight);
  expect(withoutTypes.eventTop.y).toBeLessThan(withTypes.eventTop.y);
  expectEndpointToTrackEvent(withTypes, withoutTypes);

  await page.reload();
  await page.waitForSelector('.element.command');
  await page.waitForSelector('#arrow-svg path:not(.arrow-hitarea)', { state: 'attached' });
  await expect(showTypes).not.toBeChecked();
  const restoredTypes = await readArrowGeometry(page);
  expectEndpointToTrackEvent(withoutTypes, restoredTypes);

  for (const selector of ['#showSlices', '#showTests', '#showSwimlanes']) {
    const filter = page.locator(selector);
    const beforeDisable = await readArrowGeometry(page);
    await filter.uncheck();
    const afterDisable = await readArrowGeometry(page);
    expectEndpointToTrackEvent(beforeDisable, afterDisable);

    const beforeEnable = await readArrowGeometry(page);
    await filter.check();
    const afterEnable = await readArrowGeometry(page);
    expectEndpointToTrackEvent(beforeEnable, afterEnable);
  }

  const beforeEnableTypes = await readArrowGeometry(page);
  await showTypes.check();
  const afterEnableTypes = await readArrowGeometry(page);
  expectEndpointToTrackEvent(beforeEnableTypes, afterEnableTypes);
});
