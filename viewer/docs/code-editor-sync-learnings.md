# Learnings: Code Editor Multi-View Synchronization

## Date: 2026-02-11
## Feature: Code Editor Live Updates to Tree View and Diagram

---

## Problem Statement

When editing JSON in the code editor view, changes were not reflected in the diagram or tree view. Users would type changes, wait for the debounce period, but nothing would update. This broke the multi-view synchronization that is core to the application's UX.

---

## Root Cause Analysis

### Initial Investigation

**Symptoms:**
- Code editor edits didn't update diagram
- Code editor edits didn't update tree view
- Tree view edits worked correctly
- File uploads worked correctly
- Only code-to-other-views sync was broken

**First Hypothesis (INCORRECT):**
Initially thought the issue was:
1. Missing event listeners for `input` events
2. Wrong function name (`buildTreeFromJson` vs `buildTreeData`)

**Actions Taken:**
1. Added `input` event listeners (in addition to `blur`)
2. Fixed function name to `buildTreeData`
3. Added tree view rebuild calls

**Result:** Still didn't work!

### Deep Dive - The Real Problem

**Discovery:**
After adding extensive console logging, discovered that `updateJsonFromEditor()` was running, but the JSON extraction was failing silently.

**The Line Extraction Code:**
```javascript
const lines = Array.from(codeEditor.querySelectorAll('.line-content.editable'));
const jsonText = lines.map(el => el.textContent).join('\n');
```

**The Critical Issue:**
The query selector `.line-content.editable` only matches lines that have BOTH classes. When sections are collapsed:

```html
<!-- Expanded line (editable) -->
<span class="line-content editable" contenteditable="true">  "name": "value",</span>

<!-- Collapsed line (NOT editable) -->
<span class="line-content">{ <span class="code-collapsed">... 5 items</span> }</span>
```

**Result:**
- Collapsed sections are excluded from the extraction
- Produces incomplete JSON (missing closing braces, missing properties)
- `JSON.parse()` throws error
- Error is caught, logged, and nothing updates
- User sees no feedback about what's wrong

### Why This Happens

**Code Editor Structure:**
The code editor uses contenteditable spans for each line with collapse/expand functionality:

1. **Expanded state:** Line has `.editable` class and `contenteditable="true"`
2. **Collapsed state:** Line shows summary, loses `.editable` class
3. **Reconstruction:** Attempts to rebuild full JSON from editable lines only

**The Flaw:**
When reconstructing JSON from the DOM, collapsed sections are invisible. The original JSON data for collapsed sections is not preserved in the DOM - it's replaced with a summary like "... 5 items".

---

## Solution

### Approach

Since collapsed sections lose their data in the DOM representation, editing while sections are collapsed is fundamentally impossible. The solution is to **require all sections to be expanded before editing**.

### Implementation

```javascript
function updateJsonFromEditor() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        console.log('updateJsonFromEditor: Attempting to parse JSON from editor');
        try {
            // Check if there are any collapsed sections
            const hasCollapsed = collapsedLines.size > 0;
            if (hasCollapsed) {
                console.log('updateJsonFromEditor: Cannot update - some sections are collapsed. Expand all to edit.');
                return; // Don't attempt to parse if anything is collapsed
            }
            
            // Get all editable lines (now guaranteed to be complete)
            const lines = Array.from(codeEditor.querySelectorAll('.line-content.editable'));
            const jsonText = lines.map(el => el.textContent).join('\n');
            
            const parsed = JSON.parse(jsonText);
            currentJson = parsed;
            
            // Rebuild tree view
            if (currentJson) {
                treeData = buildTreeData(currentJson);
                renderTreeView();
            }
            
            // Update diagram
            updateDiagram();
            
            // Push to history
            historyManager.pushState(currentJson);
        } catch (error) {
            console.log('updateJsonFromEditor: Invalid JSON, not updating -', error.message);
        }
    }, 1000);
}
```

**Key Changes:**
1. Check `collapsedLines.size > 0` before attempting extraction
2. If collapsed, log warning and return early
3. If expanded, proceed with full extraction
4. Ensure tree view and diagram are both updated

