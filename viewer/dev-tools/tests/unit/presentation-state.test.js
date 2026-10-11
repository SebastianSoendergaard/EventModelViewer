import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testDirectory = dirname(fileURLToPath(import.meta.url));
const sourcePath = join(testDirectory, '..', '..', '..', 'src', 'presentation-state', 'presentation-state.js');
const source = readFileSync(sourcePath, 'utf8');

function createPresentationStateHarness() {
  const listeners = new Map();
  const emittedEvents = [];
  const values = new Map();
  const localStorage = {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    }
  };
  const Events = {
    FILE_LOADED: 'file:loaded',
    FILTER_TOGGLED: 'filter:toggled',
    PRESENTATION_STATE_LOADED: 'presentation-state:loaded',
    PRESENTATION_STATE_CHANGED: 'presentation-state:changed',
    PRESENTATION_IDENTITY_CHANGED: 'presentation-identity:changed'
  };
  const EventBus = {
    on(name, callback) {
      const callbacks = listeners.get(name) || [];
      callbacks.push(callback);
      listeners.set(name, callbacks);
    },
    emit(name, payload) {
      emittedEvents.push({ name, payload });
      (listeners.get(name) || []).forEach(callback => callback(payload));
    }
  };

  new Function('EventBus', 'Events', 'localStorage', 'window', 'console', source)(
    EventBus,
    Events,
    localStorage,
    { addEventListener() {} },
    console
  );

  return {
    Events,
    EventBus,
    localStorage,
    emittedEvents,
    emit(name, payload) {
      EventBus.emit(name, payload);
    },
    latestLoadedState() {
      return emittedEvents
        .filter(event => event.name === Events.PRESENTATION_STATE_LOADED)
        .at(-1)?.payload;
    }
  };
}

describe('per-file presentation state', () => {
  it('restores standalone filters, zoom, and pan by filename', () => {
    const harness = createPresentationStateHarness();
    const identity = { type: 'standalone', fileName: 'orders.emj' };

    harness.emit(harness.Events.FILE_LOADED, { presentationIdentity: identity });
    expect(harness.latestLoadedState()).toMatchObject({
      hasSavedState: false,
      state: {
        filters: { slices: true, tests: true, types: true, swimlanes: true },
        zoom: null,
        scrollLeft: 0,
        scrollTop: 0
      }
    });

    harness.emit(harness.Events.FILTER_TOGGLED, { type: 'tests', checked: false });
    harness.emit(harness.Events.PRESENTATION_STATE_CHANGED, {
      zoom: 1.35,
      scrollLeft: 120,
      scrollTop: 45
    });
    harness.emit(harness.Events.FILE_LOADED, {
      presentationIdentity: { type: 'standalone', fileName: 'other.emj' }
    });
    expect(harness.latestLoadedState().state).toMatchObject({
      filters: { tests: true },
      zoom: null,
      scrollLeft: 0,
      scrollTop: 0
    });

    harness.emit(harness.Events.FILE_LOADED, { presentationIdentity: identity });
    expect(harness.latestLoadedState()).toMatchObject({
      hasSavedState: true,
      state: {
        filters: { tests: false },
        zoom: 1.35,
        scrollLeft: 120,
        scrollTop: 45
      }
    });
  });

  it('isolates server file state by root and relative path', () => {
    const harness = createPresentationStateHarness();
    const identity = {
      type: 'server',
      root: 'C:\\models',
      path: 'orders\\main.emj'
    };

    harness.emit(harness.Events.FILE_LOADED, { presentationIdentity: identity });
    harness.emit(harness.Events.FILTER_TOGGLED, { type: 'types', checked: false });
    harness.emit(harness.Events.PRESENTATION_STATE_CHANGED, {
      zoom: 1.5,
      scrollLeft: 30,
      scrollTop: 10
    });
    harness.emit(harness.Events.FILE_LOADED, {
      presentationIdentity: { ...identity, root: 'D:\\models' }
    });
    expect(harness.latestLoadedState()).toMatchObject({
      hasSavedState: false,
      state: { filters: { types: true }, zoom: null }
    });

    harness.emit(harness.Events.FILE_LOADED, {
      presentationIdentity: { ...identity, path: 'renamed.emj' }
    });
    expect(harness.latestLoadedState().hasSavedState).toBe(false);

    harness.emit(harness.Events.FILE_LOADED, { presentationIdentity: identity });
    expect(harness.latestLoadedState()).toMatchObject({
      hasSavedState: true,
      state: {
        filters: { types: false },
        zoom: 1.5,
        scrollLeft: 30,
        scrollTop: 10
      }
    });
  });

  it('retains pending state before switching identities', () => {
    const harness = createPresentationStateHarness();
    harness.emit(harness.Events.FILE_LOADED, {
      presentationIdentity: { type: 'standalone', fileName: 'current.emj' }
    });
    harness.emit(harness.Events.FILTER_TOGGLED, { type: 'slices', checked: false });

    harness.emit(harness.Events.FILE_LOADED, {
      presentationIdentity: { type: 'standalone', fileName: 'next.emj' }
    });
    harness.emit(harness.Events.FILE_LOADED, {
      presentationIdentity: { type: 'standalone', fileName: 'current.emj' }
    });

    expect(harness.latestLoadedState().state.filters.slices).toBe(false);
  });
});
