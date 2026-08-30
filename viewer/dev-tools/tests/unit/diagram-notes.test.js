import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const testDir = dirname(fileURLToPath(import.meta.url));
const diagramSource = readFileSync(
  resolve(testDir, '../../../src/viewer/diagram/diagram.js'),
  'utf8'
);

function loadDiagramRenderer() {
  const dom = new JSDOM(
    '<!DOCTYPE html><html><body><div id="diagram"></div><div id="diagramContainer"></div><div id="diagramWrapper"></div></body></html>',
    { runScripts: 'outside-only' }
  );
  dom.window.EventBus = { on: () => {} };
  dom.window.Events = {
    MODEL_CHANGED: 'MODEL_CHANGED',
    FILTER_TOGGLED: 'FILTER_TOGGLED'
  };

  const renderer = dom.window.eval(`(function() {
    ${diagramSource}
    return generateEventModelDiagram;
  })()`);

  return { renderer };
}

function baseModel(slices) {
  return {
    slices,
    swimlanes: {
      trigger: [{ type: 'all', label: 'All Triggers' }],
      event: [{ type: 'all', label: 'All Events' }]
    }
  };
}

describe('note diagram rendering', () => {
  it('renders the fixed Note title and text before view and command', () => {
    const { renderer } = loadDiagramRenderer();
    const model = baseModel([{
      name: 'Annotated',
      note: 'Explain <this> slice',
      view: { id: 'view-1', name: 'View', events: [] },
      command: { id: 'command-1', name: 'Command', events: [] }
    }]);

    const document = new JSDOM(renderer(model)).window.document;
    const group = document.querySelector('.cmdview-group');
    const elements = [...group.children];

    expect(elements.map(element => element.className)).toEqual([
      'element note',
      'element view',
      'element command'
    ]);
    expect(elements[0].querySelector('.element-title').textContent).toBe('Note');
    expect(elements[0].querySelector('.element-text').textContent).toBe('Explain <this> slice');
    expect(elements[0].innerHTML).not.toContain('<this>');
  });

  it('renders a note without a view or command', () => {
    const { renderer } = loadDiagramRenderer();
    const document = new JSDOM(renderer(baseModel([
      { name: 'Annotated', note: 'Standalone note' }
    ]))).window.document;

    expect(document.querySelectorAll('.element.note')).toHaveLength(1);
    expect(document.querySelector('.element.note .element-text').textContent).toBe('Standalone note');
  });
});
