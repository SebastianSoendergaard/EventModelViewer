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
  const handlers = {};
  const dom = new JSDOM(
    '<!DOCTYPE html><html><body><div id="diagram"></div><div id="diagramContainer"></div><div id="diagramWrapper"></div></body></html>',
    { runScripts: 'outside-only' }
  );
  dom.window.EventBus = {
    on: (event, handler) => {
      handlers[event] = handler;
    }
  };
  dom.window.Events = {
    MODEL_CHANGED: 'MODEL_CHANGED',
    FILTER_TOGGLED: 'FILTER_TOGGLED'
  };

  const renderer = dom.window.eval(`(function() {
    ${diagramSource}
    return generateEventModelDiagram;
  })()`);

  return { dom, renderer, handlers };
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

describe('slice background rendering', () => {
  it('renders a background overlay across the slice column', () => {
    const { renderer } = loadDiagramRenderer();
    const document = new JSDOM(renderer(baseModel([
      { name: 'Colored', background: '#E8F5E9' },
      { name: 'Bordered', border: '#4CBB17', background: '#FFF8E1' }
    ]))).window.document;

    const backgrounds = document.querySelectorAll('.slice-background');
    expect(backgrounds).toHaveLength(2);
    expect(backgrounds[0].getAttribute('style')).toContain('background-color: #E8F5E9');
    expect(backgrounds[0].getAttribute('style')).toContain('grid-row: 1 /');
    expect(document.querySelectorAll('.slice-border')).toHaveLength(1);
    expect(document.querySelector('.slice-header.with-background')).not.toBeNull();
  });

  it('escapes background values in generated attributes', () => {
    const { renderer } = loadDiagramRenderer();
    const document = new JSDOM(renderer(baseModel([
      { name: 'Escaped', background: '" onmouseover="alert(1)' }
    ]))).window.document;

    const background = document.querySelector('.slice-background');
    expect(background).not.toBeNull();
    expect(background.getAttribute('onmouseover')).toBeNull();
    expect(background.getAttribute('style')).toContain('background-color: " onmouseover="alert(1');
  });

  it('hides backgrounds together with slice borders', () => {
    const { dom, renderer, handlers } = loadDiagramRenderer();
    dom.window.document.body.innerHTML = renderer(baseModel([
      { name: 'Background only', background: '#E8F5E9' },
      { name: 'Border and background', border: '#4CBB17', background: '#FFF8E1' }
    ]));

    handlers.FILTER_TOGGLED({ type: 'slices', checked: false });
    [...dom.window.document.querySelectorAll('.slice-background, .slice-border')]
      .forEach(marker => expect(marker.style.display).toBe('none'));

    handlers.FILTER_TOGGLED({ type: 'slices', checked: true });
    [...dom.window.document.querySelectorAll('.slice-background, .slice-border')]
      .forEach(marker => expect(marker.style.display).toBe('block'));
  });
});
