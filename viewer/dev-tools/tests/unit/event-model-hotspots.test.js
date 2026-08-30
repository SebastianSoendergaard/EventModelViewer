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

describe('event model field preservation', () => {
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

  it('preserves optional slice hints in the enriched model', () => {
    const buildEventModel = loadEventModelBuilder();
    const model = buildEventModel({
      slices: [
        { name: 'With hints', hints: ['Use the existing handler'] },
        { name: 'Without hints' }
      ]
    });

    expect(model.slices[0].hints).toEqual(['Use the existing handler']);
    expect(Object.prototype.hasOwnProperty.call(model.slices[1], 'hints')).toBe(false);
  });

  it('rejects malformed slice hints', () => {
    const buildEventModel = loadEventModelBuilder();

    expect(() => buildEventModel({
      slices: [{ name: 'Invalid', hints: ['valid', 42] }]
    })).toThrow('expected a list of strings');
  });
});