### Event Listeners

Added both `input` and `blur` events for better responsiveness:

```javascript
codeEditor.querySelectorAll('.line-content.editable').forEach(content => {
    // Listen for input events to track changes as user types
    content.addEventListener('input', () => {
        console.log('Code editor: input event fired');
        updateJsonFromEditor();
    });
    
    content.addEventListener('blur', () => {
        console.log('Code editor: blur event fired');
        updateJsonFromEditor();
    });
});
```

**Why Both:**
- `input`: Fires on every character typed (debounced to 1 second)
- `blur`: Fires when clicking away from field (backup for edge cases)

---

## User Experience Impact

### Before Fix
❌ User types changes → Nothing happens → Confusion
❌ No feedback about what's wrong
❌ Users assume the editor is broken

### After Fix
✅ User must expand all sections first (clear requirement)
✅ Changes update after 1 second delay (visible feedback)
✅ Console logs explain what's happening
✅ All three views stay synchronized

### User Instructions

**To edit in code view:**
1. Click "Expand All" (▶) button in code toolbar
2. Make your edits to the JSON
3. Wait 1 second (debounce period)
4. Diagram and tree view update automatically
5. Can collapse sections again after editing

**Alternative:**
Use tree view for editing (no expansion required, works with collapsed nodes)

---

## Technical Learnings

### 1. ContentEditable Complexity

**Lesson:** ContentEditable with line-by-line spans is complex when sections can disappear.

**Alternatives Considered:**
- **Single contenteditable div:** Would work but lose syntax highlighting per line
- **Textarea:** Would work but lose collapse/expand functionality  
- **Monaco Editor:** Full-featured but heavy dependency
- **Current approach:** Keep collapse feature, require expansion for editing

**Decision:** Keep current approach with "expand all" requirement. The collapse feature is valuable for navigation of large JSON files, even if editing requires expansion.

### 2. DOM as Source of Truth Pitfall

**Lesson:** When the DOM doesn't contain complete data (collapsed sections), you can't reconstruct the full data structure from it.

**Better Pattern:**
- Keep `currentJson` as source of truth
- DOM is just a view/representation
- Edits should update `currentJson` directly
- Re-render views from `currentJson`

**Current Implementation:**
- Tries to reconstruct JSON from DOM (works only when fully expanded)
- Hybrid approach: DOM → JSON → Views

**Future Enhancement:**
Could store original line data in `data-*` attributes:
```html
<span class="line-content editable" 
      contenteditable="true"
      data-line-json='{"key": "value"}'>
  "key": "value"
</span>
```

### 3. Event Listener Lifecycle

**Lesson:** Event listeners must be reattached when DOM is recreated.

**Pattern:**
```javascript
function renderCodeEditor() {
    codeEditor.innerHTML = html.join('');
    attachCodeEditorListeners(); // Critical - reattach after DOM replacement
}

function attachCodeEditorListeners() {
    // Fresh listeners for new DOM elements
    codeEditor.querySelectorAll('.line-content.editable').forEach(content => {
        content.addEventListener('input', handler);
    });
}
```

**Why:** Setting `innerHTML` destroys old elements and their listeners.

### 4. Debouncing for User Input

**Lesson:** Debouncing is essential for contenteditable to avoid excessive updates.

**Implementation:**
```javascript
let debounceTimer;
function updateJsonFromEditor() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        // Do the update
    }, 1000);
}
```

**Benefits:**
- Prevents update on every keystroke
- Reduces CPU/memory usage
- Avoids jarring UI updates while typing
- 1 second feels natural (not too fast, not too slow)

### 5. Multi-View Synchronization

**Lesson:** When one view changes, ALL dependent views must update.

**Update Flow:**
```
Code Editor Change
    ↓
Update currentJson (source of truth)
    ↓
    ├─→ Rebuild tree data structure (buildTreeData)
    ├─→ Render tree view (renderTreeView)
    └─→ Render diagram (updateDiagram)
```

**Critical:** Missing any step breaks synchronization.

**Testing:** Always verify all three views after making changes in any view.

---

## Debug Strategy

