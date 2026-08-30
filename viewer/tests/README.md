# Test Suite

This directory contains test files for the Event Model Viewer application.

## Available Tests

### [trigger-rendering.test.html](trigger-rendering.test.html)
Comprehensive test suite for type-based trigger rendering in `src/viewer/diagram/diagram.js`.

**Test Coverage:**
- ✅ `normalizeTriggerType()` — undefined/null/empty → "ui", known types (case-insensitive), unknown types → "ui" fallback
- ✅ Property key compatibility — `prop.name/prop.value` (new) and `prop.label/prop.propertyName` (legacy), both-present prefers new
- ✅ DOM contract — `.element.trigger` exists with all `data-*` attributes, `.trigger-slot` wrapper, `.trigger-name` label placement
- ✅ Empty `views` — `data-trigger-views=""` emitted correctly; arrow wiring guard filters empty string
- ✅ Missing `trigger.id` — does not throw
- ✅ `ui-input` — dialog chrome, enabled inputs, label/value rendered, buttons in footer
- ✅ `ui-input-disabled` — inputs rendered as disabled
- ✅ `ui-table` — table with column headers from property names, buttons in footer
- ✅ `ui-chart-line` — inline SVG with polyline
- ✅ `ui-chart-column` — inline SVG with rect bars
- ✅ `ui-chart-pie` — inline SVG with 3 path segments
- ✅ UI fallback (no type) — property list, trigger-ui class
- ✅ `automation` — gear SVG, role="img", aria-label, no dialog chrome, correct variant class
- ✅ `translation` — gear SVG, no dialog chrome, correct variant class
- ✅ Multiple view dependencies — all ids in `data-trigger-views`
- ✅ No buttons — `.trigger-footer` not rendered
- ✅ XSS — escapeHtml applied to name, property names/values, button labels
- ✅ Arrow wiring integration — `querySelector('.element.trigger')` finds element per cell, `querySelectorAll` finds all triggers, `closest('.grid-cell')` traverses through `.trigger-slot`

**Status:** ✅ All 57 tests passing

---


Test suite for the arrow routing logic in `src/viewer/diagram/diagram.js`.

**Test Coverage:**
- ✅ `selectNearestPrecedingEvent()` — null on no preceding, single event, multiple events, exact-index exclusion
- ✅ `selectNearestSubsequentEvent()` — null on no subsequent, nearest pick, exact-index exclusion
- ✅ `selectNearestPrecedingView()` — null on no preceding, nearest pick
- ✅ `findEventElements()` — by ID, multiple with same ID, ID-over-name priority
- ✅ `findEventElements()` name fallback — fallback to name, empty on no match
- ✅ `findViewElements()` — by ID, name fallback, empty on no match
- ✅ Command→Event ID resolution — ID first, name fallback, multiple events, duplicate ID nearest-subsequent, unknown identifier
- ✅ Straight-line detection — vertical, horizontal, near-vertical, near-horizontal, diagonal, just-outside-threshold

**Status:** ✅ All 31 tests passing

---

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

---

### [context-menu.test.html](context-menu.test.html)
Comprehensive test suite for the tree view context menu feature (right-click copy/delete).

**Test Coverage:**
- ✅ Deep copy function (simple & complex nodes)
- ✅ Copy node insertion (object properties)
- ✅ Array item copy with re-indexing
- ✅ Deep nested structure copying
- ✅ Delete node functionality
- ✅ Delete nested node functionality
- ✅ Copy key naming conventions (_copy suffix)
- ✅ Find parent node in tree

**Status:** ✅ All 34 tests passing

---

### [inline-edit.test.html](inline-edit.test.html)
Comprehensive test suite for double-click inline editing of leaf values.

**Test Coverage:**
- ✅ Leaf node detection (strings, numbers, booleans, null)
- ✅ String value parsing and validation
- ✅ Number value parsing and validation
- ✅ Boolean value parsing and validation
- ✅ Null value parsing and validation
- ✅ Value update logic
- ✅ Edge cases (long strings, special chars, scientific notation)
- ✅ Type validation (valid/invalid inputs)

**Status:** ✅ All 40+ tests passing

**How to run:**
```bash
# Open in browser
start tests\inline-edit.test.html

# Or from tests directory
cd tests
start inline-edit.test.html
```

**Expected output:**
- Visual test report in browser
- Console output with detailed results
- Pass/fail indicators for each test
- Summary statistics

---

### [history.test.html](history.test.html)
Comprehensive test suite for the history manager (undo/redo functionality).

**Test Coverage:**
- ✅ History initialization (empty state)
- ✅ Push state functionality
- ✅ Undo/redo operations
- ✅ Multiple undo/redo sequences
- ✅ Forward history clearing on new state
- ✅ Duplicate state prevention
- ✅ Maximum state limit (50 states)
- ✅ History clearing
- ✅ Restore flag (prevents loops)
- ✅ Deep cloning (prevents mutation)
- ✅ canUndo/canRedo edge cases
- ✅ Null/undefined state handling

**Status:** ✅ All 17 tests passing

**How to run:**
```bash
# Open in browser
start tests\history.test.html

# Or from tests directory
cd tests
start history.test.html
```

**Expected output:**
- Visual test report in browser
- Console output with detailed results
- Pass/fail indicators for each test
- Summary statistics

---

