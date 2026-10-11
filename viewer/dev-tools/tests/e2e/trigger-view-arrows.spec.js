import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const viewerDirectory = join(__dirname, '..', '..', '..');
const standaloneViewerPath = join(viewerDirectory, '..', 'event-model-viewer.html');

for (const triggerType of ['automation', 'translation']) {
  test(`cross-slice ${triggerType} trigger-to-view arrow ends at the view`, async ({ page }) => {
    await page.goto(`file:///${standaloneViewerPath.replace(/\\/g, '/')}`);
    await page.locator('#fileInput').setInputFiles({
      name: `cross-slice-${triggerType}-view-trigger.emj`,
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
            trigger: { type: triggerType, views: ['order-view'] }
          }
        ]
      }))
    });

    await page.waitForSelector('#arrow-svg path:not(.arrow-hitarea)', { state: 'attached' });
    const result = await page.evaluate(() => {
      const path = document.querySelector('#arrow-svg path:not(.arrow-hitarea)');
      const view = document.querySelector('.element.view');
      const trigger = document.querySelector('.element.trigger');
      const matrix = path.getScreenCTM();
      const start = path.getPointAtLength(0);
      const end = path.getPointAtLength(path.getTotalLength());
      const startPoint = new DOMPoint(start.x, start.y).matrixTransform(matrix);
      const endPoint = new DOMPoint(end.x, end.y).matrixTransform(matrix);
      const viewRect = view.getBoundingClientRect();
      const triggerRect = trigger.getBoundingClientRect();

      return {
        start: { x: startPoint.x, y: startPoint.y },
        end: { x: endPoint.x, y: endPoint.y },
        view: {
          centerX: viewRect.left + viewRect.width / 2,
          top: viewRect.top
        },
        trigger: {
          left: triggerRect.left,
          top: triggerRect.top,
          bottom: triggerRect.bottom
        }
      };
    });

    expect(result.end.x).toBeCloseTo(result.view.centerX, 0);
    expect(result.end.y).toBeLessThan(result.view.top);
  });
}

test('cross-slice UI trigger-to-view arrow still enters the view through its top edge', async ({ page }) => {
  await page.goto(`file:///${standaloneViewerPath.replace(/\\/g, '/')}`);
  await page.locator('#fileInput').setInputFiles({
    name: 'cross-slice-ui-trigger-view.emj',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({
      title: 'Cross Slice UI Direction',
      slices: [
        {
          id: 'view-slice',
          name: 'View',
          view: { id: 'order-view', name: 'Order view' }
        },
        {
          id: 'trigger-slice',
          name: 'Trigger',
          trigger: { type: 'ui', views: ['order-view'] }
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
      expected: { x: viewRect.left + viewRect.width / 2 },
      viewTop: viewRect.top
    };
  });

  expect(result.endpoint.x).toBeCloseTo(result.expected.x, 0);
  expect(result.endpoint.y).toBeLessThan(result.viewTop);
});

for (const triggerType of ['ui', 'automation', 'translation']) {
  test(`same-slice ${triggerType} trigger-to-view arrow points to the view`, async ({ page }) => {
    await page.goto(`file:///${standaloneViewerPath.replace(/\\/g, '/')}`);
    await page.locator('#fileInput').setInputFiles({
      name: `same-slice-${triggerType}-view-trigger.emj`,
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify({
        title: 'Same Slice Trigger/View Direction',
        slices: [
          {
            id: 'pattern-slice',
            name: 'Pattern',
            trigger: { type: triggerType, views: ['order-view'] },
            view: { id: 'order-view', name: 'Order view' }
          }
        ]
      }))
    });

    await page.waitForSelector('#arrow-svg path:not(.arrow-hitarea)', { state: 'attached' });
    const result = await page.evaluate(() => {
      const path = document.querySelector('#arrow-svg path:not(.arrow-hitarea)');
      const view = document.querySelector('.element.view');
      const trigger = document.querySelector('.element.trigger');
      const matrix = path.getScreenCTM();
      const start = path.getPointAtLength(0);
      const end = path.getPointAtLength(path.getTotalLength());
      const startPoint = new DOMPoint(start.x, start.y).matrixTransform(matrix);
      const endPoint = new DOMPoint(end.x, end.y).matrixTransform(matrix);
      const viewRect = view.getBoundingClientRect();
      const triggerRect = trigger.getBoundingClientRect();

      return {
        start: { x: startPoint.x, y: startPoint.y },
        end: { x: endPoint.x, y: endPoint.y },
        view: {
          centerX: viewRect.left + viewRect.width / 2,
          top: viewRect.top
        },
        trigger: {
          centerX: triggerRect.left + triggerRect.width / 2,
          bottom: triggerRect.bottom
        }
      };
    });

    expect(result.start.x).toBeCloseTo(result.trigger.centerX, 0);
    expect(result.end.x).toBeCloseTo(result.view.centerX, 0);
    expect(result.start.y).toBeLessThan(result.end.y);
  });
}
