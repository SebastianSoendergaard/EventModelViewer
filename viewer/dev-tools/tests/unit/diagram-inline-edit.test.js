import { describe, it, expect, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const testDir = dirname(fileURLToPath(import.meta.url));
const inlineEditSource = readFileSync(
  resolve(testDir, '../../../src/viewer/diagram/inline-edit.js'),
  'utf8'
);

function loadInlineEditor(json) {
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
    JSON_CHANGED: 'json:changed',
    MODEL_CHANGED: 'model:changed',
    FILTER_TOGGLED: 'filter:toggled'
  };
  dom.window.eval(inlineEditSource);
  dom.window.EventBus.emit('file:loaded', { json });
  return { dom, changes };
}

function addTarget(dom, attributes) {
  const target = dom.window.document.createElement('div');
  Object.entries(attributes).forEach(([name, value]) => target.setAttribute(name, value));
  target.textContent = 'rendered';
  dom.window.document.getElementById('diagram').appendChild(target);
  target.dispatchEvent(new dom.window.MouseEvent('dblclick', { bubbles: true }));
  return target;
}

function getEditor(dom) {
  return dom.window.document.querySelector('[data-inline-editor]');
}

describe('diagram inline editing', () => {
  it('keeps the rendered element visible while its editor is open', () => {
    const json = { slices: [{ note: 'Original' }] };
    const { dom } = loadInlineEditor(json);
    const target = addTarget(dom, {
      'data-inline-edit-kind': 'note',
      'data-slice-index': '0'
    });

    expect(target.textContent).toContain('rendered');
    expect(getEditor(dom)).not.toBeNull();
  });

  it('edits slice identity, styling, and hints', () => {
    const json = {
      slices: [{
        name: 'Cart',
        border: '#000000',
        background: '#ffffff',
        hints: ['Keep events small']
      }]
    };
    const { dom, changes } = loadInlineEditor(json);
    addTarget(dom, {
      'data-inline-edit-kind': 'slice',
      'data-slice-index': '0'
    });
    const editor = getEditor(dom);
    const name = editor.querySelector('[data-inline-edit-field="name"]');
    const id = editor.querySelector('[data-inline-edit-field="id"]');
    const idEnabled = editor.querySelector('[data-inline-edit-field="idEnabled"]');
    const border = editor.querySelector('[data-inline-edit-field="border"]');
    const background = editor.querySelector('[data-inline-edit-field="background"]');
    const hints = editor.querySelector('[data-inline-edit-field="hints"]');
    const borderColor = editor.querySelector('[data-inline-edit-color-for="border"]');

    expect(id.disabled).toBe(true);
    expect(id.value).toBe('Cart');
    name.value = 'Checkout';
    name.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    expect(id.value).toBe('Checkout');
    idEnabled.checked = true;
    idEnabled.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    expect(id.disabled).toBe(false);
    expect(id.value).toBe('Checkout');
    id.value = 'checkout-v2';
    border.value = 'red';
    background.value = 'LightGray';
    hints.value = 'Keep events small\nUse idempotency';
    borderColor.value = '#ff0000';
    [id, border, background, hints].forEach(field =>
      field.dispatchEvent(new dom.window.Event('input', { bubbles: true }))
    );
    borderColor.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    editor.querySelector('.inline-edit-actions button:last-child').click();

    expect(changes[0].slices[0]).toMatchObject({
      name: 'Checkout',
      id: 'checkout-v2',
      border: '#ff0000',
      background: 'LightGray',
      hints: ['Keep events small', 'Use idempotency']
    });
  });

  it('allows an empty slice name', () => {
    const { dom, changes } = loadInlineEditor({
      slices: [{ name: 'Cart' }]
    });
    addTarget(dom, {
      'data-inline-edit-kind': 'slice',
      'data-slice-index': '0'
    });
    const editor = getEditor(dom);
    const name = editor.querySelector('[data-inline-edit-field="name"]');
    name.value = '';
    name.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    editor.querySelector('.inline-edit-actions button:last-child').click();

    expect(changes[0].slices[0].name).toBe('');
  });

  it('removes a disabled slice id and retains the name in the disabled field', () => {
    const json = {
      slices: [{
        name: 'Cart',
        id: 'cart-v1',
        border: '#000000',
        background: '#ffffff',
        hints: ['Remove me']
      }]
    };
    const { dom, changes } = loadInlineEditor(json);
    addTarget(dom, {
      'data-inline-edit-kind': 'slice',
      'data-slice-index': '0'
    });
    const editor = getEditor(dom);
    const id = editor.querySelector('[data-inline-edit-field="id"]');
    const idEnabled = editor.querySelector('[data-inline-edit-field="idEnabled"]');
    editor.querySelector('[data-inline-edit-field="border"]').value = '';
    editor.querySelector('[data-inline-edit-field="background"]').value = '';
    editor.querySelector('[data-inline-edit-field="hints"]').value = '';
    idEnabled.checked = false;
    idEnabled.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    editor.querySelectorAll('[data-inline-edit-field]').forEach(field =>
      field.dispatchEvent(new dom.window.Event('input', { bubbles: true }))
    );
    editor.querySelector('.inline-edit-actions button:last-child').click();

    expect(id.disabled).toBe(true);
    expect(id.value).toBe('Cart');
    expect(changes[0].slices[0]).not.toHaveProperty('id');
    expect(changes[0].slices[0]).not.toHaveProperty('border');
    expect(changes[0].slices[0]).not.toHaveProperty('background');
    expect(changes[0].slices[0]).not.toHaveProperty('hints');
  });

  it('keeps the ten most recently selected slice colors', () => {
    const { dom } = loadInlineEditor({ slices: [{ name: 'Cart' }] });
    addTarget(dom, {
      'data-inline-edit-kind': 'slice',
      'data-slice-index': '0'
    });
    const editor = getEditor(dom);
    const borderColor = editor.querySelector('[data-inline-edit-color-for="border"]');
    for (let index = 0; index < 11; index++) {
      borderColor.value = `#0000${index.toString(16).padStart(2, '0')}`;
      borderColor.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    }

    const recent = editor.querySelectorAll('.inline-edit-recent-color');
    expect(recent).toHaveLength(10);
    expect(recent[0].getAttribute('title')).toBe('#00000a');
    expect(recent[9].getAttribute('title')).toBe('#000001');
  });

  it('updates main element names and name:type properties through JSON_CHANGED', () => {
    const json = {
      slices: [{
        command: {
          name: 'Add item',
          properties: [{ name: 'CartId', type: 'string' }]
        }
      }]
    };
    const { dom, changes } = loadInlineEditor(json);
    const target = addTarget(dom, {
      'data-inline-edit-kind': 'command',
      'data-slice-index': '0'
    });
    const editor = getEditor(dom);

    const name = editor.querySelector('[data-inline-edit-field="name"]');
    const id = editor.querySelector('[data-inline-edit-field="id"]');
    const idEnabled = editor.querySelector('[data-inline-edit-field="idEnabled"]');
    const properties = editor.querySelector('[data-inline-edit-field="properties"]');
    expect(id.disabled).toBe(true);
    name.value = 'Add product';
    name.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    expect(id.value).toBe('Add product');
    idEnabled.checked = true;
    idEnabled.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    id.value = 'add-product';
    properties.value = 'CartId: Guid\nPrice: decimal';
    [id, properties].forEach(field =>
      field.dispatchEvent(new dom.window.Event('input', { bubbles: true }))
    );
    editor.querySelector('button:last-child').click();

    expect(changes).toHaveLength(1);
    expect(changes[0].slices[0].command).toEqual({
      name: 'Add product',
      id: 'add-product',
      properties: [
        { name: 'CartId', type: 'Guid' },
        { name: 'Price', type: 'decimal' }
      ]
    });
  });

  it('supports optional IDs for commands, views, and events', () => {
    [
      { kind: 'command', value: { name: 'Add item' } },
      { kind: 'view', value: { name: 'Cart view' } },
      { kind: 'event', value: { name: 'Item added' } }
    ].forEach(({ kind, value }) => {
      const element = kind === 'event' ? { events: [value] } : { [kind]: value };
      const { dom, changes } = loadInlineEditor({ slices: [element] });
      addTarget(dom, {
        'data-inline-edit-kind': kind,
        'data-slice-index': '0',
        ...(kind === 'event' ? { 'data-event-index': '0' } : {})
      });
      const editor = getEditor(dom);
      const name = editor.querySelector('[data-inline-edit-field="name"]');
      const id = editor.querySelector('[data-inline-edit-field="id"]');
      const idEnabled = editor.querySelector('[data-inline-edit-field="idEnabled"]');

      expect(id.disabled).toBe(true);
      name.value = `${value.name} renamed`;
      name.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
      expect(id.value).toBe(`${value.name} renamed`);
      idEnabled.checked = true;
      idEnabled.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
      id.value = `${kind}-id`;
      id.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
      editor.querySelector('button:last-child').click();

      const saved = changes[0].slices[0];
      const savedElement = kind === 'event' ? saved.events[0] : saved[kind];
      expect(savedElement.id).toBe(`${kind}-id`);
    });
  });

  it('edits trigger values and buttons as line-based free text', () => {
    const json = {
      slices: [{
        trigger: {
          name: 'Cart',
          type: 'ui',
          properties: [{ name: 'Product', value: 'Bike' }],
          buttons: ['Add', 'Remove']
        }
      }]
    };
    const { dom, changes } = loadInlineEditor(json);
    const target = addTarget(dom, {
      'data-inline-edit-kind': 'trigger',
      'data-slice-index': '0'
    });
    const editor = getEditor(dom);

    const name = editor.querySelector('[data-inline-edit-field="name"]');
    const swimlane = editor.querySelector('[data-inline-edit-field="swimlane"]');
    const properties = editor.querySelector('[data-inline-edit-field="properties"]');
    const buttons = editor.querySelector('[data-inline-edit-field="buttons"]');
    expect(swimlane).not.toBeNull();
    name.value = 'Shopping cart';
    swimlane.value = 'Sales';
    properties.value = 'Product: Bicycle\nPrice:';
    buttons.value = 'Add\nRemove\nClear';
    [name, swimlane, properties, buttons].forEach(field =>
      field.dispatchEvent(new dom.window.Event('input', { bubbles: true }))
    );
    editor.querySelector('button:last-child').click();

    expect(changes[0].slices[0].trigger).toEqual({
      name: 'Shopping cart',
      type: 'ui',
      swimlane: 'Sales',
      properties: [
        { name: 'Product', value: 'Bicycle' },
        { name: 'Price', value: '' }
      ],
      buttons: ['Add', 'Remove', 'Clear']
    });
  });

  it('keeps an explicitly empty trigger swimlane in the raw document', () => {
    const json = {
      slices: [{
        trigger: {
          type: 'ui'
        }
      }]
    };
    const { dom, changes } = loadInlineEditor(json);
    addTarget(dom, {
      'data-inline-edit-kind': 'trigger',
      'data-slice-index': '0'
    });
    const editor = getEditor(dom);
    const swimlane = editor.querySelector('[data-inline-edit-field="swimlane"]');
    swimlane.value = '';
    swimlane.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    editor.querySelector('button:last-child').click();

    expect(changes[0].slices[0].trigger).toHaveProperty('swimlane', '');
  });

  it('selects and deselects trigger view dependencies', () => {
    const json = {
      slices: [
        { view: { id: 'cart-view', name: 'Cart' } },
        { view: { name: 'Summary' } },
        { trigger: { type: 'ui', views: ['cart-view'] } }
      ]
    };
    const { dom, changes } = loadInlineEditor(json);
    addTarget(dom, {
      'data-inline-edit-kind': 'trigger',
      'data-slice-index': '2'
    });
    const editor = getEditor(dom);
    const views = editor.querySelector('[data-inline-edit-field="views"]');
    const options = [...views.options];

    expect(options.map(option => option.textContent)).toEqual([
      'Cart - cart-view',
      'Summary - Summary'
    ]);
    expect(options[0].selected).toBe(true);
    expect(options[1].selected).toBe(false);

    options[0].selected = false;
    options[1].selected = true;
    views.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    editor.querySelector('button:last-child').click();

    expect(changes[0].slices[2].trigger.views).toEqual(['Summary']);
  });

  it('selects and deselects event dependencies for commands and views', () => {
    const json = {
      slices: [
        {
          events: [
            { id: 'order-created', name: 'Order created' },
            { id: 'order-shipped', name: 'Order shipped' }
          ],
          command: { name: 'Create order', events: ['order-created'] }
        },
        {
          events: [
            { id: 'order-shipped', name: 'Order shipped' },
            { id: 'order-delivered', name: 'Order delivered' }
          ],
          command: {
            name: 'Ship order',
            events: ['order-shipped']
          },
          view: { name: 'Order details', events: ['Order created'] }
        }
      ]
    };
    const { dom, changes } = loadInlineEditor(json);

    addTarget(dom, {
      'data-inline-edit-kind': 'command',
      'data-slice-index': '1'
    });
    let editor = getEditor(dom);
    const events = editor.querySelector('[data-inline-edit-field="events"]');
    expect([...events.options].map(option => option.textContent)).toEqual([
      'Order shipped - order-shipped',
      'Order delivered - order-delivered'
    ]);
    expect(events.options[0].selected).toBe(true);
    events.options[0].selected = false;
    events.options[1].selected = true;
    events.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    editor.querySelector('button:last-child').click();
    expect(changes[0].slices[1].command.events).toEqual(['order-delivered']);

    addTarget(dom, {
      'data-inline-edit-kind': 'view',
      'data-slice-index': '1'
    });
    editor = getEditor(dom);
    const viewEvents = editor.querySelector('[data-inline-edit-field="events"]');
    expect(viewEvents.options[0].selected).toBe(true);
    viewEvents.options[0].selected = false;
    viewEvents.options[1].selected = true;
    viewEvents.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    editor.querySelector('button:last-child').click();
    expect(changes[1].slices[1].view.events).toEqual(['order-shipped']);

    addTarget(dom, {
      'data-inline-edit-kind': 'view',
      'data-slice-index': '1'
    });
    editor = getEditor(dom);
    const savedViewEvents = editor.querySelector('[data-inline-edit-field="events"]');
    savedViewEvents.options[1].selected = false;
    savedViewEvents.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    editor.querySelector('button:last-child').click();

    expect(changes[2].slices[1].view).not.toHaveProperty('events');
  });

  it('updates event swimlane and adds external when checked', () => {
    const json = {
      slices: [{
        events: [{
          name: 'Order created',
          swimlane: 'Orders',
          properties: [{ name: 'OrderId', type: 'Guid' }]
        }]
      }]
    };
    const { dom, changes } = loadInlineEditor(json);
    addTarget(dom, {
      'data-inline-edit-kind': 'event',
      'data-slice-index': '0',
      'data-event-index': '0'
    });
    const editor = getEditor(dom);
    const swimlane = editor.querySelector('[data-inline-edit-field="swimlane"]');
    const external = editor.querySelector('[data-inline-edit-field="external"]');
    expect([...editor.querySelectorAll('[data-inline-edit-field]')].map(field => field.dataset.inlineEditField))
      .toEqual(['name', 'id', 'idEnabled', 'swimlane', 'properties', 'external']);
    expect([...external.parentElement.children].map(child => child.tagName))
      .toEqual(['SPAN', 'INPUT']);
    swimlane.value = 'Shipping';
    external.checked = true;
    swimlane.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    external.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    editor.querySelector('button:last-child').click();

    expect(changes[0].slices[0].events[0]).toMatchObject({
      name: 'Order created',
      swimlane: 'Shipping',
      external: true
    });
  });

  it('removes event external when the checkbox is cleared', () => {
    const json = {
      slices: [{
        events: [{
          name: 'Order created',
          swimlane: 'Orders',
          external: true
        }]
      }]
    };
    const { dom, changes } = loadInlineEditor(json);
    addTarget(dom, {
      'data-inline-edit-kind': 'event',
      'data-slice-index': '0',
      'data-event-index': '0'
    });
    const editor = getEditor(dom);
    const external = editor.querySelector('[data-inline-edit-field="external"]');
    external.checked = false;
    external.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    editor.querySelector('button:last-child').click();

    expect(changes[0].slices[0].events[0]).not.toHaveProperty('external');
  });

  it('keeps test property names duplicated and does not propagate test names', () => {
    const json = {
      slices: [{
        command: { name: 'Create item' },
        tests: [{
          name: 'Adds an item',
          when: {
            command: {
              name: 'Create item',
              properties: [{ name: 'Item', value: 'one' }]
            }
          }
        }]
      }]
    };
    const { dom, changes } = loadInlineEditor(json);
    const target = addTarget(dom, {
      'data-inline-edit-kind': 'test-item',
      'data-slice-index': '0',
      'data-test-index': '0',
      'data-test-section': 'when',
      'data-test-collection': 'command',
      'data-test-item-index': '0'
    });
    const editor = getEditor(dom);

    const fields = editor.querySelectorAll('[data-inline-edit-field]');
    fields[0].value = 'Create item';
    fields[1].value = 'Item: one\nItem: two';
    fields.forEach(field => field.dispatchEvent(new dom.window.Event('input', { bubbles: true })));
    editor.querySelector('button:last-child').click();

    expect(changes[0].slices[0].command.name).toBe('Create item');
    expect(changes[0].slices[0].tests[0].when.command).toEqual({
      name: 'Create item',
      properties: [
        { name: 'Item', value: 'one' },
        { name: 'Item', value: 'two' }
      ]
    });
  });

  it('uses available model elements for test item names', () => {
    const json = {
      slices: [{
        command: { name: 'Add item', id: 'add-item' },
        view: { name: 'Cart view', id: 'cart-view' },
        events: [{ name: 'Item added', id: 'item-added' }],
        tests: [{
          given: { events: [{ name: 'Item added', properties: [] }] },
          when: { command: { name: 'Add item', properties: [] } },
          then: { views: [{ name: 'Cart view', properties: [] }] }
        }]
      }]
    };
    const { dom, changes } = loadInlineEditor(json);
    addTarget(dom, {
      'data-inline-edit-kind': 'test-item',
      'data-slice-index': '0',
      'data-test-index': '0',
      'data-test-section': 'given',
      'data-test-collection': 'events',
      'data-test-item-index': '0'
    });

    const editor = getEditor(dom);
    const name = editor.querySelector('[data-inline-edit-field="name"]');
    expect(name.tagName).toBe('SELECT');
    expect([...name.options].map(option => option.textContent))
      .toEqual(['Item added - item-added']);
    expect(name.value).toBe('Item added');

    name.value = 'Item added';
    name.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    editor.querySelector('button:last-child').click();

    expect(changes[0].slices[0].tests[0].given.events[0].name).toBe('Item added');
  });

  it('cancels without emitting a model change', () => {
    const json = { slices: [{ note: 'Original' }] };
    const { dom, changes } = loadInlineEditor(json);
    const target = addTarget(dom, {
      'data-inline-edit-kind': 'note',
      'data-slice-index': '0'
    });
    const editor = getEditor(dom);
    const text = editor.querySelector('[data-inline-edit-field]');
    text.value = 'Changed';
    text.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    editor.querySelector('button:first-of-type').click();

    expect(changes).toHaveLength(0);
    expect(target.textContent).toContain('rendered');
  });

  it('preserves the original content when a filter event occurs during editing', () => {
    const json = { slices: [{ note: 'Original' }] };
    const { dom, changes } = loadInlineEditor(json);
    const target = addTarget(dom, {
      'data-inline-edit-kind': 'note',
      'data-slice-index': '0'
    });
    const editor = getEditor(dom);

    dom.window.EventBus.emit('filter:toggled', { type: 'types', checked: false });
    editor.querySelector('button:first-of-type').click();

    expect(changes).toHaveLength(0);
    expect(target.textContent).toContain('rendered');
  });

  it('offers current/all scope for duplicate main names and rewrites name references only for all', () => {
    const json = {
      slices: [
        {
          events: [{ name: 'Item added' }],
          command: { events: ['Item added'] }
        },
        {
          events: [{ name: 'Item added' }]
        }
      ]
    };
    const { dom, changes } = loadInlineEditor(json);
    const target = addTarget(dom, {
      'data-inline-edit-kind': 'event',
      'data-slice-index': '0',
      'data-event-index': '0'
    });
    const editor = getEditor(dom);

    const name = editor.querySelector('[data-inline-edit-field="name"]');
    name.value = 'Item created';
    name.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    editor.querySelector('button:last-child').click();

    expect(changes).toHaveLength(0);
    const allButton = [...dom.window.document.querySelectorAll('button')]
      .find(button => button.textContent === 'All matching');
    allButton.click();

    expect(changes).toHaveLength(1);
    expect(changes[0].slices[0].events[0].name).toBe('Item created');
    expect(changes[0].slices[1].events[0].name).toBe('Item created');
    expect(changes[0].slices[0].command.events).toEqual(['Item created']);
  });
});