### [export-tasks.test.html](export-tasks.test.html)
Comprehensive test suite for the "Export as Tasks" feature in `src/toolbar/export-tasks/export-tasks.js` (server mode only) — exports the loaded event model as a paired Markdown + JSON task file (Task File Pair) per deduplicated slice, plus an `index.md`/`index.json` manifest.

**Test Coverage:**
- ✅ `sanitizeSliceName()` — lowercasing/hyphenation, punctuation stripping, empty/null fallback to "slice"
- ✅ `padOrder()` — zero-padding to requested width, no truncation for wider numbers
- ✅ `deduplicateSlices()` — merges fragments sharing the same `id` into one slice; unions `view.events`/`command.events`/`trigger.views` reference arrays across fragments (regression test for a real bug where "first fragment wins" silently dropped dependency events); avoids duplicate refs; unions own `events` by id; unions `tests`; slices with no id at all remain distinct (name→id fallback happens upstream in `event-model.js`'s `calcId`, not in this function); distinct ids stay distinct, in order of first appearance; empty input handling
- ✅ Slice hints — merges distinct hints across deduplicated fragments in stable order; preserves absent versus explicit empty hints; exports non-empty hints to Markdown and JSON while omitting empty Markdown sections
- ✅ `classifySlicePattern()` — State Change (trigger+command, command-only), State View (view-only), Automation/Translation take priority over the generic trigger+command check (case-insensitive type match), Unclassified fallback
- ✅ `patternToCode()` — maps each Title Case pattern to its stable kebab-case JSON code (`"State Change"` → `"state-change"`, etc.), empty/null handling
- ✅ `computeDependencies()` — splits view's upstream events into internal vs. external, excludes the slice's own events, resolves trigger's dependency view excluding its own view, one-hop-only, silently skips unresolvable refs, empty trigger/view handling
- ✅ `buildRelationEdges()` — structured `{from, to, dependency}` edge list mirroring the Markdown Relations section: trigger→command and command→event edges (`dependency: false`), dependency-event→view and dependency-view→trigger edges (`dependency: true`), empty slice produces no edges
- ✅ `generateExportFiles()` — end-to-end: `index.md` + `index.json` + a paired `.md`/`.json` file per deduplicated slice in order, correct filename format/padding (`001-add-item.md`/`.json`), border rendered as `**State:**` (Markdown) / `state` (JSON), correct pattern classification (Title Case in Markdown, kebab-case code in JSON), full embedding of a dependency event (including its properties) defined in another slice in both formats, flattened `events`/`externalEvents`/`views` arrays in JSON, trigger normalization to `swimlane`/`type`, removal of export metadata and relation edges, `tests` passed through into JSON unmodified (structured given/when/then, not flattened strings), `index.json` lists every slice with kebab-case `pattern` and both file names, zero-padding width scales with slice count (12 slices → 3-digit padding)

**Status:** ✅ All 38 tests passing

---

## Test Results Summary

Last test run: 2026-02-11

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

### Context Menu Tests
| Test Category | Tests | Status |
|--------------|-------|--------|
| Deep Copy Function | 8 | ✅ Pass |
| Copy Node Insertion | 4 | ✅ Pass |
| Array Item Copy | 4 | ✅ Pass |
| Deep Nested Copy | 4 | ✅ Pass |
| Delete Node | 5 | ✅ Pass |
| Delete Nested Node | 3 | ✅ Pass |
| Copy Key Naming | 3 | ✅ Pass |
| Find Parent Node | 3 | ✅ Pass |
| **TOTAL** | **34** | **✅ 100%** |

### Inline Edit Tests
| Test Category | Tests | Status |
|--------------|-------|--------|
| Leaf Node Detection | 6 | ✅ Pass |
| Value Parsing - Strings | 4 | ✅ Pass |
| Value Parsing - Numbers | 7 | ✅ Pass |
| Value Parsing - Booleans | 3 | ✅ Pass |
| Value Parsing - Null | 2 | ✅ Pass |
| Value Update Logic | 4 | ✅ Pass |
| Edge Cases | 6 | ✅ Pass |
| Type Validation | 12 | ✅ Pass |
| **TOTAL** | **44** | **✅ 100%** |

### History Manager Tests
| Test Category | Tests | Status |
|--------------|-------|--------|
| Initialization | 1 | ✅ Pass |
| Push State | 2 | ✅ Pass |
| Undo/Redo Operations | 2 | ✅ Pass |
| Multiple Undo/Redo | 1 | ✅ Pass |
| Forward History Clearing | 1 | ✅ Pass |
| Duplicate Prevention | 1 | ✅ Pass |
| Max State Limit | 1 | ✅ Pass |
| Clear History | 1 | ✅ Pass |
| Restore Flag | 1 | ✅ Pass |
| Deep Cloning | 2 | ✅ Pass |
| Edge Cases | 3 | ✅ Pass |
| Null/Undefined Handling | 1 | ✅ Pass |
| **TOTAL** | **17** | **✅ 100%** |

### Combined Results
**Total Tests:** 221+
**Passed:** 221+
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
start tests\context-menu.test.html
start tests\inline-edit.test.html
start tests\history.test.html

# PowerShell
Start-Process tests\collapse-functionality.test.html
Start-Process tests\tree-view.test.html
Start-Process tests\context-menu.test.html
Start-Process tests\inline-edit.test.html
Start-Process tests\history.test.html
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
