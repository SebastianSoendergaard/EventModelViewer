/**
 * End-to-end tests for EventModelViewer
 * Tests complete user workflows with real browser interaction
 */
import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..', '..', '..');

test.describe('EventModelViewer E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Load the application
    const indexPath = join(projectRoot, 'index.html');
    await page.goto(`file:///${indexPath.replace(/\\/g, '/')}`);
  });

  test('should load application successfully', async ({ page }) => {
    // Check title
    await expect(page).toHaveTitle('Event Model Viewer');
    
    // Check main elements are present
    await expect(page.locator('header h1')).toContainText('Event Model Viewer');
    await expect(page.locator('#fileInput')).toBeAttached();
    await expect(page.locator('#editorPanel')).toBeVisible();
    await expect(page.locator('#diagramContainer')).toBeVisible();
  });

  test('should have functional controls', async ({ page }) => {
    // Check upload section
    await expect(page.locator('.file-label')).toBeVisible();
    
    // Check editor controls
    await expect(page.locator('#collapseBtn')).toBeVisible();
    await expect(page.locator('.editor-tab')).toHaveCount(2);
    
    // Check diagram controls
    await expect(page.locator('#zoomInBtn')).toBeVisible();
    await expect(page.locator('#zoomOutBtn')).toBeVisible();
    await expect(page.locator('#zoomResetBtn')).toBeVisible();
    
    // Check toggle checkboxes
    await expect(page.locator('#showSlices')).toBeVisible();
    await expect(page.locator('#showTests')).toBeVisible();
    await expect(page.locator('#showTypes')).toBeVisible();
  });

  test('should load and display a JSON file', async ({ page }) => {
    // Load a fixture file
    const fixturePath = join(projectRoot, 'dev-tools', 'tests', 'fixtures', 'simple-event-model.json');
    
    await page.locator('#fileInput').setInputFiles(fixturePath);
    
    // Wait for diagram to render
    await page.waitForSelector('.event-model-diagram', { timeout: 5000 });
    
    // Check diagram is visible
    await expect(page.locator('.event-model-diagram')).toBeVisible();
    
    // Check slices are rendered
    const slices = page.locator('.slice');
    await expect(slices).toHaveCount(2);
    
    // Check filename is displayed
    await expect(page.locator('#fileName')).toContainText('simple-event-model.json');
  });

  test('should display event model elements correctly', async ({ page }) => {
    const fixturePath = join(projectRoot, 'dev-tools', 'tests', 'fixtures', 'simple-event-model.json');
    await page.locator('#fileInput').setInputFiles(fixturePath);
    await page.waitForSelector('.event-model-diagram');
    
    // Check for triggers
    await expect(page.locator('.element.trigger').first()).toBeVisible();
    
    // Check for commands
    await expect(page.locator('.element.command').first()).toBeVisible();
    
    // Check for events
    await expect(page.locator('.element.event').first()).toBeVisible();
    
    // Check for views
    await expect(page.locator('.element.view').first()).toBeVisible();
  });

  test('should toggle editor panel', async ({ page }) => {
    const editorPanel = page.locator('#editorPanel');
    const collapseBtn = page.locator('#collapseBtn');
    
    // Panel should start expanded
    await expect(editorPanel).not.toHaveClass(/collapsed/);
    
    // Click to collapse
    await collapseBtn.click();
    await expect(editorPanel).toHaveClass(/collapsed/);
    
    // Click to expand
    await collapseBtn.click();
    await expect(editorPanel).not.toHaveClass(/collapsed/);
  });

  test('should switch between editor tabs', async ({ page }) => {
    const codeTab = page.locator('[data-tab="code"]');
    const treeTab = page.locator('[data-tab="tree"]');
    const codeView = page.locator('#codeView');
    const treeView = page.locator('#treeView');
    
    // Code view should be active initially
    await expect(codeTab).toHaveClass(/active/);
    await expect(codeView).toHaveClass(/active/);
    
    // Switch to tree view
    await treeTab.click();
    await expect(treeTab).toHaveClass(/active/);
    await expect(treeView).toHaveClass(/active/);
    await expect(codeTab).not.toHaveClass(/active/);
    
    // Switch back to code view
    await codeTab.click();
    await expect(codeTab).toHaveClass(/active/);
    await expect(codeView).toHaveClass(/active/);
  });

  test('should zoom in and out', async ({ page }) => {
    const fixturePath = join(projectRoot, 'dev-tools', 'tests', 'fixtures', 'simple-event-model.json');
    await page.locator('#fileInput').setInputFiles(fixturePath);
    await page.waitForSelector('.event-model-diagram');
    
    const zoomInBtn = page.locator('#zoomInBtn');
    const zoomOutBtn = page.locator('#zoomOutBtn');
    const zoomResetBtn = page.locator('#zoomResetBtn');
    const zoomDisplay = page.locator('#zoomLevel');
    
    // Initial zoom should be 100%
    await expect(zoomDisplay).toContainText('100%');
    
    // Zoom in
    await zoomInBtn.click();
    await expect(zoomDisplay).toContainText('110%');
    
    // Zoom in again
    await zoomInBtn.click();
    await expect(zoomDisplay).toContainText('120%');
    
    // Zoom out
    await zoomOutBtn.click();
    await expect(zoomDisplay).toContainText('110%');
    
    // Reset zoom
    await zoomResetBtn.click();
    await expect(zoomDisplay).toContainText('100%');
  });

  test('should toggle slice borders', async ({ page }) => {
    const fixturePath = join(projectRoot, 'dev-tools', 'tests', 'fixtures', 'complex-event-model.json');
    await page.locator('#fileInput').setInputFiles(fixturePath);
    await page.waitForSelector('.event-model-diagram');
    
    const showSlicesCheckbox = page.locator('#showSlices');
    
    // Borders should be visible initially (checkbox checked)
    await expect(showSlicesCheckbox).toBeChecked();
    
    // Toggle off
    await showSlicesCheckbox.click();
    await expect(showSlicesCheckbox).not.toBeChecked();
    
    // Toggle back on
    await showSlicesCheckbox.click();
    await expect(showSlicesCheckbox).toBeChecked();
  });

  test('should toggle tests visibility', async ({ page }) => {
    const fixturePath = join(projectRoot, 'dev-tools', 'tests', 'fixtures', 'simple-event-model.json');
    await page.locator('#fileInput').setInputFiles(fixturePath);
    await page.waitForSelector('.event-model-diagram');
    
    const showTestsCheckbox = page.locator('#showTests');
    const testsContainer = page.locator('.tests-container').first();
    
    // Tests should be visible initially
    await expect(showTestsCheckbox).toBeChecked();
    await expect(testsContainer).toBeVisible();
    
    // Hide tests
    await showTestsCheckbox.click();
    await expect(testsContainer).toBeHidden();
    
    // Show tests again
    await showTestsCheckbox.click();
    await expect(testsContainer).toBeVisible();
  });

  test('should toggle types visibility', async ({ page }) => {
    const fixturePath = join(projectRoot, 'dev-tools', 'tests', 'fixtures', 'simple-event-model.json');
    await page.locator('#fileInput').setInputFiles(fixturePath);
    await page.waitForSelector('.event-model-diagram');
    
    const showTypesCheckbox = page.locator('#showTypes');
    
    // Types should be visible initially
    await expect(showTypesCheckbox).toBeChecked();
    
    // Hide types
    await showTypesCheckbox.click();
    await expect(showTypesCheckbox).not.toBeChecked();
    
    // Show types again
    await showTypesCheckbox.click();
    await expect(showTypesCheckbox).toBeChecked();
  });

  test('should handle complex event model', async ({ page }) => {
    const fixturePath = join(projectRoot, 'dev-tools', 'tests', 'fixtures', 'complex-event-model.json');
    await page.locator('#fileInput').setInputFiles(fixturePath);
    await page.waitForSelector('.event-model-diagram');
    
    // Should have 3 slices
    const slices = page.locator('.slice');
    await expect(slices).toHaveCount(3);
    
    // Check slice names
    await expect(page.locator('.slice-name').first()).toContainText('Register User');
    
    // Check for automation trigger
    await expect(page.locator('.element.trigger').nth(2)).toBeVisible();
  });

  test('should escape XSS attempts in display', async ({ page }) => {
    const fixturePath = join(projectRoot, 'dev-tools', 'tests', 'fixtures', 'edge-cases.json');
    await page.locator('#fileInput').setInputFiles(fixturePath);
    await page.waitForSelector('.event-model-diagram');
    
    // Check that script tags are escaped and not executed
    const content = await page.content();
    
    // Should not contain executable script
    expect(content).not.toContain('<script>alert(');
    
    // Should contain escaped version
    expect(content).toContain('&lt;script&gt;');
  });
});
