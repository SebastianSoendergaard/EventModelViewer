import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const testDir = dirname(fileURLToPath(import.meta.url));
const contextMenuSource = readFileSync(
  resolve(testDir, '../../../src/viewer/diagram/context-menu.js'),
  'utf8'
);

function loadContextMenu(json) {
  const dom = new JSDOM(
    '<!DOCTYPE html><html><body><div id="diagramContainer"><div id="diagram"></div></div></body></html>',
    { runScripts: 'outside-only', pretendToBeVisual: true }
  );
  const listeners = new Map();
  const changes = [];
  dom.window.EventBus = {
    on(event, callback) {
      const callbacks = listeners.get(event) || [];
      callbacks.push(callback);
      listeners.set(event, callbacks);
    },
    emit(event, payload) {
      if (event === 'json:changed') changes.push(payload.json);
      (listeners.get(event) || []).forEach(callback => callback(payload));
    }
  };
  dom.window.Events = {
    FILE_LOADED: 'file:loaded',
    JSON_CHANGED: 'json:changed'
  };
  dom.window.eval(contextMenuSource);
  dom.window.EventBus.emit('file:loaded', { json });
  return { dom, changes };
}

function openMenu(dom, attributes = {}, className = '') {
  const target = dom.window.document.createElement('div');
  target.className = className;
  Object.entries(attributes).forEach(([name, value]) => target.setAttribute(name, value));
  dom.window.document.getElementById('diagram').appendChild(target);
  target.dispatchEvent(new dom.window.MouseEvent('contextmenu', {
    bubbles: true,
    clientX: 20,
    clientY: 20
  }));
  return dom.window.document.querySelector('.diagram-context-menu');
}