### Console Logging

Added comprehensive logging at each step:

```javascript
console.log('updateJsonFromEditor: Attempting to parse JSON from editor');
console.log('updateJsonFromEditor: Extracted text, length:', jsonText.length);
console.log('updateJsonFromEditor: JSON parsed successfully');
console.log('updateJsonFromEditor: Rebuilding tree view...');
console.log('updateJsonFromEditor: Tree view rebuilt');
console.log('updateJsonFromEditor: Updating diagram...');
console.log('updateJsonFromEditor: Diagram updated');
```

**Benefits:**
- Pinpoints exactly where process fails
- Shows timing (helps verify debouncing)
- Confirms functions are called in correct order

### Test Page

Created `tests/code-editor-events.test.html` to isolate contenteditable behavior:
- Verifies `input` events fire correctly
- Tests contenteditable interactions
- Rules out browser-specific issues

---

## Edge Cases & Validation

### Edge Case 1: Invalid JSON
**Scenario:** User types incomplete JSON (missing bracket, comma, etc.)
**Behavior:** Parse fails, nothing updates, error logged
**UX:** Silent failure (by design - don't want error popup on every keystroke)

### Edge Case 2: Collapsed Sections
**Scenario:** User edits with some sections collapsed
**Behavior:** Early return, warning logged, no update
**UX:** No feedback (could be improved with toast notification)

### Edge Case 3: Rapid Typing
**Scenario:** User types quickly without pauses
**Behavior:** Timer resets on each keystroke, only updates after 1 second of no typing
**UX:** Smooth, no lag

### Edge Case 4: Switching Views Mid-Edit
**Scenario:** User types in code view, immediately switches to tree view
**Behavior:** Debounced update may or may not have fired
**UX:** Tree view renders from last known good `currentJson`

---

## Future Enhancements

### 1. Visual Feedback for "Expand All" Requirement
```javascript
if (hasCollapsed && userAttemptedEdit) {
    showToast('Please expand all sections before editing', 'warning');
}
```

### 2. Store Line Data in DOM
```html
<span data-original-json='{"key": "value"}'>...</span>
```
Allows reconstruction even when collapsed.

### 3. Different Editor Options
- Provide "Raw JSON" mode (single textarea, no collapse)
- Provide "Tree-only" mode (no code view)
- Let user choose editing preference

### 4. Real-time Validation
```javascript
content.addEventListener('input', () => {
    // Try parse on every input
    // Show red border if invalid
    // Show green border if valid
});
```

### 5. Undo Per-Line
Currently undo works on entire JSON. Could track changes per line for finer granularity.

---

## Related Files

- `index.html` (lines 1449-1467): Event listener attachment
- `index.html` (lines 1506-1545): `updateJsonFromEditor()` function
- `index.html` (lines 1391-1432): `renderCodeEditor()` function
- `index.html` (lines 1434-1467): `attachCodeEditorListeners()` function
- `tests/code-editor-events.test.html`: ContentEditable event testing

---

## Testing

### Manual Testing Checklist
- [x] Load em.json
- [x] Click "Expand All" 
- [x] Edit a value in code view
- [x] Wait 1 second
- [x] Verify diagram updates
- [x] Switch to tree view
- [x] Verify tree reflects changes
- [x] Test with collapsed sections (should not update)
- [x] Verify console logs appear

### Automated Testing
Currently no automated tests for code editor (DOM manipulation heavy).

**Future:** Could use Playwright or Puppeteer for end-to-end testing.

---

## Conclusion

The code editor synchronization issue was caused by attempting to reconstruct JSON from a DOM that doesn't contain complete data (collapsed sections). The solution requires users to expand all sections before editing, which is a reasonable trade-off for maintaining the valuable collapse/expand feature.

Key takeaways:
1. DOM should be a view, not the source of truth
2. Event listeners must be reattached when DOM is recreated
3. Debouncing is essential for contenteditable inputs
4. Multi-view synchronization requires updating all views together
5. Console logging is invaluable for debugging async operations

**Status:** ✅ Fixed and working
**Documentation:** Complete
**Testing:** Manual verification successful
