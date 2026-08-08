/**
 * Smoke test to verify test infrastructure is working
 */
import { describe, it, expect } from 'vitest';

describe('Test Infrastructure', () => {
  it('should run basic assertions', () => {
    expect(true).toBe(true);
    expect(1 + 1).toBe(2);
  });

  it('should have access to DOM via happy-dom', () => {
    const div = document.createElement('div');
    div.textContent = 'Hello Test';
    expect(div.textContent).toBe('Hello Test');
  });

  it('should be able to import test helpers', async () => {
    const { createMinimalEventModel } = await import('../helpers/test-data-factory.js');
    const model = createMinimalEventModel();
    
    expect(model).toBeDefined();
    expect(model.title).toBe('Test Model');
    expect(model.slices).toHaveLength(1);
  });

  it('should be able to load fixtures', async () => {
    const fs = await import('fs/promises');
    const path = await import('path');
    
    const fixturePath = path.join(process.cwd(), 'tests', 'fixtures', 'simple-event-model.json');
    const content = await fs.readFile(fixturePath, 'utf-8');
    const data = JSON.parse(content);
    
    expect(data).toBeDefined();
    expect(data.title).toBe('Simple Event Model');
    expect(data.slices).toHaveLength(2);
  });
});
