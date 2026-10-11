import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { PNG } from 'pngjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repositoryRoot = join(__dirname, '..', '..', '..', '..');

test.describe('Diagram Image Export', () => {
  test('renders current UI input values as vertically centered static text', async ({ page }) => {
    const viewerPath = join(repositoryRoot, 'event-model-viewer.html');
    await page.goto(`file:///${viewerPath.replace(/\\/g, '/')}`);
    const fixturePath = join(repositoryRoot, 'viewer', 'dev-tools', 'tests', 'fixtures', 'simple-event-model.json');
    await page.locator('#fileInput').setInputFiles(fixturePath);
    const diagram = page.locator('.event-model-diagram');
    await diagram.waitFor({ state: 'visible' });

    await diagram.evaluate(element => {
      const addInput = (value, disabled = false) => {
        const row = document.createElement('div');
        row.className = 'trigger-input-row';
        const label = document.createElement('label');
        label.className = 'trigger-input-label';
        label.textContent = 'Value';
        const input = document.createElement('input');
        input.className = 'trigger-input-field';
        input.type = 'text';
        input.setAttribute('value', value);
        input.value = value;
        input.disabled = disabled;
        row.append(label, input);
        element.appendChild(row);
        return input;
      };

      const editedInput = addInput('Model value');
      editedInput.value = 'Edited';
      addInput('Disabled value', true);
      addInput('');
      const longInput = addInput('A long value that scrolls horizontally in the field');
      longInput.scrollLeft = 20;
    });

    await page.evaluate(() => {
      window.__diagramImageExportCapture = null;
      window.html2canvas = async (diagramElement, options) => {
        const clonedDiagram = diagramElement.cloneNode(true);
        clonedDiagram.style.position = 'fixed';
        clonedDiagram.style.left = '20px';
        clonedDiagram.style.top = '20px';
        clonedDiagram.style.zIndex = '99999';
        document.body.appendChild(clonedDiagram);
        window.__diagramImageExportClone = clonedDiagram;

        const clonedDoc = {
          defaultView: window,
          head: { appendChild: element => clonedDiagram.appendChild(element) },
          createElement: tagName => document.createElement(tagName),
          querySelector: selector => clonedDiagram.matches(selector)
            ? clonedDiagram
            : clonedDiagram.querySelector(selector),
          querySelectorAll: selector => clonedDiagram.querySelectorAll(selector)
        };
        options.onclone(clonedDoc);

        window.__diagramImageExportCapture = {
          fields: Array.from(
            clonedDiagram.querySelectorAll('.diagram-image-export-static-input'),
            field => ({
              text: field.querySelector('.diagram-image-export-static-input__text').textContent,
              display: getComputedStyle(field).display,
              alignItems: getComputedStyle(field).alignItems,
              backgroundColor: getComputedStyle(field).backgroundColor,
              transform: field.querySelector('.diagram-image-export-static-input__text').style.transform
            })
          ),
          remainingInputs: clonedDiagram.querySelectorAll('input.trigger-input-field').length,
          liveInputs: document.querySelectorAll('.event-model-diagram input.trigger-input-field').length
        };

        return {
          toDataURL: () => 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j+ioAAAAASUVORK5CYII='
        };
      };
    });

    await page.locator('#exportPngBtn').click();
    await page.waitForFunction(() => window.__diagramImageExportCapture !== null);
    const capture = await page.evaluate(() => window.__diagramImageExportCapture);

    expect(capture.fields.map(field => field.text)).toEqual([
      'Edited',
      'Disabled value',
      '',
      'A long value that scrolls horizontally in the field'
    ]);
    expect(capture.fields.every(field => field.display === 'flex' && field.alignItems === 'center')).toBe(true);
    expect(capture.fields[1].backgroundColor).toBe('rgb(240, 240, 240)');
    expect(capture.fields[3].transform).toBe('translateX(-20px)');
    expect(capture.remainingInputs).toBe(0);
    expect(capture.liveInputs).toBe(4);

    const fieldPng = PNG.sync.read(await page.locator('.diagram-image-export-static-input').first().screenshot());
    let firstTextRow = fieldPng.height;
    let lastTextRow = -1;
    for (let y = 3; y < fieldPng.height - 3; y++) {
      for (let x = 4; x < fieldPng.width - 4; x++) {
        const pixel = (fieldPng.width * y + x) * 4;
        if (fieldPng.data[pixel] < 140 && fieldPng.data[pixel + 1] < 140 && fieldPng.data[pixel + 2] < 140) {
          firstTextRow = Math.min(firstTextRow, y);
          lastTextRow = Math.max(lastTextRow, y);
        }
      }
    }
    expect(lastTextRow).toBeGreaterThanOrEqual(firstTextRow);
    expect(Math.abs((firstTextRow + lastTextRow) / 2 - (fieldPng.height - 1) / 2)).toBeLessThanOrEqual(1.5);

    await page.evaluate(() => window.__diagramImageExportClone.remove());
  });
});
