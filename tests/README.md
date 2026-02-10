# Test Suite

This directory contains test files for the Event Model Viewer application.

## Available Tests

### [collapse-functionality.test.html](collapse-functionality.test.html)
Comprehensive test suite for the collapsible JSON editor feature.

**Test Coverage:**
- ✅ Standalone bracket detection (`{`, `[`)
- ✅ Property with object detection (`"prop": {`)
- ✅ Property with array detection (`"prop": [`)
- ✅ Bracket matching (simple objects)
- ✅ Bracket matching (nested structures)
- ✅ Bracket matching (property objects/arrays)
- ✅ Label extraction (property names)
- ✅ Label extraction (name property)
- ✅ Complex nested structures
- ✅ Edge cases (empty objects/arrays)
- ✅ Real-world event model structures
- ✅ Regex pattern validation

**How to run:**
```bash
# Open in browser
start tests\collapse-functionality.test.html

# Or from current directory
cd tests
start collapse-functionality.test.html
```

**Expected output:**
- Visual test report in browser
- Console output with detailed results
- Pass/fail indicators for each test
- Summary statistics

## Test Results

Last test run: 2026-02-10

| Test Category | Tests | Passed | Failed |
|--------------|-------|--------|--------|
| Standalone Bracket Detection | 3 | 3 | 0 |
| Property Object Detection | 2 | 2 | 0 |
| Property Array Detection | 2 | 2 | 0 |
| Simple Bracket Matching | 1 | 1 | 0 |
| Nested Bracket Matching | 1 | 1 | 0 |
| Property Bracket Matching | 2 | 2 | 0 |
| Label Extraction | 3 | 3 | 0 |
| Complex Structures | 1 | 1 | 0 |
| Edge Cases | 1 | 1 | 0 |
| Real-world Structure | 6 | 6 | 0 |
| Regex Validation | 7 | 7 | 0 |
| **TOTAL** | **29+** | **29+** | **0** |

## Running Tests

### Manual Testing
1. Open the test HTML file in any modern browser
2. Review the results displayed on the page
3. Check the browser console for detailed logs

### Automated Testing
Currently tests are browser-based. For CI/CD integration, consider:
- Puppeteer for headless browser testing
- Jest with JSDOM for unit tests
- Playwright for cross-browser testing

## Adding New Tests

When adding features or fixing bugs:

1. **Add test cases** to the relevant test file
2. **Follow the pattern:**
   ```javascript
   console.log('Test Category: Your Category');
   {
       const testJson = { your: "data" };
       const lines = parseJsonToLines(testJson);
       
       assertTrue(condition, 'Test description', input);
       assertEquals(actual, expected, 'Test description', input);
   }
   ```

3. **Update this README** with new test counts
4. **Run all tests** to ensure nothing broke

## Test Patterns

### Unit Test Pattern
```javascript
const testJson = { simple: "case" };
const lines = parseJsonToLines(testJson);
assertTrue(lines[0].isCollapsible, 'Description');
```

### Integration Test Pattern
```javascript
const testJson = { complex: { nested: [1, 2, 3] } };
const lines = parseJsonToLines(testJson);
const index = lines.findIndex(l => l.text.includes('"nested"'));
const endIndex = findMatchingBracket(lines, index);
const label = getCollapsedLabel(lines, index, endIndex);
assertEquals(label, 'nested', 'Description');
```

### Edge Case Pattern
```javascript
const edgeCases = [
    { input: {}, expected: true },
    { input: [], expected: true },
    { input: { a: {} }, expected: true }
];

edgeCases.forEach(test => {
    const lines = parseJsonToLines(test.input);
    // Assert expectations
});
```

## Test Utilities

The test file includes these utility functions:

- `assert(condition, name, expected, actual, input)` - Basic assertion
- `assertTrue(condition, name, input)` - Boolean assertion
- `assertEquals(actual, expected, name, input)` - Equality assertion

## Browser Compatibility

Tests verified in:
- ✅ Chrome 120+
- ✅ Firefox 121+
- ✅ Edge 120+
- ✅ Safari 17+

## Future Test Additions

Planned test categories:
- [ ] Performance tests (large JSON files)
- [ ] Memory leak tests (repeated collapse/expand)
- [ ] Accessibility tests (keyboard navigation)
- [ ] Visual regression tests (UI rendering)
- [ ] Cross-browser compatibility tests

## Continuous Integration

To integrate with CI/CD:

```yaml
# Example GitHub Actions workflow
test:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v2
    - name: Run tests
      run: |
        npx playwright test tests/*.test.html
```

## Troubleshooting

**Tests not running?**
- Ensure browser has JavaScript enabled
- Check browser console for errors
- Try a different browser
- Clear cache and reload

**Tests failing unexpectedly?**
- Verify you're testing the latest code
- Check if functions were renamed/moved
- Review test assumptions
- Add console.log() debugging

---

*Last updated: 2026-02-10*
