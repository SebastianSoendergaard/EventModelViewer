import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const testDir = dirname(fileURLToPath(import.meta.url));
const coreSource = readFileSync(
  resolve(testDir, '../../../src/toolbar/export-tasks/export-tasks-core.js'),
  'utf8'
);
const standaloneSource = readFileSync(
  resolve(testDir, '../../../src/toolbar/export-tasks/export-tasks-standalone.js'),
  'utf8'
);

function loadStandaloneExporter() {
  const dom = new JSDOM(
    '<!DOCTYPE html><html><body><button id="exportTasksBtn"></button></body></html>',
    { runScripts: 'outside-only', url: 'http://localhost' }
  );
  const listeners = {};
  const activeUrls = new Set();
  const downloadedFiles = [];
  const alerts = [];
  let urlNumber = 0;

  dom.window.EventBus = {
    on(event, callback) {
      (listeners[event] ||= []).push(callback);
    }
  };
  dom.window.Events = { MODEL_CHANGED: 'model:changed' };
  dom.window.URL.createObjectURL = () => {
    const url = `blob:${++urlNumber}`;
    activeUrls.add(url);
    return url;
  };
  dom.window.URL.revokeObjectURL = url => activeUrls.delete(url);
  dom.window.HTMLAnchorElement.prototype.click = function() {
    const url = this.href;
    const filename = this.download;
    setTimeout(() => {
      if (activeUrls.has(url)) downloadedFiles.push(filename);
    }, 10);
  };
  dom.window.alert = message => alerts.push(message);
  dom.window.eval(`(function(){${coreSource}\n${standaloneSource}\n})()`);

  return { dom, listeners, downloadedFiles, alerts };
}

describe('standalone task export delivery', () => {
  it('keeps every generated Blob available until the browser starts each download', async () => {
    const { dom, listeners, downloadedFiles, alerts } = loadStandaloneExporter();
    dom.window.localStorage.setItem('exportTaskFormats', JSON.stringify({ markdown: true, json: true }));
    const model = {
      title: 'Test Model',
      slices: [
        { id: 'first', name: 'First slice' },
        { id: 'second', name: 'Second slice' }
      ]
    };

    listeners['model:changed'][0]({ model });
    const expectedFiles = dom.window.EventModelTaskExport.generateExportFiles(model);
    dom.window.document.getElementById('exportTasksBtn').click();
    await new Promise(resolve => setTimeout(resolve, 0));
    dom.window.document.querySelector('[data-action=export]').click();
    await new Promise(resolve => setTimeout(resolve, 1400));

    expect(downloadedFiles).toEqual(expectedFiles.map(file => file.name));
    expect(alerts).toEqual(['Started downloading 6 file(s).']);
    dom.window.close();
  });
});

describe('standalone task export format selection', () => {
  it('starts with neither format selected and disables export with a hint', async () => {
    const { dom, listeners } = loadStandaloneExporter();
    listeners['model:changed'][0]({ model: { title: 'Model', slices: [{ name: 'Slice' }] } });
    dom.window.document.getElementById('exportTasksBtn').click();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(dom.window.document.querySelector('[data-action="export"]').disabled).toBe(true);
    expect(dom.window.document.querySelector('.export-format-hint').hidden).toBe(false);
    dom.window.close();
  });

  it('saves, restores, and permits editing the selected formats', async () => {
    const first = loadStandaloneExporter();
    first.listeners['model:changed'][0]({ model: { title: 'Model', slices: [{ name: 'Slice' }] } });
    first.dom.window.document.getElementById('exportTasksBtn').click();
    await new Promise(resolve => setTimeout(resolve, 0));
    const boxes = first.dom.window.document.querySelectorAll('input[data-format]');
    boxes[0].click();
    expect(JSON.parse(first.dom.window.localStorage.getItem('exportTaskFormats'))).toEqual({ markdown: true, json: false });
    first.dom.window.close();
    const second = loadStandaloneExporter();
    second.dom.window.localStorage.setItem('exportTaskFormats', JSON.stringify({ markdown: true, json: false }));
    second.listeners['model:changed'][0]({ model: { title: 'Model', slices: [{ name: 'Slice' }] } });
    second.dom.window.document.getElementById('exportTasksBtn').click();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(second.dom.window.document.querySelector('input[data-format="markdown"]').checked).toBe(true);
    expect(second.dom.window.document.querySelector('input[data-format="json"]').checked).toBe(false);
    second.dom.window.document.querySelector('input[data-format="json"]').click();
    expect(JSON.parse(second.dom.window.localStorage.getItem('exportTaskFormats'))).toEqual({ markdown: true, json: true });
    second.dom.window.close();
  });

  it.each([
    [{ markdown: true, json: false }, ['model-index.md', 'model-slice.md']],
    [{ markdown: false, json: true }, ['model-index.json', 'model-slice.json']],
    [{ markdown: true, json: true }, ['model-index.md', 'model-index.json', 'model-slice.md', 'model-slice.json']]
  ])('downloads the selected format set including its index', async (formats, expected) => {
    const { dom, listeners, downloadedFiles } = loadStandaloneExporter();
    dom.window.localStorage.setItem('exportTaskFormats', JSON.stringify(formats));
    listeners['model:changed'][0]({ model: { title: 'Model', slices: [{ name: 'Slice' }] } });
    dom.window.document.getElementById('exportTasksBtn').click();
    await new Promise(resolve => setTimeout(resolve, 0));
    const dialogBoxes = dom.window.document.querySelectorAll('input[data-format]');
    dialogBoxes[0].checked = formats.markdown; dialogBoxes[1].checked = formats.json;
    dialogBoxes.forEach(box => box.dispatchEvent(new dom.window.Event('change')));
    dom.window.document.querySelector('[data-action=export]').click();
    await new Promise(resolve => setTimeout(resolve, 1400));
    expect(downloadedFiles).toEqual(expected);
    dom.window.close();
  });
});
