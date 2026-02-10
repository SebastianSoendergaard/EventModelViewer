/**
 * Integration tests for EventModelViewer
 * Tests interactions between components
 */
import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..', '..', '..');

test.describe('File Upload Integration', () => {
  test.beforeEach(async ({ page }) => {
    const indexPath = join(projectRoot, 'index.html');
    await page.goto(`file:///${indexPath.replace(/\\/g, '/')}`);
  });

  test('uploading a file updates filename display', async ({ page }) => {
    const fixturePath = join(projectRoot, 'dev-tools', 'tests', 'fixtures', 'simple-event-model.json');
    
    // Get initial filename text
    const initialFilename = await page.locator('#fileName').textContent();
    
    // Upload file
    await page.locator('#fileInput').setInputFiles(fixturePath);
    
    // Filename should be displayed
    await expect(page.locator('#fileName')).toContainText('simple-event-model.json');
  });

  test('uploading a file renders diagram', async ({ page }) => {
    const fixturePath = join(projectRoot, 'dev-tools', 'tests', 'fixtures', 'simple-event-model.json');
    
    // Initially no diagram
    await expect(page.locator('.event-model-diagram')).not.toBeVisible();
    
    // Upload file
    await page.locator('#fileInput').setInputFiles(fixturePath);
    await page.waitForSelector('.event-model-diagram');
    
    // Diagram should be visible
    await expect(page.locator('.event-model-diagram')).toBeVisible();
    await expect(page.locator('.slice')).toHaveCount(2);
  });

  test('uploading a file populates editor', async ({ page }) => {
    const fixturePath = join(projectRoot, 'dev-tools', 'tests', 'fixtures', 'simple-event-model.json');
    
    // Upload file
    await page.locator('#fileInput').setInputFiles(fixturePath);
    await page.waitForSelector('.event-model-diagram');
    
    // Editor should contain JSON content
    const editorContent = await page.locator('#codeEditor').textContent();
    expect(editorContent).toContain('Simple Event Model');
    expect(editorContent).toContain('Create Order');
  });

  test('uploading different files updates diagram', async ({ page }) => {
    const simplePath = join(projectRoot, 'dev-tools', 'tests', 'fixtures', 'simple-event-model.json');
    const complexPath = join(projectRoot, 'dev-tools', 'tests', 'fixtures', 'complex-event-model.json');
    
    // Upload simple model
    await page.locator('#fileInput').setInputFiles(simplePath);
    await page.waitForSelector('.event-model-diagram');
    await expect(page.locator('.slice')).toHaveCount(2);
    
    // Upload complex model
    await page.locator('#fileInput').setInputFiles(complexPath);
    await page.waitForSelector('.event-model-diagram');
    await expect(page.locator('.slice')).toHaveCount(3);
  });
});

test.describe('Editor-Diagram Sync', () => {
  test.beforeEach(async ({ page }) => {
    const indexPath = join(projectRoot, 'index.html');
    await page.goto(`file:///${indexPath.replace(/\\/g, '/')}`);
    const fixturePath = join(projectRoot, 'dev-tools', 'tests', 'fixtures', 'simple-event-model.json');
    await page.locator('#fileInput').setInputFiles(fixturePath);
    await page.waitForSelector('.event-model-diagram');
  });

  test('diagram reflects uploaded JSON structure', async ({ page }) => {
    // Check that diagram matches JSON structure
    const slices = page.locator('.slice');
    await expect(slices).toHaveCount(2);
    
    // Check slice names match
    await expect(page.locator('.slice-name').first()).toContainText('Create Order');
    await expect(page.locator('.slice-name').nth(1)).toContainText('View Order');
  });

  test('diagram contains correct elements from JSON', async ({ page }) => {
    // First slice should have trigger and command
    const firstSlice = page.locator('.slice').first();
    await expect(firstSlice.locator('.element.trigger')).toBeVisible();
    await expect(firstSlice.locator('.element.command')).toBeVisible();
    await expect(firstSlice.locator('.element.event')).toBeVisible();
    
    // Second slice should have view
    const secondSlice = page.locator('.slice').nth(1);
    await expect(secondSlice.locator('.element.view')).toBeVisible();
  });
});

