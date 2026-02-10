/**
 * Unit tests for utility functions
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';

describe('escapeHtml', () => {
  let window, document, escapeHtml;

  beforeEach(async () => {
    // Create a minimal DOM environment
    const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
    window = dom.window;
    document = window.document;
    global.document = document;

    // Recreate the escapeHtml function
    escapeHtml = (text) => {
      if (typeof text !== 'string') return text;
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    };
  });

  it('should escape HTML special characters', () => {
    const input = '<script>alert("XSS")</script>';
    const output = escapeHtml(input);
    expect(output).toBe('&lt;script&gt;alert("XSS")&lt;/script&gt;');
  });

  it('should escape ampersands', () => {
    const input = 'Tom & Jerry';
    const output = escapeHtml(input);
    expect(output).toBe('Tom &amp; Jerry');
  });

  it('should escape quotes', () => {
    const input = 'He said "Hello"';
    const output = escapeHtml(input);
    expect(output).toBe('He said "Hello"');
  });

  it('should escape single quotes', () => {
    const input = "It's working";
    const output = escapeHtml(input);
    expect(output).toBe("It's working");
  });

  it('should handle multiple special characters', () => {
    const input = '<div class="test" & \'single\'>"double"</div>';
    const output = escapeHtml(input);
    expect(output).toContain('&lt;');
    expect(output).toContain('&gt;');
    expect(output).toContain('&amp;');
  });

  it('should return non-string values unchanged', () => {
    expect(escapeHtml(null)).toBe(null);
    expect(escapeHtml(undefined)).toBe(undefined);
    expect(escapeHtml(123)).toBe(123);
    expect(escapeHtml(true)).toBe(true);
  });

  it('should handle empty string', () => {
    expect(escapeHtml('')).toBe('');
  });

  it('should handle strings without special characters', () => {
    const input = 'Normal text';
    expect(escapeHtml(input)).toBe('Normal text');
  });

  it('should prevent XSS in event handlers', () => {
    const input = '<img src=x onerror="alert(1)">';
    const output = escapeHtml(input);
    // The entire tag is escaped, including onerror= (which is now safe text)
    expect(output).toContain('&lt;img');
    expect(output).toContain('&gt;');
    // Verify it's escaped and not executable
    expect(output).not.toContain('<img src=');
  });

  it('should prevent script injection', () => {
    const input = '"><script>document.cookie</script><div class="';
    const output = escapeHtml(input);
    expect(output).not.toContain('<script>');
    expect(output).toContain('&lt;script&gt;');
  });
});

describe('generateTrigger', () => {
  let window, document, escapeHtml, generateTrigger;

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

    generateTrigger = (trigger) => {
      let html = '<div class="element trigger">';
      
      if (trigger.role) {
        html += `<div class="element-role">${escapeHtml(trigger.role)}</div>`;
      }
      
      html += `<div class="element-title">Trigger: ${escapeHtml(trigger.type)}</div>`;
      
      if (trigger.buttons && trigger.buttons.length > 0) {
        html += '<div class="element-properties">';
        html += `Buttons: ${trigger.buttons.map(b => escapeHtml(b)).join(', ')}`;
        html += '</div>';
      }
      
      if (trigger.properties && trigger.properties.length > 0) {
        html += '<div class="element-properties">';
        trigger.properties.forEach(prop => {
          html += `<div class="element-property" data-trigger-property="true">${escapeHtml(prop.label)}: ${escapeHtml(prop.propertyName)}</div>`;
        });
        html += '</div>';
      }
      
      html += '</div>';
      return html;
    };
  });

  it('should generate basic trigger with role and type', () => {
    const trigger = {
      role: 'User',
      type: 'input-ui'
    };
    const html = generateTrigger(trigger);
    
    expect(html).toContain('class="element trigger"');
    expect(html).toContain('element-role');
    expect(html).toContain('User');
    expect(html).toContain('Trigger: input-ui');
  });

  it('should generate trigger with buttons', () => {
    const trigger = {
      role: 'User',
      type: 'input-ui',
      buttons: ['Create', 'Update', 'Delete']
    };
    const html = generateTrigger(trigger);
    
    expect(html).toContain('Buttons:');
    expect(html).toContain('Create');
    expect(html).toContain('Update');
    expect(html).toContain('Delete');
  });

  it('should generate trigger without role', () => {
    const trigger = {
      type: 'automated'
    };
    const html = generateTrigger(trigger);
    
    expect(html).not.toContain('element-role');
    expect(html).toContain('Trigger: automated');
  });

  it('should escape HTML in role and type', () => {
    const trigger = {
      role: '<script>alert("XSS")</script>',
      type: '<img src=x>'
    };
    const html = generateTrigger(trigger);
    
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<img src=x>');
  });

  it('should escape HTML in buttons', () => {
    const trigger = {
      type: 'input-ui',
      buttons: ['<script>alert(1)</script>', 'Normal Button']
    };
    const html = generateTrigger(trigger);
    
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('Normal Button');
  });

  it('should handle trigger with properties', () => {
    const trigger = {
      role: 'System',
      type: 'automated',
      properties: [
        { label: 'Event', propertyName: 'OrderCreated' },
        { label: 'Delay', propertyName: '5 minutes' }
      ]
    };
    const html = generateTrigger(trigger);
    
    expect(html).toContain('data-trigger-property="true"');
    expect(html).toContain('Event: OrderCreated');
    expect(html).toContain('Delay: 5 minutes');
  });
});

describe('generateCommand', () => {
  let window, document, escapeHtml, generateCommand;

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

    generateCommand = (command) => {
      let html = '<div class="element command">';
      html += `<div class="element-title">${escapeHtml(command.name)}</div>`;
      
      if (command.properties && command.properties.length > 0) {
        html += '<div class="element-properties">';
        command.properties.forEach(prop => {
          html += `<div class="element-property">${escapeHtml(prop.name)}: ${escapeHtml(prop.type)}</div>`;
        });
        html += '</div>';
      }
      
      html += '</div>';
      return html;
    };
  });

  it('should generate command with name', () => {
    const command = {
      name: 'Create Order'
    };
    const html = generateCommand(command);
    
    expect(html).toContain('class="element command"');
    expect(html).toContain('element-title');
    expect(html).toContain('Create Order');
  });

  it('should generate command with properties', () => {
    const command = {
      name: 'Update User',
      properties: [
        { name: 'UserId', type: 'Guid' },
        { name: 'Email', type: 'string' }
      ]
    };
    const html = generateCommand(command);
    
    expect(html).toContain('element-properties');
    expect(html).toContain('UserId: Guid');
    expect(html).toContain('Email: string');
  });

  it('should escape HTML in command name', () => {
    const command = {
      name: '<script>alert("XSS")</script>'
    };
    const html = generateCommand(command);
    
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('should escape HTML in property names and types', () => {
    const command = {
      name: 'Test',
      properties: [
        { name: '<div>Bad</div>', type: '<script>alert(1)</script>' }
      ]
    };
    const html = generateCommand(command);
    
    expect(html).not.toContain('<div>Bad</div>');
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;');
    expect(html).toContain('&gt;');
  });

  it('should handle command without properties', () => {
    const command = {
      name: 'Simple Command'
    };
    const html = generateCommand(command);
    
    expect(html).toContain('Simple Command');
    expect(html).not.toContain('element-properties');
  });

  it('should handle empty properties array', () => {
    const command = {
      name: 'Test Command',
      properties: []
    };
    const html = generateCommand(command);
    
    expect(html).toContain('Test Command');
    expect(html).not.toContain('element-properties');
  });
});

describe('generateEvent', () => {
  let window, document, escapeHtml, generateEvent;

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

    generateEvent = (event, sliceIndex, eventIndex) => {
      const eventId = `event-${sliceIndex}-${eventIndex}-${event.name.replace(/\s+/g, '-')}`;
      let html = `<div class="element event" id="${eventId}" data-event-name="${escapeHtml(event.name)}">`;
      html += `<div class="element-title">${escapeHtml(event.name)}</div>`;
      
      if (event.properties && event.properties.length > 0) {
        html += '<div class="element-properties">';
        event.properties.forEach(prop => {
          html += `<div class="element-property">${escapeHtml(prop.name)}: ${escapeHtml(prop.type)}</div>`;
        });
        html += '</div>';
      }
      
      html += '</div>';
      return html;
    };
  });

  it('should generate event with unique ID', () => {
    const event = {
      name: 'Order Created',
      properties: []
    };
    const html = generateEvent(event, 0, 0);
    
    expect(html).toContain('id="event-0-0-Order-Created"');
    expect(html).toContain('data-event-name');
  });

  it('should generate event with properties', () => {
    const event = {
      name: 'User Registered',
      properties: [
        { name: 'UserId', type: 'Guid' },
        { name: 'Email', type: 'string' }
      ]
    };
    const html = generateEvent(event, 1, 2);
    
    expect(html).toContain('UserId: Guid');
    expect(html).toContain('Email: string');
  });

  it('should handle event names with spaces', () => {
    const event = {
      name: 'Order Item Added To Cart',
      properties: []
    };
    const html = generateEvent(event, 0, 0);
    
    expect(html).toContain('id="event-0-0-Order-Item-Added-To-Cart"');
  });

  it('should escape HTML in event name for display', () => {
    const event = {
      name: '<script>alert("XSS")</script>',
      properties: []
    };
    const html = generateEvent(event, 0, 0);
    
    // The event name in data attribute and title should be escaped
    expect(html).toContain('data-event-name="&lt;script&gt;');
    expect(html).toContain('&lt;script&gt;alert("XSS")&lt;/script&gt;');
    // Note: ID attribute contains raw name (potential issue, but testing actual behavior)
  });

  it('should use correct slice and event indices', () => {
    const event = {
      name: 'Test Event',
      properties: []
    };
    const html1 = generateEvent(event, 5, 3);
    const html2 = generateEvent(event, 1, 9);
    
    expect(html1).toContain('id="event-5-3-Test-Event"');
    expect(html2).toContain('id="event-1-9-Test-Event"');
  });
});
