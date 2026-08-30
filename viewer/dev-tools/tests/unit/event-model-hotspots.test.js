import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const testDir = dirname(fileURLToPath(import.meta.url));
const eventModelSource = readFileSync(
  resolve(testDir, '../../../src/event-model/event-model.js'),
  'utf8'
);

function loadEventModelBuilder() {
  const events = {
    FILE_LOADED: 'FILE_LOADED',
    JSON_CHANGED: 'JSON_CHANGED',
    MODEL_CHANGED: 'MODEL_CHANGED'
  };
  const eventBus = {
    on: () => {},
    emit: () => {}
  };

  return new Function(
    'EventBus',
    'Events',
    `${eventModelSource}\nreturn buildEventModel;`
  )(eventBus, events);
}

describe('event model hotspot preservation', () => {
  it('keeps model and slice hotspots in the enriched model', () => {
    const buildEventModel = loadEventModelBuilder();
    const model = buildEventModel({
      title: 'Hotspot Model',
      hotspots: ['Workflow starts'],
      slices: [
        {
          name: 'Create',
          hotspots: ['Input received'],
          trigger: { name: 'Create', swimlane: 'User', type: 'ui-input' }
        }
      ]
    });

    expect(model.hotspots).toEqual(['Workflow starts']);
    expect(model.slices[0].hotspots).toEqual(['Input received']);
    expect(model.swimlanes.trigger).toEqual([
      { type: 'role', role: 'User', label: 'User' }
    ]);
  });
});