test.describe('Toggle Features Integration', () => {
  test.beforeEach(async ({ page }) => {
    const indexPath = join(projectRoot, 'index.html');
    await page.goto(`file:///${indexPath.replace(/\\/g, '/')}`);
    const fixturePath = join(projectRoot, 'dev-tools', 'tests', 'fixtures', 'complex-event-model.json');
    await page.locator('#fileInput').setInputFiles(fixturePath);
    await page.waitForSelector('.event-model-diagram');
  });

  test('slice borders toggle affects multiple slices', async ({ page }) => {
    const slicesWithBorder = page.locator('.slice.with-border');
    
    // Should have bordered slices initially
    const initialCount = await slicesWithBorder.count();
    expect(initialCount).toBeGreaterThan(0);
    
    // Toggle off - borders should be affected
    const initialState = await page.locator('#showSlices').isChecked();
    await page.locator('#showSlices').click();
    await page.waitForTimeout(100);
    
    // Verify checkbox state changed
    const newState = await page.locator('#showSlices').isChecked();
    expect(newState).not.toBe(initialState);
  });

  test('tests toggle hides all test containers', async ({ page }) => {
    const testsContainers = page.locator('.tests-container');
    const initialCount = await testsContainers.count();
    expect(initialCount).toBeGreaterThan(0);
    
    // Initially visible
    await expect(testsContainers.first()).toBeVisible();
    
    // Toggle off
    await page.locator('#showTests').click();
    await page.waitForTimeout(100);
    
    // All should be hidden
    await expect(testsContainers.first()).toBeHidden();
  });

  test('types toggle affects property display', async ({ page }) => {
    const properties = page.locator('.element-property');
    const initialCount = await properties.count();
    expect(initialCount).toBeGreaterThan(0);
    
    // Get initial text of first property
    const firstProperty = properties.first();
    const initialText = await firstProperty.textContent();
    expect(initialText).toContain(':'); // Should have "name: type" format
    
    // Toggle off types
    await page.locator('#showTypes').click();
    await page.waitForTimeout(100);
    
    // Should show only names (no types after colon)
    const newText = await firstProperty.textContent();
    // Text should be different (types removed)
    expect(newText.length).toBeLessThan(initialText.length);
  });

  test('multiple toggles work together', async ({ page }) => {
    // Turn off all toggles
    await page.locator('#showSlices').click();
    await page.locator('#showTests').click();
    await page.locator('#showTypes').click();
    await page.waitForTimeout(200);
    
    // Verify all are off
    await expect(page.locator('#showSlices')).not.toBeChecked();
    await expect(page.locator('#showTests')).not.toBeChecked();
    await expect(page.locator('#showTypes')).not.toBeChecked();
    
    // Tests should be hidden
    await expect(page.locator('.tests-container').first()).toBeHidden();
    
    // Turn them all back on
    await page.locator('#showSlices').click();
    await page.locator('#showTests').click();
    await page.locator('#showTypes').click();
    await page.waitForTimeout(200);
    
    // Verify all are on
    await expect(page.locator('#showSlices')).toBeChecked();
    await expect(page.locator('#showTests')).toBeChecked();
    await expect(page.locator('#showTypes')).toBeChecked();
    
    // Tests should be visible again
    await expect(page.locator('.tests-container').first()).toBeVisible();
  });
});

test.describe('Panel Interactions', () => {
  test.beforeEach(async ({ page }) => {
    const indexPath = join(projectRoot, 'index.html');
    await page.goto(`file:///${indexPath.replace(/\\/g, '/')}`);
    const fixturePath = join(projectRoot, 'dev-tools', 'tests', 'fixtures', 'simple-event-model.json');
    await page.locator('#fileInput').setInputFiles(fixturePath);
    await page.waitForSelector('.event-model-diagram');
  });

  test('collapsing editor expands diagram area', async ({ page }) => {
    const diagramPanel = page.locator('.diagram-panel');
    
    // Get initial width
    const initialBox = await diagramPanel.boundingBox();
    const initialWidth = initialBox?.width || 0;
    
    // Collapse editor
    await page.locator('#collapseBtn').click();
    await page.waitForTimeout(300); // Wait for transition
    
    // Diagram should be wider
    const newBox = await diagramPanel.boundingBox();
    const newWidth = newBox?.width || 0;
    expect(newWidth).toBeGreaterThan(initialWidth);
  });

  test('editor tabs switch views correctly', async ({ page }) => {
    const codeTab = page.locator('[data-tab="code"]');
    const treeTab = page.locator('[data-tab="tree"]');
    const codeView = page.locator('#codeView');
    const treeView = page.locator('#treeView');
    
    // Initially code view active
    await expect(codeView).toHaveClass(/active/);
    await expect(treeView).not.toHaveClass(/active/);
    
    // Switch to tree
    await treeTab.click();
    await page.waitForTimeout(100);
    await expect(treeView).toHaveClass(/active/);
    await expect(codeView).not.toHaveClass(/active/);
    
    // Switch back to code
    await codeTab.click();
    await page.waitForTimeout(100);
    await expect(codeView).toHaveClass(/active/);
    await expect(treeView).not.toHaveClass(/active/);
  });

  test('zoom controls update display value', async ({ page }) => {
    const zoomDisplay = page.locator('#zoomLevel');
    const zoomInBtn = page.locator('#zoomInBtn');
    const zoomOutBtn = page.locator('#zoomOutBtn');
    const zoomResetBtn = page.locator('#zoomResetBtn');
    
    // Start at 100%
    await expect(zoomDisplay).toContainText('100%');
    
    // Zoom in twice
    await zoomInBtn.click();
    await zoomInBtn.click();
    await expect(zoomDisplay).toContainText('120%');
    
    // Zoom out once
    await zoomOutBtn.click();
    await expect(zoomDisplay).toContainText('110%');
    
    // Reset
    await zoomResetBtn.click();
    await expect(zoomDisplay).toContainText('100%');
  });

  test('zoom affects diagram visual size', async ({ page }) => {
    const diagram = page.locator('.event-model-diagram');
    const zoomDisplay = page.locator('#zoomLevel');
    
    // Verify initial zoom
    await expect(zoomDisplay).toContainText('100%');
    
    // Zoom in
    await page.locator('#zoomInBtn').click();
    await page.waitForTimeout(100);
    
    // Verify zoom changed
    await expect(zoomDisplay).toContainText('110%');
  });
});
