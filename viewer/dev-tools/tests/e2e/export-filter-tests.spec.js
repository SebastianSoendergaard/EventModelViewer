import { test, expect } from '@playwright/test';
import { readFile } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = join(__dirname, '..', '..', '..', '..');
const viewerPath = join(repositoryRoot, 'event-model-viewer.html');
const fixturePath = join(__dirname, '..', 'fixtures', 'complex-event-model.json');

test.describe('Filtered diagram exports', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(pathToFileURL(viewerPath).href);
    await page.locator('#fileInput').setInputFiles(fixturePath);
    await expect(page.locator('.event-model-diagram')).toContainText('Register User');
  });

  test('PNG and SVG exports omit content hidden by filters', async ({ page }) => {
    for (const filter of ['#showTests', '#showTypes', '#showSlices', '#showSwimlanes']) {
      await page.locator(filter).uncheck();
    }

    const expectedDimensions = await page.locator('.event-model-diagram').evaluate(element => ({
      width: element.offsetWidth,
      height: element.offsetHeight
    }));

    await page.evaluate(() => {
      window.pngExportMetrics = null;
      window.html2canvas = async (diagram, options) => {
        const clonedDoc = new DOMParser().parseFromString(document.documentElement.outerHTML, 'text/html');
        options.onclone(clonedDoc);
        const exportedDiagram = clonedDoc.querySelector('.event-model-diagram');
        window.pngExportMetrics = {
          width: diagram.offsetWidth,
          height: diagram.offsetHeight,
          testsCount: exportedDiagram.querySelectorAll('.tests-container').length,
          laneHeaderCount: exportedDiagram.querySelectorAll('.lane-header').length,
          sliceMarkerCount: exportedDiagram.querySelectorAll('.slice-border, .slice-background').length,
          text: exportedDiagram.textContent
        };
        return {
          toBlob(callback) {
            callback(new Blob([], { type: 'image/png' }));
          }
        };
      };
    });

    const [pngDownload] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('#exportPngBtn').click()
    ]);
    expect(pngDownload.suggestedFilename()).toBe('event-model-diagram.png');

    await expect.poll(() => page.evaluate(() => window.pngExportMetrics)).not.toBeNull();
    const pngMetrics = await page.evaluate(() => window.pngExportMetrics);
    expect(pngMetrics).toMatchObject(expectedDimensions);
    expect(pngMetrics.testsCount).toBe(0);
    expect(pngMetrics.laneHeaderCount).toBe(0);
    expect(pngMetrics.sliceMarkerCount).toBe(0);
    expect(pngMetrics.text).not.toContain('Guid');

    const [svgDownload] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('#exportSvgBtn').click()
    ]);
    expect(svgDownload.suggestedFilename()).toBe('event-model-diagram.svg');

    const svgPath = await svgDownload.path();
    const svgContent = await readFile(svgPath, 'utf8');
    const svgMetrics = await page.evaluate(content => {
      const svgDocument = new DOMParser().parseFromString(content, 'image/svg+xml');
      const diagram = svgDocument.querySelector('.event-model-diagram');
      const svg = svgDocument.documentElement;
      return {
        hasParserError: Boolean(svgDocument.querySelector('parsererror')),
        width: Number(svg.getAttribute('width')),
        height: Number(svg.getAttribute('height')),
        testsCount: diagram.querySelectorAll('.tests-container').length,
        laneHeaderCount: diagram.querySelectorAll('.lane-header').length,
        sliceMarkerCount: diagram.querySelectorAll('.slice-border, .slice-background').length,
        text: diagram.textContent
      };
    }, svgContent);
    expect(svgMetrics.hasParserError).toBe(false);
    expect(svgMetrics).toMatchObject(expectedDimensions);
    expect(svgMetrics.testsCount).toBe(0);
    expect(svgMetrics.laneHeaderCount).toBe(0);
    expect(svgMetrics.sliceMarkerCount).toBe(0);
    expect(svgMetrics.text).not.toContain('Guid');
  });
});
