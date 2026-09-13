import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const viewerDirectory = join(__dirname, '..', '..', '..');
const standaloneViewerPath = join(viewerDirectory, '..', 'event-model-viewer.html');

test('cross-slice trigger-to-view arrow enters the view through its top edge', async ({ page }) => {
  await page.goto(`file:///${standaloneViewerPath.replace(/\\/g, '/')}`);
  await page.locator('#fileInput').setInputFiles({
    name: 'cross-slice-trigger-view.emj',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({
      title: 'Cross Slice Direction',
      slices: [
        {
          id: 'view-slice',
          name: 'View',
          view: { id: 'order-view', name: 'Order view' }
        },
        {
          id: 'trigger-slice',
          name: 'Trigger',
          trigger: { type: 'automation', views: ['order-view'] }
        }
      ]
    }))
  });

  await page.waitForSelector('#arrow-svg path:not(.arrow-hitarea)', { state: 'attached' });
  const result = await page.evaluate(() => {
    const path = document.querySelector('#arrow-svg path:not(.arrow-hitarea)');
    const view = document.querySelector('.element.view');
    const matrix = path.getScreenCTM();
    const point = path.getPointAtLength(path.getTotalLength());
    const endpoint = new DOMPoint(point.x, point.y).matrixTransform(matrix);
    const viewRect = view.getBoundingClientRect();

    return {
      endpoint: { x: endpoint.x, y: endpoint.y },
      expected: {
        x: viewRect.left + viewRect.width / 2
      },
      viewTop: viewRect.top
    };
  });

  expect(result.endpoint.x).toBeCloseTo(result.expected.x, 0);
  expect(result.endpoint.y).toBeLessThan(result.viewTop);
});
