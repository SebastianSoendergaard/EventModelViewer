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
    { runScripts: 'outside-only' }
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
    await new Promise(resolve => setTimeout(resolve, 1400));

    expect(downloadedFiles).toEqual(expectedFiles.map(file => file.name));
    expect(alerts).toEqual(['Started downloading 6 file(s).']);
    dom.window.close();
  });
});
