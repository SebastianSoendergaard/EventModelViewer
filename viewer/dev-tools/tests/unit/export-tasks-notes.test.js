import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const testDir = dirname(fileURLToPath(import.meta.url));
const exportTasksSource = readFileSync(
  resolve(testDir, '../../../src/toolbar/export-tasks/export-tasks.js'),
  'utf8'
);

function loadExportGenerator() {
  const dom = new JSDOM(
    '<!DOCTYPE html><html><body><button id="exportTasksBtn"></button></body></html>',
    { runScripts: 'outside-only', url: 'http://localhost' }
  );
  dom.window.EventBus = { on: () => {} };
  dom.window.Events = { MODEL_CHANGED: 'MODEL_CHANGED' };

  const generateExportFiles = dom.window.eval(`(function() {
    ${exportTasksSource}
    return generateExportFiles;
  })()`);

  return { dom, generateExportFiles };
}

describe('note task export', () => {
  it('combines fragment notes in source order and removes exact duplicates', () => {
    const { generateExportFiles } = loadExportGenerator();
    const files = generateExportFiles({
      title: 'Test Model',
      slices: [
        { id: 'A', name: 'Annotated', note: 'First' },
        { id: 'A', name: 'Annotated', note: 'Second' },
        { id: 'A', name: 'Annotated', note: 'First' }
      ]
    });

    const markdown = files.find(file => file.name === '001-annotated.md').content;
    const json = JSON.parse(files.find(file => file.name === '001-annotated.json').content);

    expect(markdown).toContain('## Note');
    expect(markdown).toContain(['First', 'Second'].join('\n'));
    expect(json.note).toBe(['First', 'Second'].join('\n'));
  });

  it('omits empty notes from task output', () => {
    const { generateExportFiles } = loadExportGenerator();
    const files = generateExportFiles({
      title: 'Test Model',
      slices: [{ id: 'A', name: 'Empty', note: '   ' }]
    });

    const markdown = files.find(file => file.name === '001-empty.md').content;
    const json = JSON.parse(files.find(file => file.name === '001-empty.json').content);

    expect(markdown).not.toContain('## Note');
    expect(Object.prototype.hasOwnProperty.call(json, 'note')).toBe(false);
  });
});
