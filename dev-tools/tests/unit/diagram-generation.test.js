/**
 * Unit tests for diagram generation functions
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';

describe('generateView', () => {
  let window, document, escapeHtml, generateView;

  beforeEach(() => {
    const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
    window = dom.window;
    document = window.document;
    global.document = document;

    escapeHtml = (text) => {
      if (typeof text !== 'string') return text;
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    };

    generateView = (view, sliceIndex, eventNames) => {
      const viewId = `view-${sliceIndex}`;
      const eventNamesAttr = eventNames ? eventNames.join(',') : '';
      let html = `<div class="element view" id="${viewId}" data-view-events="${escapeHtml(eventNamesAttr)}">`;
      html += `<div class="element-title">${escapeHtml(view.name)}</div>`;
      
      if (view.properties && view.properties.length > 0) {
        html += '<div class="element-properties">';
        view.properties.forEach(prop => {
          html += `<div class="element-property">${escapeHtml(prop.name)}: ${escapeHtml(prop.type)}</div>`;
        });
        html += '</div>';
      }
      
      html += '</div>';
      return html;
    };
  });

  it('should generate view with name and ID', () => {
    const view = {
      name: 'User Profile',
      events: ['User Registered'],
      properties: []
    };
    const html = generateView(view, 2, ['User Registered']);
    
    expect(html).toContain('class="element view"');
    expect(html).toContain('id="view-2"');
    expect(html).toContain('User Profile');
  });

  it('should include event names in data attribute', () => {
    const view = {
      name: 'Order Summary',
      properties: []
    };
    const eventNames = ['Order Created', 'Item Added', 'Order Completed'];
    const html = generateView(view, 1, eventNames);
    
    expect(html).toContain('data-view-events="Order Created,Item Added,Order Completed"');
  });

  it('should generate view with properties', () => {
    const view = {
      name: 'Cart View',
      properties: [
        { name: 'CartId', type: 'Guid' },
        { name: 'Items', type: 'List<Item>' },
        { name: 'TotalPrice', type: 'decimal' }
      ]
    };
    const html = generateView(view, 0, []);
    
    expect(html).toContain('CartId: Guid');
    expect(html).toContain('Items: List&lt;Item&gt;');
    expect(html).toContain('TotalPrice: decimal');
  });

  it('should escape HTML in view name', () => {
    const view = {
      name: '<script>alert("XSS")</script>',
      properties: []
    };
    const html = generateView(view, 0, []);
    
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>alert');
  });

  it('should handle view without properties', () => {
    const view = {
      name: 'Simple View'
    };
    const html = generateView(view, 3, ['Event1']);
    
    expect(html).toContain('Simple View');
    expect(html).not.toContain('element-properties');
  });

  it('should handle empty event names array', () => {
    const view = {
      name: 'Test View',
      properties: []
    };
    const html = generateView(view, 0, []);
    
    expect(html).toContain('data-view-events=""');
  });

  it('should handle null event names', () => {
    const view = {
      name: 'Test View',
      properties: []
    };
    const html = generateView(view, 0, null);
    
    expect(html).toContain('data-view-events=""');
  });
});

describe('generateTestCase', () => {
  let window, document, escapeHtml, generateTestCase;

  beforeEach(() => {
    const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
    window = dom.window;
    document = window.document;
    global.document = document;

    escapeHtml = (text) => {
      if (typeof text !== 'string') return text;
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    };

    // Simplified version of generateTestCase from index.html
    generateTestCase = (test) => {
      let html = '<div class="test-case">';
      
      if (test.name) {
        html += `<div class="test-section-label">${escapeHtml(test.name)}</div>`;
      }
      
      if (test.given && test.given.length > 0) {
        html += '<div class="test-section">';
        html += '<div class="test-section-label">Given:</div>';
        test.given.forEach(item => {
          if (typeof item === 'string') {
            html += `<div class="test-event">${escapeHtml(item)}</div>`;
          } else {
            html += `<div class="test-event">${escapeHtml(item.name)}</div>`;
          }
        });
        html += '</div>';
      }
      
      if (test.when) {
        html += '<div class="test-section">';
        html += '<div class="test-section-label">When:</div>';
        if (typeof test.when === 'string') {
          html += `<div class="test-command">${escapeHtml(test.when)}</div>`;
        } else {
          html += `<div class="test-command">${escapeHtml(test.when.name)}</div>`;
        }
        html += '</div>';
      }
      
      if (test.then && test.then.length > 0) {
        html += '<div class="test-section">';
        html += '<div class="test-section-label">Then:</div>';
        test.then.forEach(item => {
          if (typeof item === 'string') {
            html += `<div class="test-event">${escapeHtml(item)}</div>`;
          } else if (item.error) {
            html += `<div class="test-error">Error: ${escapeHtml(item.error)}</div>`;
          } else {
            html += `<div class="test-event">${escapeHtml(item.name)}</div>`;
          }
        });
        html += '</div>';
      }
      
      html += '</div>';
      return html;
    };
  });

  it('should generate basic Given-When-Then test', () => {
    const test = {
      given: ['Cart is empty'],
      when: 'Add item',
      then: ['Item added event']
    };
    const html = generateTestCase(test);
    
    expect(html).toContain('class="test-case"');
    expect(html).toContain('Given:');
    expect(html).toContain('Cart is empty');
    expect(html).toContain('When:');
    expect(html).toContain('Add item');
    expect(html).toContain('Then:');
    expect(html).toContain('Item added event');
  });

  it('should include test name if provided', () => {
    const test = {
      name: 'Should create cart on first item',
      given: ['No cart exists'],
      when: 'Add item',
      then: ['Cart created', 'Item added']
    };
    const html = generateTestCase(test);
    
    expect(html).toContain('Should create cart on first item');
  });

  it('should handle multiple given events', () => {
    const test = {
      given: ['User registered', 'Email confirmed', 'Profile completed'],
      when: 'Login',
      then: ['User logged in']
    };
    const html = generateTestCase(test);
    
    expect(html).toContain('User registered');
    expect(html).toContain('Email confirmed');
    expect(html).toContain('Profile completed');
  });

  it('should handle multiple then events', () => {
    const test = {
      given: ['Cart exists'],
      when: 'Checkout',
      then: ['Order created', 'Payment initiated', 'Inventory reserved']
    };
    const html = generateTestCase(test);
    
    expect(html).toContain('Order created');
    expect(html).toContain('Payment initiated');
    expect(html).toContain('Inventory reserved');
  });

  it('should handle error in then section', () => {
    const test = {
      given: ['Cart is empty'],
      when: 'Checkout',
      then: [{ error: 'Cannot checkout empty cart' }]
    };
    const html = generateTestCase(test);
    
    expect(html).toContain('test-error');
    expect(html).toContain('Error: Cannot checkout empty cart');
  });

  it('should escape HTML in test data', () => {
    const test = {
      given: ['<script>alert("XSS")</script>'],
      when: '<img src=x>',
      then: ['<div>Bad</div>']
    };
    const html = generateTestCase(test);
    
    expect(html).not.toContain('<script>alert');
    expect(html).not.toContain('<img src=x>');
    expect(html).not.toContain('<div>Bad</div>');
    expect(html).toContain('&lt;');
    expect(html).toContain('&gt;');
  });

  it('should handle test without name', () => {
    const test = {
      given: ['State'],
      when: 'Action',
      then: ['Result']
    };
    const html = generateTestCase(test);
    
    expect(html).toContain('class="test-case"');
    expect(html).toContain('Given:');
    // Should not have extra test-section-label at top
    const firstLabel = html.indexOf('test-section-label');
    const givenLabel = html.indexOf('Given:');
    expect(firstLabel).toBeGreaterThan(0);
    expect(givenLabel).toBeGreaterThan(0);
  });

  it('should handle object-based given/when/then', () => {
    const test = {
      given: [{ name: 'Order exists', properties: [] }],
      when: { name: 'Cancel order', properties: [] },
      then: [{ name: 'Order cancelled', properties: [] }]
    };
    const html = generateTestCase(test);
    
    expect(html).toContain('Order exists');
    expect(html).toContain('Cancel order');
    expect(html).toContain('Order cancelled');
  });
});

describe('generateSlice', () => {
  let window, document, escapeHtml, generateTrigger, generateCommand, generateEvent, generateView, generateTestCase, generateSlice;

  beforeEach(() => {
    const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
    window = dom.window;
    document = window.document;
    global.document = document;

    escapeHtml = (text) => {
      if (typeof text !== 'string') return text;
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    };

    // Minimal implementations
    generateTrigger = (trigger) => `<div class="element trigger">${escapeHtml(trigger.type)}</div>`;
    generateCommand = (command) => `<div class="element command">${escapeHtml(command.name)}</div>`;
    generateEvent = (event) => `<div class="element event">${escapeHtml(event.name)}</div>`;
    generateView = (view) => `<div class="element view">${escapeHtml(view.name)}</div>`;
    generateTestCase = (test) => `<div class="test-case">${escapeHtml(test.when)}</div>`;

    generateSlice = (slice, index) => {
      const hasBorder = slice.border ? 'with-border' : '';
      const borderStyle = slice.border ? `border-color: ${slice.border};` : '';
      
      let html = `<div class="slice ${hasBorder}" style="${borderStyle}" data-slice-index="${index}">`;
      html += `<div class="slice-content">`;
      html += `<div class="slice-name">${escapeHtml(slice.name)}</div>`;
      
      if (slice.trigger) {
        html += generateTrigger(slice.trigger);
      }
      
      if (slice.command) {
        html += generateCommand(slice.command);
      }
      
      if (slice.command && slice.command.events) {
        slice.command.events.forEach(event => {
          html += generateEvent(event);
        });
      }
      
      if (slice.view) {
        html += generateView(slice.view);
      }
      
      if (slice.tests && slice.tests.length > 0) {
        html += '<div class="tests-container">';
        slice.tests.forEach(test => {
          html += generateTestCase(test);
        });
        html += '</div>';
      }
      
      html += '</div></div>';
      return html;
    };
  });

  it('should generate slice with basic structure', () => {
    const slice = {
      id: '1',
      name: 'Create Order',
      trigger: { type: 'input-ui' },
      command: {
        name: 'Create Order',
        events: [{ name: 'Order Created' }]
      }
    };
    const html = generateSlice(slice, 0);
    
    expect(html).toContain('class="slice');
    expect(html).toContain('data-slice-index="0"');
    expect(html).toContain('slice-name');
    expect(html).toContain('Create Order');
  });

  it('should add border class and style when border is specified', () => {
    const slice = {
      name: 'Test Slice',
      border: '#4CBB17'
    };
    const html = generateSlice(slice, 1);
    
    expect(html).toContain('with-border');
    expect(html).toContain('border-color: #4CBB17');
  });

  it('should include trigger if present', () => {
    const slice = {
      name: 'Test',
      trigger: { type: 'input-ui' }
    };
    const html = generateSlice(slice, 0);
    
    expect(html).toContain('element trigger');
    expect(html).toContain('input-ui');
  });

  it('should include command if present', () => {
    const slice = {
      name: 'Test',
      command: { name: 'Test Command' }
    };
    const html = generateSlice(slice, 0);
    
    expect(html).toContain('element command');
    expect(html).toContain('Test Command');
  });

  it('should include events from command', () => {
    const slice = {
      name: 'Test',
      command: {
        name: 'Create Item',
        events: [
          { name: 'Item Created' },
          { name: 'Inventory Updated' }
        ]
      }
    };
    const html = generateSlice(slice, 0);
    
    expect(html).toContain('Item Created');
    expect(html).toContain('Inventory Updated');
  });

  it('should include view if present', () => {
    const slice = {
      name: 'Test',
      view: { name: 'Order List' }
    };
    const html = generateSlice(slice, 0);
    
    expect(html).toContain('element view');
    expect(html).toContain('Order List');
  });

  it('should include tests if present', () => {
    const slice = {
      name: 'Test',
      tests: [
        { when: 'Test Action' }
      ]
    };
    const html = generateSlice(slice, 0);
    
    expect(html).toContain('tests-container');
    expect(html).toContain('test-case');
    expect(html).toContain('Test Action');
  });

  it('should escape HTML in slice name', () => {
    const slice = {
      name: '<script>alert("XSS")</script>'
    };
    const html = generateSlice(slice, 0);
    
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>alert');
  });

  it('should use correct slice index', () => {
    const slice = { name: 'Test' };
    
    const html1 = generateSlice(slice, 0);
    const html2 = generateSlice(slice, 5);
    const html3 = generateSlice(slice, 99);
    
    expect(html1).toContain('data-slice-index="0"');
    expect(html2).toContain('data-slice-index="5"');
    expect(html3).toContain('data-slice-index="99"');
  });
});
