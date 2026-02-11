# Test Suite

This directory contains test files for the Event Model Viewer application.

## Available Tests

### [collapse-functionality.test.html](collapse-functionality.test.html)
Comprehensive test suite for the collapsible JSON editor feature.

**Test Coverage:**
- ✅ Standalone bracket detection (`{`, `[`)
- ✅ Property with object detection (`"prop": {`)
- ✅ Property with array detection (`"prop": [`)
- ✅ Bracket matching (simple & nested structures)
- ✅ Label extraction (property names & name property)
- ✅ Complex nested structures
- ✅ Edge cases (empty objects/arrays)
- ✅ Real-world event model structures
- ✅ Regex pattern validation

**Status:** ✅ All 29+ tests passing

---

### [tree-view.test.html](tree-view.test.html)
Comprehensive test suite for the tree view drag-and-drop feature.

**Test Coverage:**
- ✅ Tree building from JSON
- ✅ Meaningful type badges (array items)
- ✅ Meaningful type badges (regular properties)
- ✅ Nested structure handling
- ✅ Singular form mapping (slices→slice, events→event)
- ✅ Descendant detection (drag-drop validation)
- ✅ Empty structures (objects & arrays)
- ✅ Primitive types (string, number, boolean, null)
- ✅ Real-world event model structure
- ✅ Path tracking for nested elements

**Status:** ✅ All 40+ tests passing

**How to run:**
```bash
# Open in browser
start tests\tree-view.test.html

# Or from tests directory
cd tests
start tree-view.test.html
```

**Expected output:**
- Visual test report in browser
- Console output with detailed results
- Pass/fail indicators for each test
- Summary statistics

---

## Test Results Summary

Last test run: 2026-02-10

### Collapse Functionality Tests
| Test Category | Tests | Status |
|--------------|-------|--------|
| Standalone Bracket Detection | 3 | ✅ Pass |
| Property Object Detection | 2 | ✅ Pass |
| Property Array Detection | 2 | ✅ Pass |
| Bracket Matching | 4 | ✅ Pass |
| Label Extraction | 3 | ✅ Pass |
| Complex Structures | 1 | ✅ Pass |
| Edge Cases | 1 | ✅ Pass |
| Real-world Structure | 6 | ✅ Pass |
| Regex Validation | 7 | ✅ Pass |
| **TOTAL** | **29+** | **✅ 100%** |

### Tree View Tests
| Test Category | Tests | Status |
|--------------|-------|--------|
| Tree Building | 3 | ✅ Pass |
| Meaningful Type - Array Items | 3 | ✅ Pass |
| Meaningful Type - Properties | 3 | ✅ Pass |
| Nested Structures | 4 | ✅ Pass |
| Singular Form Mapping | 5 | ✅ Pass |
| Descendant Detection | 4 | ✅ Pass |
| Empty Structures | 3 | ✅ Pass |
| Primitive Types | 4 | ✅ Pass |
| Real-world EM Structure | 10 | ✅ Pass |
| Path Tracking | 1 | ✅ Pass |
| **TOTAL** | **40+** | **✅ 100%** |

### Combined Results
**Total Tests:** 69+
**Passed:** 69+
**Failed:** 0
**Success Rate:** 100% ✅

---

## Running Tests

### Manual Testing
1. Open test HTML files in any modern browser
2. Review results displayed on the page
3. Check browser console for detailed logs
4. All tests should show green checkmarks

### Quick Test All
```bash
# Windows
start tests\collapse-functionality.test.html
start tests\tree-view.test.html

# PowerShell
Start-Process tests\collapse-functionality.test.html
Start-Process tests\tree-view.test.html
```

### Automated Testing (Future)
For CI/CD integration, consider:
- Puppeteer for headless browser testing
- Jest with JSDOM for unit tests
- Playwright for cross-browser testing

---

## Adding New Tests

When adding features or fixing bugs:

1. **Choose the appropriate test file** or create a new one
2. **Add test cases** following the existing pattern
3. **Test naming convention:** `Category: Description`
4. **Update this README** with new test counts
5. **Run all tests** to ensure nothing broke

### Test Pattern Example
```javascript
console.log('Test Category: Your Feature');
{
    const testJson = { your: "test data" };
    const result = yourFunction(testJson);
    
    assertEquals(result.prop, expectedValue, 'Test: Description');
    assertTrue(result.valid, 'Test: Validation check');
}
```

---

## Test Utilities

Both test files include these utility functions:

- `assert(condition, name, expected, actual, input)` - Basic assertion
- `assertTrue(condition, name, input)` - Boolean true assertion
- `assertFalse(condition, name, input)` - Boolean false assertion
- `assertEquals(actual, expected, name, input)` - Equality assertion

---

## Browser Compatibility

Tests verified in:
- ✅ Chrome 120+
- ✅ Firefox 121+
- ✅ Edge 120+
- ✅ Safari 17+

---

## Future Test Additions

Planned test categories:
- [ ] Drag-and-drop interaction tests
- [ ] Performance tests (large JSON files >1000 nodes)
- [ ] Memory leak tests (repeated operations)
- [ ] Accessibility tests (keyboard navigation)
- [ ] Visual regression tests (screenshot comparison)
- [ ] Cross-browser compatibility matrix

---

## Troubleshooting

**Tests not running?**
- Ensure JavaScript is enabled in browser
- Check browser console (F12) for errors
- Try a different browser
- Clear cache and reload

**Tests failing unexpectedly?**
- Verify you're testing the latest code
- Check if functions were renamed/moved in main app
- Review test assumptions
- Add console.log() for debugging

**Performance issues?**
- Tests with large JSON may be slow
- Close other browser tabs
- Run tests individually

---

*Last updated: 2026-02-10*
*All tests passing ✅*
