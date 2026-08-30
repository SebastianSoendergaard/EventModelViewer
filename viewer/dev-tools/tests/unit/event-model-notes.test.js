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

describe('event model notes', () => {
  it('preserves non-empty slice notes and omits whitespace-only notes', () => {
    const buildEventModel = loadEventModelBuilder();
    const model = buildEventModel({
      slices: [
        { name: 'With note', note: 'Explain this slice' },
        { name: 'Without note', note: '   ' }
      ]
    });

    expect(model.slices[0].note).toBe('Explain this slice');
    expect(Object.prototype.hasOwnProperty.call(model.slices[1], 'note')).toBe(false);
  });

  it('rejects non-string slice notes', () => {
    const buildEventModel = loadEventModelBuilder();

    expect(() => buildEventModel({
      slices: [{ name: 'Invalid', note: { text: 'wrong shape' } }]
    })).toThrow('expected a string');
  });
});
