import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const testDir = dirname(fileURLToPath(import.meta.url));
const exportTasksSource = readFileSync(
  resolve(testDir, '../../../src/toolbar/export-tasks/export-tasks-core.js'),
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

    const markdown = files.find(file => file.name === 'test-model---annotated.md').content;
    const json = JSON.parse(files.find(file => file.name === 'test-model---annotated.json').content);

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

    const markdown = files.find(file => file.name === 'test-model---empty.md').content;
    const json = JSON.parse(files.find(file => file.name === 'test-model---empty.json').content);

    expect(markdown).not.toContain('## Note');
    expect(Object.prototype.hasOwnProperty.call(json, 'note')).toBe(false);
  });
});

describe('task export naming and untitled slices', () => {
  it('prefixes files with the source filename and omits untitled slices', () => {
    const { generateExportFiles } = loadExportGenerator();
    const files = generateExportFiles({
      title: 'Model Title',
      slices: [
        { id: 'missing' },
        { id: 'null', name: null },
        { id: 'empty', name: '' },
        { id: 'whitespace', name: '   ' },
        { id: 'titled', name: 'First Slice' }
      ]
    }, 'C:\\models\\Cart Flow.EMY');

    expect(files.map(file => file.name)).toEqual([
      'cart-flow---index.md',
      'cart-flow---index.json',
      'cart-flow---first-slice.md',
      'cart-flow---first-slice.json'
    ]);
    expect(files[0].content).toContain('cart-flow---first-slice.md');
    expect(files[0].content).not.toContain('| Order |');
    expect(files.find(file => file.name === 'cart-flow---first-slice.md').content)
      .toContain('# First Slice');
    expect(files.find(file => file.name === 'cart-flow---first-slice.md').content)
      .not.toContain('# 001.');
    expect(JSON.parse(files[1].content).slices).toHaveLength(1);
  });

  it('uses a model title or the event-model fallback when no source filename exists', () => {
    const { generateExportFiles } = loadExportGenerator();
    const titledFiles = generateExportFiles({
      title: 'New Model',
      slices: []
    });
    const untitledFiles = generateExportFiles({
      title: '!!!',
      slices: []
    });

    expect(titledFiles.map(file => file.name)).toEqual([
      'new-model---index.md',
      'new-model---index.json'
    ]);
    expect(untitledFiles.map(file => file.name)).toEqual([
      'event-model---index.md',
      'event-model---index.json'
    ]);
  });

  it('exports only the indexes when every slice is untitled', () => {
    const { generateExportFiles } = loadExportGenerator();
    const files = generateExportFiles({
      title: 'Cart Flow',
      slices: [
        { id: 'missing' },
        { id: 'empty', name: '' },
        { id: 'whitespace', name: '   ' }
      ]
    }, 'cart-flow.emj');

    expect(files.map(file => file.name)).toEqual([
      'cart-flow---index.md',
      'cart-flow---index.json'
    ]);
    expect(JSON.parse(files[1].content).slices).toEqual([]);
  });

  it('uses a title from another merged fragment when the first fragment is blank', () => {
    const { generateExportFiles } = loadExportGenerator();
    const files = generateExportFiles({
      title: 'Test Model',
      slices: [
        { id: 'A', name: '   ' },
        { id: 'A', name: 'Named Slice' }
      ]
    });

    expect(files.map(file => file.name)).toContain('test-model---named-slice.md');
  });

  it('merges same-name slices even when they have different IDs', () => {
    const { generateExportFiles } = loadExportGenerator();
    const files = generateExportFiles({
      title: 'Test Model',
      slices: [
        { id: 'A', name: 'Same Slice' },
        { id: 'B', name: 'Same Slice' }
      ]
    });

    expect(files.map(file => file.name)).toEqual([
      'test-model---index.md',
      'test-model---index.json',
      'test-model---same-slice.md',
      'test-model---same-slice.json'
    ]);
  });

  it('rejects different slices that normalize to the same filename', () => {
    const { generateExportFiles } = loadExportGenerator();
    const model = {
      title: 'Test Model',
      slices: [
        { id: 'A', name: 'Create Order' },
        { id: 'B', name: 'create-order' }
      ]
    };

    expect(() => generateExportFiles(model)).toThrow(/filename collision/i);
  });

  it('rejects slice filenames that would overwrite the manifest', () => {
    const { generateExportFiles } = loadExportGenerator();

    expect(() => generateExportFiles({
      title: 'Test Model',
      slices: [{ id: 'A', name: 'Index' }]
    })).toThrow(/filename collision/i);
  });
});

