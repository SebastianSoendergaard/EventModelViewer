/**
 * Visual regression tests for EventModelViewer
 * Captures and compares screenshots to detect visual changes
 */
import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..', '..', '..');

test.describe('Visual Regression Tests', () => {
  test.beforeEach(async ({ page }) => {
    const indexPath = join(projectRoot, 'index.html');
    await page.goto(`file:///${indexPath.replace(/\\/g, '/')}`);
    
    // Set consistent viewport for screenshots
    await page.setViewportSize({ width: 1280, height: 720 });
  });

  test('baseline: empty application', async ({ page }) => {
    // Take screenshot of initial state
    await expect(page).toHaveScreenshot('baseline-empty.png', {
      fullPage: false,
      maxDiffPixels: 100
    });
  });

  test('baseline: simple event model', async ({ page }) => {
    const fixturePath = join(projectRoot, 'dev-tools', 'tests', 'fixtures', 'simple-event-model.json');
    await page.locator('#fileInput').setInputFiles(fixturePath);
    await page.waitForSelector('.event-model-diagram');
    
    // Wait for any animations to complete
    await page.waitForTimeout(500);
    
    // Take screenshot of diagram
    const diagram = page.locator('#diagramWrapper');
    await expect(diagram).toHaveScreenshot('baseline-simple-model.png', {
      maxDiffPixels: 100
    });
  });

  test('baseline: complex event model', async ({ page }) => {
    const fixturePath = join(projectRoot, 'dev-tools', 'tests', 'fixtures', 'complex-event-model.json');
    await page.locator('#fileInput').setInputFiles(fixturePath);
    await page.waitForSelector('.event-model-diagram');
    await page.waitForTimeout(500);
    
    const diagram = page.locator('#diagramWrapper');
    await expect(diagram).toHaveScreenshot('baseline-complex-model.png', {
      maxDiffPixels: 100
    });
  });

  test('baseline: with slice borders', async ({ page }) => {
    const fixturePath = join(projectRoot, 'dev-tools', 'tests', 'fixtures', 'complex-event-model.json');
    await page.locator('#fileInput').setInputFiles(fixturePath);
    await page.waitForSelector('.event-model-diagram');
    
    // Ensure borders are visible
    const showSlicesCheckbox = page.locator('#showSlices');
    if (!(await showSlicesCheckbox.isChecked())) {
      await showSlicesCheckbox.click();
    }
    await page.waitForTimeout(500);
    
    const diagram = page.locator('#diagramWrapper');
    await expect(diagram).toHaveScreenshot('baseline-with-borders.png', {
      maxDiffPixels: 100
    });
  });

  test('baseline: without tests', async ({ page }) => {
    const fixturePath = join(projectRoot, 'dev-tools', 'tests', 'fixtures', 'simple-event-model.json');
    await page.locator('#fileInput').setInputFiles(fixturePath);
    await page.waitForSelector('.event-model-diagram');
    
    // Hide tests
    await page.locator('#showTests').click();
    await page.waitForTimeout(500);
    
    const diagram = page.locator('#diagramWrapper');
    await expect(diagram).toHaveScreenshot('baseline-without-tests.png', {
      maxDiffPixels: 100
    });
  });

  test('baseline: without types', async ({ page }) => {
    const fixturePath = join(projectRoot, 'dev-tools', 'tests', 'fixtures', 'simple-event-model.json');
    await page.locator('#fileInput').setInputFiles(fixturePath);
    await page.waitForSelector('.event-model-diagram');
    
    // Hide types
    await page.locator('#showTypes').click();
    await page.waitForTimeout(500);
    
    const diagram = page.locator('#diagramWrapper');
    await expect(diagram).toHaveScreenshot('baseline-without-types.png', {
      maxDiffPixels: 100
    });
  });

  test('baseline: zoomed in 150%', async ({ page }) => {
    const fixturePath = join(projectRoot, 'dev-tools', 'tests', 'fixtures', 'simple-event-model.json');
    await page.locator('#fileInput').setInputFiles(fixturePath);
    await page.waitForSelector('.event-model-diagram');
    
    // Zoom in 5 times (110, 120, 130, 140, 150)
    const zoomInBtn = page.locator('#zoomInBtn');
    for (let i = 0; i < 5; i++) {
      await zoomInBtn.click();
      await page.waitForTimeout(100);
    }
    await page.waitForTimeout(500);
    
    const diagram = page.locator('#diagramWrapper');
    await expect(diagram).toHaveScreenshot('baseline-zoomed-150.png', {
      maxDiffPixels: 100
    });
  });

  test('baseline: collapsed editor', async ({ page }) => {
    const fixturePath = join(projectRoot, 'dev-tools', 'tests', 'fixtures', 'simple-event-model.json');
    await page.locator('#fileInput').setInputFiles(fixturePath);
    await page.waitForSelector('.event-model-diagram');
    
    // Collapse editor
    await page.locator('#collapseBtn').click();
    await page.waitForTimeout(500);
    
    await expect(page).toHaveScreenshot('baseline-collapsed-editor.png', {
      fullPage: false,
      maxDiffPixels: 100
    });
  });

  test('baseline: edge cases model', async ({ page }) => {
    const fixturePath = join(projectRoot, 'dev-tools', 'tests', 'fixtures', 'edge-cases.json');
    await page.locator('#fileInput').setInputFiles(fixturePath);
    await page.waitForSelector('.event-model-diagram');
    await page.waitForTimeout(500);
    
    const diagram = page.locator('#diagramWrapper');
    await expect(diagram).toHaveScreenshot('baseline-edge-cases.png', {
      maxDiffPixels: 100
    });
  });

  test('visual: arrows render correctly', async ({ page }) => {
    const fixturePath = join(projectRoot, 'dev-tools', 'tests', 'fixtures', 'complex-event-model.json');
    await page.locator('#fileInput').setInputFiles(fixturePath);
    await page.waitForSelector('.event-model-diagram');
    await page.waitForTimeout(500);
    
    // Check that SVG arrows are present
    const svg = page.locator('#arrow-svg');
    await expect(svg).toBeVisible();
    
    // Take screenshot to verify arrow positions
    const diagram = page.locator('#diagramWrapper');
    await expect(diagram).toHaveScreenshot('arrows-render.png', {
      maxDiffPixels: 100
    });
  });

  test('visual: layout consistency at different viewport widths', async ({ page }) => {
    const fixturePath = join(projectRoot, 'dev-tools', 'tests', 'fixtures', 'simple-event-model.json');
    await page.locator('#fileInput').setInputFiles(fixturePath);
    await page.waitForSelector('.event-model-diagram');
    
    // Test at 1920x1080
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.waitForTimeout(500);
    
    const diagram = page.locator('#diagramWrapper');
    await expect(diagram).toHaveScreenshot('layout-1920.png', {
      maxDiffPixels: 100
    });
  });

  test('visual: proper text escaping in display', async ({ page }) => {
    const fixturePath = join(projectRoot, 'dev-tools', 'tests', 'fixtures', 'edge-cases.json');
    await page.locator('#fileInput').setInputFiles(fixturePath);
    await page.waitForSelector('.event-model-diagram');
    await page.waitForTimeout(500);
    
    // Find elements with special characters
    const sliceName = page.locator('.slice-name').nth(2);
    await expect(sliceName).toBeVisible();
    
    // Screenshot to verify rendering
    await expect(sliceName).toHaveScreenshot('special-characters.png', {
      maxDiffPixels: 50
    });
  });
});
