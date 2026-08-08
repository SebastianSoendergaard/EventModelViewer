# EventModelViewer Test Suite

## Running Tests

### All Tests
```bash
npm test
```

### Unit Tests Only
```bash
npm run test:unit
```

### Integration Tests Only
```bash
npm run test:integration
```

### E2E Tests Only
```bash
npm run test:e2e
```

### Visual Regression Tests Only
```bash
npm run test:visual
```

### Watch Mode (for development)
```bash
npm run test:watch
```

### Coverage Report
```bash
npm run test:coverage
```

## Test Structure

```
tests/
├── unit/               # Unit tests for individual functions
├── integration/        # Integration tests for component interactions
├── e2e/               # End-to-end tests for complete workflows
├── visual/            # Visual regression tests
├── fixtures/          # Test data and sample JSON files
└── helpers/           # Shared test utilities
    ├── dom-helpers.js        # DOM manipulation utilities
    ├── test-data-factory.js  # Test data generators
    └── assertions.js         # Custom assertion helpers
```

## Test Fixtures

- `simple-event-model.json` - Basic event model with 2 slices
- `complex-event-model.json` - Complex model with automation patterns
- `edge-cases.json` - Tests for long names, special characters, etc.
- `invalid-structure.json` - Invalid event model structure
- `invalid-json.txt` - Malformed JSON for error testing

## Writing Tests

### Unit Test Example
```javascript
import { describe, it, expect } from 'vitest';
import { createMinimalEventModel } from '../helpers/test-data-factory.js';

describe('My Function', () => {
  it('should do something', () => {
    const model = createMinimalEventModel();
    // Test your function
    expect(result).toBe(expected);
  });
});
```

### E2E Test Example
```javascript
import { test, expect } from '@playwright/test';

test('user can upload JSON', async ({ page }) => {
  await page.goto('/index.html');
  // Interact with the page
  await page.locator('#fileInput').setInputFiles('tests/fixtures/simple-event-model.json');
  // Assert results
  await expect(page.locator('.event-model-diagram')).toBeVisible();
});
```

## Test Helpers

### DOM Helpers
- `loadHTML(path)` - Load HTML file into happy-dom
- `querySelector(doc, selector)` - Safe query with error handling
- `click(element)` - Simulate click event
- `waitForElement(doc, selector)` - Wait for element to appear

### Test Data Factory
- `createMinimalEventModel()` - Basic event model
- `createMultiSliceModel(count)` - Model with N slices
- `createSliceWithTrigger(options)` - Custom trigger slice
- `createSliceWithCommand(options)` - Custom command slice
- `createSliceWithView(options)` - Custom view slice

### Custom Assertions
- `assertElementExists(doc, selector)` - Element must exist
- `assertElementCount(doc, selector, count)` - Exact element count
- `assertValidDiagram(doc)` - Diagram structure validation
- `assertHTMLContains(html, substring)` - HTML content check

## CI/CD Integration

Tests are configured to run in headless mode for CI environments. The `playwright.config.js` automatically detects CI and adjusts:
- Retries: 2 attempts in CI, 0 locally
- Workers: 1 in CI, unlimited locally
- Screenshots: Only on failure

## TDD Workflow for New Features

1. **Write the test first** (Red)
   ```bash
   npm run test:watch  # Start watch mode
   ```

2. **Write minimal code to pass** (Green)
   - Implement the feature
   - Test automatically re-runs

3. **Refactor** (Refactor)
   - Clean up code
   - Ensure tests still pass

4. **Commit**
   ```bash
   git add .
   git commit -m "Add feature with tests"
   ```

## Coverage Goals

- **Overall**: >80% code coverage
- **Critical paths**: 100% coverage
  - JSON parsing
  - Diagram generation
  - XSS prevention (escapeHtml)

## Troubleshooting

### Tests fail with "Cannot find module"
Make sure you're using ES modules. Check that `package.json` has `"type": "module"`.

### Playwright tests fail to start
Run `npx playwright install chromium` to install browsers.

### Visual tests show false positives
Update baselines after intentional design changes:
```bash
npx playwright test --update-snapshots
```

### Tests timeout
Increase timeout in test file:
```javascript
test.setTimeout(30000); // 30 seconds
```
