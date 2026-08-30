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

  return { dom, renderer };
}

function modelWithHotspots() {
  return {
    title: 'Hotspot Model',
    hotspots: ['Workflow starts', 'Workflow completes'],
    slices: [
      {
        name: 'Create',
        hotspots: ['Input received', 'Validation passed']
      },
      {
        name: 'Display',
        hotspots: []
      }
    ],
    swimlanes: {
      trigger: [{ type: 'all', label: 'All Triggers' }],
      event: [{ type: 'all', label: 'All Events' }]
    }
  };
}

describe('hotspot diagram rendering', () => {
  it('renders model hotspots before the grid in source order', () => {
    const { dom, renderer } = loadDiagramRenderer();
    const html = renderer(modelWithHotspots());
    const document = new JSDOM(html).window.document;

    const modelHotspots = document.querySelector('.model-hotspots');
    expect(modelHotspots).not.toBeNull();
    expect([...modelHotspots.querySelectorAll('.element.hotspot')].map(el => el.textContent))
      .toEqual(['Workflow starts', 'Workflow completes']);
    expect(html.indexOf('model-hotspots')).toBeLessThan(html.indexOf('swimlane-grid'));
    expect(modelHotspots.querySelector('h2, h3, h4')).toBeNull();
    expect(dom.window.document.querySelector('#diagram')).not.toBeNull();
  });

  it('uses one aligned slice row and preserves empty cells', () => {
    const { renderer } = loadDiagramRenderer();
    const document = new JSDOM(renderer(modelWithHotspots())).window.document;
    const hotspotGroups = document.querySelectorAll('.slice-hotspots-group');

    expect(hotspotGroups).toHaveLength(1);
    expect([...hotspotGroups[0].querySelectorAll('.element.hotspot')].map(el => el.textContent))
      .toEqual(['Input received', 'Validation passed']);
    expect(hotspotGroups[0].parentElement.getAttribute('style')).toContain('grid-row: 2');
    expect(document.querySelector('.hotspot-lane-header')).not.toBeNull();
    expect(document.querySelector('.grid-cell[style*="grid-column: 3"][style*="grid-row: 2"]')).not.toBeNull();
  });

  it('ignores singular legacy hotspot fields', () => {
    const { renderer } = loadDiagramRenderer();
    const model = modelWithHotspots();
    model.hotspots = undefined;
    model.slices[0].hotspots = undefined;
    model.slices[0].hotspot = 'Legacy hotspot';

    const document = new JSDOM(renderer(model)).window.document;

    expect(document.querySelector('.model-hotspots')).toBeNull();
    expect(document.querySelector('.slice-hotspots-group')).toBeNull();
    expect(document.querySelector('.element.hotspot')).toBeNull();
  });

  it('escapes hotspot text', () => {
    const { renderer } = loadDiagramRenderer();
    const model = modelWithHotspots();
    model.hotspots = ['<script>alert(1)</script>'];

    const document = new JSDOM(renderer(model)).window.document;

    expect(document.querySelector('.model-hotspots .element-title').textContent)
      .toBe('<script>alert(1)</script>');
    expect(document.querySelector('.model-hotspots').innerHTML).not.toContain('<script>');
  });
});