describe('diagram context menu', () => {
  it('adds a named slice from the diagram context menu', () => {
    const { dom, changes } = loadContextMenu({ slices: [] });
    const menu = openMenu(dom);

    expect([...menu.querySelectorAll('button')].map(button => button.textContent))
      .toEqual(['Add slice']);
    menu.querySelector('[data-context-menu-action="add-slice"]').click();

    expect(changes[0].slices).toEqual([{ name: 'New slice' }]);
  });

  it('offers slice element actions and adds each supported element', () => {
    const { dom, changes } = loadContextMenu({ slices: [{ name: 'Cart' }] });
    const attributes = {
      'data-slice-index': '0'
    };
    const labels = ['Add Trigger', 'Add view', 'Add command', 'Add event', 'Add note', 'Add hotspot', 'Add test', 'Add slice'];
    const menu = openMenu(dom, attributes);
    expect([...menu.querySelectorAll('button')].map(button => button.textContent)).toEqual(labels);

    [
      'add-trigger',
      'add-view',
      'add-command',
      'add-event',
      'add-note',
      'add-hotspot',
      'add-test'
    ].forEach(action => {
      openMenu(dom, attributes).querySelector(`[data-context-menu-action="${action}"]`).click();
    });

    const slice = changes.at(-1).slices[0];
    expect(slice.trigger).toMatchObject({ name: 'New Trigger', type: 'ui', properties: [] });
    expect(slice.view).toMatchObject({ name: 'New View', properties: [], events: [] });
    expect(slice.command).toMatchObject({ name: 'New Command', properties: [], events: [] });
    expect(slice.events).toEqual([{ name: 'New Event', properties: [] }]);
    expect(slice.note).toBe('New note');
    expect(slice.hotspots).toEqual(['New hotspot']);
    expect(slice.tests).toEqual([{ name: 'New test' }]);
  });

  it('adds items to the Given, When, and Then sections', () => {
    const { dom, changes } = loadContextMenu({
      slices: [{ name: 'Cart', tests: [{ name: 'Creates cart' }] }]
    });
    const sectionAttributes = section => ({
      'data-slice-index': '0',
      'data-test-index': '0',
      'data-context-menu-test-section': section
    });

    let menu = openMenu(dom, sectionAttributes('given'));
    expect([...menu.querySelectorAll('button')].map(button => button.textContent))
      .toEqual(['Add event']);
    menu.querySelector('[data-context-menu-action="add-test-event"]').click();

    menu = openMenu(dom, sectionAttributes('when'));
    expect([...menu.querySelectorAll('button')].map(button => button.textContent))
      .toEqual(['Add command']);
    menu.querySelector('[data-context-menu-action="add-test-command"]').click();

    menu = openMenu(dom, sectionAttributes('then'));
    expect([...menu.querySelectorAll('button')].map(button => button.textContent))
      .toEqual(['Add event', 'Add view']);
    menu.querySelector('[data-context-menu-action="add-test-event"]').click();
    openMenu(dom, sectionAttributes('then'))
      .querySelector('[data-context-menu-action="add-test-view"]').click();

    const test = changes.at(-1).slices[0].tests[0];
    expect(test.given.events).toEqual([{ name: 'New Event', properties: [] }]);
    expect(test.when.command).toEqual({ name: 'New Command', properties: [] });
    expect(test.then.events).toEqual([{ name: 'New Event', properties: [] }]);
    expect(test.then.views).toEqual([{ name: 'New View', properties: [] }]);
  });

  it('offers edit and delete for an element and deletes its raw entry', () => {
    const { dom, changes } = loadContextMenu({
      slices: [{ name: 'Cart', command: { name: 'Add item', properties: [] } }]
    });
    const menu = openMenu(dom, {
      'data-inline-edit-kind': 'command',
      'data-slice-index': '0'
    });

    expect([...menu.querySelectorAll('button')].map(button => button.textContent))
      .toEqual(['Edit', 'Delete']);
    expect(menu.querySelectorAll('hr')).toHaveLength(0);
    menu.querySelector('[data-context-menu-action="delete-element"]').click();

    expect(changes[0].slices[0]).not.toHaveProperty('command');
  });

  it('offers edit and delete for a slice', () => {
    const { dom, changes } = loadContextMenu({
      slices: [{ name: 'Cart' }]
    });
    const menu = openMenu(dom, {
      'data-inline-edit-kind': 'slice',
      'data-slice-index': '0'
    }, 'slice-header');

    expect([...menu.querySelectorAll('button')].slice(0, 2).map(button => button.textContent))
      .toEqual(['Edit', 'Delete']);
    expect(menu.querySelectorAll('hr')).toHaveLength(2);
    menu.querySelector('[data-context-menu-action="delete-element"]').click();

    expect(changes[0].slices).toEqual([]);
  });

  it('offers only edit and delete for the test case outside its sections', () => {
    const { dom, changes } = loadContextMenu({
      slices: [{ name: 'Cart', tests: [{ name: 'Creates cart' }] }]
    });
    const menu = openMenu(dom, {
      'data-inline-edit-kind': 'test-name',
      'data-slice-index': '0',
      'data-test-index': '0'
    }, 'test-case');

    expect([...menu.querySelectorAll('button')].map(button => button.textContent))
      .toEqual(['Edit', 'Delete']);
    menu.querySelector('[data-context-menu-action="delete-element"]').click();

    expect(changes[0].slices[0].tests).toEqual([]);
  });

  it('offers only edit and delete for an element inside a test case', () => {
    const { dom, changes } = loadContextMenu({
      slices: [{
        name: 'Cart',
        tests: [{
          name: 'Creates cart',
          given: { events: [{ name: 'Cart exists' }] }
        }]
      }]
    });
    const menu = openMenu(dom, {
      'data-inline-edit-kind': 'test-item',
      'data-slice-index': '0',
      'data-test-index': '0',
      'data-test-section': 'given',
      'data-test-collection': 'events',
      'data-test-item-index': '0'
    }, 'test-event');

    expect([...menu.querySelectorAll('button')].map(button => button.textContent))
      .toEqual(['Edit', 'Delete']);
    menu.querySelector('[data-context-menu-action="delete-element"]').click();

    expect(changes[0].slices[0].tests[0].given.events).toEqual([]);
  });
});