describe('slice state task export', () => {
  it('uses the first defined fragment background as state and omits background metadata', () => {
    const { generateExportFiles } = loadExportGenerator();
    const files = generateExportFiles({
      title: 'Test Model',
      slices: [
        { id: 'A', name: 'Colored', border: '#4CBB17', background: '#E8F5E9' },
        { id: 'A', name: 'Colored', background: '#FFF8E1' }
      ]
    });

    const markdown = files.find(file => file.name === 'test-model---colored.md').content;
    const json = JSON.parse(files.find(file => file.name === 'test-model---colored.json').content);
    const indexMarkdown = files.find(file => file.name === 'test-model---index.md').content;
    const indexJson = JSON.parse(files.find(file => file.name === 'test-model---index.json').content);

    expect(markdown).toContain('- **State:** #E8F5E9');
    expect(markdown).not.toContain('Background');
    expect(json.state).toBe('#E8F5E9');
    expect(json).not.toHaveProperty('background');
    expect(indexMarkdown).toContain('| File | Slice | Pattern | State |');
    expect(indexMarkdown).not.toContain('Background');
    expect(indexMarkdown).toContain('| #E8F5E9 |');
    expect(indexJson.slices[0].state).toBe('#E8F5E9');
    expect(indexJson.slices[0]).not.toHaveProperty('background');
  });

  it('falls back to border when a slice has no background', () => {
    const { generateExportFiles } = loadExportGenerator();
    const files = generateExportFiles({
      title: 'Test Model',
      slices: [{ id: 'A', name: 'Bordered', border: '#4CBB17' }]
    });

    const markdown = files.find(file => file.name === 'test-model---bordered.md').content;
    const json = JSON.parse(files.find(file => file.name === 'test-model---bordered.json').content);
    const indexJson = JSON.parse(files.find(file => file.name === 'test-model---index.json').content);

    expect(markdown).toContain('- **State:** #4CBB17');
    expect(json.state).toBe('#4CBB17');
    expect(json).not.toHaveProperty('background');
    expect(indexJson.slices[0].state).toBe('#4CBB17');
    expect(indexJson.slices[0]).not.toHaveProperty('background');
  });
});

describe('deduplicated slice task export', () => {
  it('combines properties from every fragment of a slice', () => {
    const { generateExportFiles } = loadExportGenerator();
    const files = generateExportFiles({
      title: 'Test Model',
      slices: [
        {
          name: 'Combined',
          border: 'black',
          trigger: {
            type: 'ui-table',
            properties: [{ name: 'Title' }]
          },
          view: {
            name: 'Combined View',
            properties: [{ name: 'Id', type: 'string' }]
          },
          command: {
            name: 'Combine',
            properties: [{ name: 'Amount', type: 'decimal' }]
          }
        },
        {
          name: 'Combined',
          trigger: {
            type: 'ui-table',
            properties: [{ name: 'Status' }]
          },
          view: {
            name: 'Combined View',
            properties: [{ name: 'Status', type: 'string' }]
          },
          command: {
            name: 'Combine',
            properties: [{ name: 'Reason', type: 'string' }]
          }
        }
      ]
    });

    const markdown = files.find(file => file.name === 'test-model---combined.md').content;
    const json = JSON.parse(files.find(file => file.name === 'test-model---combined.json').content);

    expect(markdown).toContain('| Status |  |');
    expect(markdown).toContain('| Status |');
    expect(markdown).toContain('| Status | string |');
    expect(json.view.properties.map(property => property.name)).toEqual(['Id', 'Status']);
    expect(json.command.properties.map(property => property.name)).toEqual(['Amount', 'Reason']);
  });
});
