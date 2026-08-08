# Learnings: Hierarchical Collapse/Expand Behavior in ACE Editor

## Date: 2026-02-12
## Feature: One-Level-At-A-Time Expand Behavior

---

## Problem Statement

The ACE Editor in the Code view had a standard collapse/expand behavior where expanding a collapsed section would also expand all nested children. This made navigation difficult in deeply nested JSON structures:

**Before:**
1. Click "Collapse All" → Everything collapses ✓
2. Expand root → Root AND all children expand ✗
3. Result: No control over expansion depth

**Desired:**
1. Click "Collapse All" → Everything collapses ✓
2. Expand root → Only root level visible, children stay collapsed ✓
3. Expand child → Only that child visible, grandchildren stay collapsed ✓
4. Result: Progressive disclosure, one level at a time

---

## Key Learnings

### 1. ACE Editor Folding System

ACE Editor has a built-in folding system that works differently from custom collapse implementations:

**Key Methods:**
```javascript
// Add a fold
session.addFold('...', range);

// Remove a fold (expand)
session.removeFold(fold);

// Get all current folds
session.getAllFolds();

// Get fold at specific row
session.getFoldAt(row);

// Get the foldable range for a row
session.getFoldWidgetRange(row);
```

**Important Insight:** When you unfold a section, ACE naturally shows ALL content within that section, including nested structures. We need to intercept this and immediately re-fold children.

### 2. The `changeFold` Event

ACE fires a `changeFold` event whenever folds are added or removed:

```javascript
editor.session.on('changeFold', function() {
    // Called on ANY fold change
    // Both user-initiated and programmatic
});
```

**Critical Challenge:** When we programmatically fold children in response to an expansion, that triggers MORE `changeFold` events, creating a recursive loop.

### 3. Detecting User Expansions vs Programmatic Changes

**Strategy:** Track the previous state of folds and compare with current state:

```javascript
let previousFolds = new Set(); // Tracks row numbers that are folded

editor.session.on('changeFold', function() {
    const currentFolds = new Set();
    editor.session.getAllFolds().forEach(fold => {
        currentFolds.add(fold.start.row);
    });
    
    // Find which rows were expanded (in previous but not in current)
    const expandedRows = [];
    previousFolds.forEach(row => {
        if (!currentFolds.has(row)) {
            expandedRows.push(row);
        }
    });
    
    // Process expansions...
});
```

**Key Insight:** Rows that were in `previousFolds` but NOT in `currentFolds` were just expanded by the user.

### 4. Finding Child Foldable Lines

When a section is expanded, we need to find all its direct children and fold them:

**Algorithm:**
1. Get the expanded row's line content
2. Determine if it's an object `{` or array `[`
3. Find the matching closing bracket using depth tracking
4. Scan all rows between start and end
5. For each row with `{` or `[`, create a fold

```javascript
// Find end of expanded block
let depth = 0;
for (let i = expandedRow; i < editor.session.getLength(); i++) {
    const lineText = editor.session.getLine(i);
    for (let char of lineText) {
        if (char === openChar) depth++;
        if (char === closeChar) depth--;
        if (depth === 0 && i > expandedRow) {
            endRow = i;
            break;
        }
    }
    if (depth === 0 && i > expandedRow) break;
}

// Fold all children
for (let i = expandedRow + 1; i < endRow; i++) {
    const range = editor.session.getFoldWidgetRange(i);
    if (range && !editor.session.getFoldAt(i)) {
        editor.session.addFold('...', range);
    }
}
```

### 5. Preventing Recursive Event Processing

**The Problem:** When we programmatically fold children, that triggers `changeFold` events, which try to process expansions again, which fold more children, etc.

**Solution:** Use a semaphore flag:

```javascript
let isProcessingFolds = false;

editor.session.on('changeFold', function() {
    // Skip if already processing
    if (isProcessingFolds) {
        return;
    }
    
    // Detect expansions...
    
    if (expandedRows.length > 0) {
        isProcessingFolds = true; // Set flag
        
        // Fold all children (triggers more changeFold events)
        expandedRows.forEach(row => {
            // ... fold children ...
        });
        
        // Update state AFTER all folding is complete
        const allFoldsAfter = editor.session.getAllFolds();
        previousFolds = new Set();
        allFoldsAfter.forEach(fold => previousFolds.add(fold.start.row));
        
        isProcessingFolds = false; // Clear flag
    }
});
```

**Critical Timing:** The `previousFolds` state MUST be updated AFTER all child folding is complete, not before. Otherwise, the second-level expansion won't work because the state is stale.

### 6. State Update Timing

**Wrong approach (doesn't work for nested levels):**
```javascript
previousFolds = currentFolds; // Updates BEFORE child folding
// Fold children...
```

**Correct approach:**
```javascript
// Fold children...
// THEN update state after all folding is complete
const allFoldsAfter = editor.session.getAllFolds();
previousFolds = new Set();
allFoldsAfter.forEach(fold => previousFolds.add(fold.start.row));
```

**Why this matters:** When you expand a second-level item, the `previousFolds` must include all the child folds we just created. If we update too early, those child folds aren't tracked, and expanding them won't trigger child folding.

---

## Complete Implementation

```javascript
// Track previous fold state for detecting expansions
let previousFolds = new Set();
let isProcessingFolds = false;

editor.session.on('changeFold', function() {
    // Prevent recursive processing
    if (isProcessingFolds) {
        return;
    }
    
    const folds = editor.session.getAllFolds();
    
    // Build current fold set
    const currentFolds = new Set();
    folds.forEach(fold => currentFolds.add(fold.start.row));
    
    // Detect which folds were removed (expanded)
    const expandedRows = [];
    previousFolds.forEach(row => {
        if (!currentFolds.has(row)) {
            expandedRows.push(row);
        }
    });
    
    // Process each expansion
    if (expandedRows.length > 0) {
        isProcessingFolds = true;
        
        expandedRows.forEach(row => {
            // Find bracket type
            const line = editor.session.getLine(row);
            const openChar = line.includes('{') ? '{' : '[';
            const closeChar = openChar === '{' ? '}' : ']';
            
            // Find end of block
            let depth = 0, endRow = row;
            for (let i = row; i < editor.session.getLength(); i++) {
                const lineText = editor.session.getLine(i);
                for (let char of lineText) {
                    if (char === openChar) depth++;
                    if (char === closeChar) depth--;
                    if (depth === 0 && i > row) {
                        endRow = i;
                        break;
                    }
                }
                if (depth === 0 && i > row) break;
            }
            
            // Fold all children
            for (let i = row + 1; i < endRow; i++) {
                const childLine = editor.session.getLine(i);
                if (childLine.includes('{') || childLine.includes('[')) {
                    const range = editor.session.getFoldWidgetRange(i);
                    if (range && !editor.session.getFoldAt(i)) {
                        editor.session.addFold('...', range);
                    }
                }
            }
        });
        
        // Update state AFTER folding
        const allFoldsAfter = editor.session.getAllFolds();
        previousFolds = new Set();
        allFoldsAfter.forEach(fold => previousFolds.add(fold.start.row));
        
        isProcessingFolds = false;
    } else {
        // No expansions, just update state
        previousFolds = currentFolds;
    }
    
    // Update fold placeholders, etc...
});
```

---

## Testing Checklist

When implementing hierarchical collapse:

- [ ] Collapse All works (all levels collapsed)
- [ ] Expand root → only root level shows
- [ ] Expand 2nd level → only that item's children show
- [ ] Expand 3rd level → only that item's children show
- [ ] Works recursively at all nesting depths
- [ ] No infinite loops or performance issues
- [ ] State is preserved correctly between expansions
- [ ] Clicking already-expanded items collapses them
- [ ] Multiple expansions in quick succession work

---

## Common Pitfalls

### ❌ Updating state too early
```javascript
previousFolds = currentFolds; // WRONG - updates before child folding
foldChildren();
```

### ❌ Not preventing recursive processing
```javascript
// WRONG - will cause infinite loop
editor.session.on('changeFold', function() {
    foldChildren(); // Triggers more changeFold events
});
```

### ❌ Using line content checks incorrectly
```javascript
// WRONG - doesn't account for strings containing brackets
if (line.includes('{')) { ... }

// BETTER - check if bracket is in JSON structure context
const trimmed = line.trimStart();
if (trimmed.startsWith('{') || trimmed.includes(': {')) { ... }
```

### ❌ Not handling both objects and arrays
```javascript
// WRONG - only handles objects
const openChar = '{';

// RIGHT - detect from line content
const openChar = line.includes('{') ? '{' : '[';
```

---

## Performance Considerations

**Event frequency:** `changeFold` fires on EVERY fold change
- Mitigated by: semaphore flag prevents recursive processing
- Cost: O(n) where n = number of folds (typically < 100)

**Bracket matching:** O(m) where m = lines in expanded block
- Only runs when user expands (not on every render)
- Acceptable for typical JSON files

**State tracking:** O(n) Set operations
- Very fast even for large documents
- Memory: ~4 bytes per folded line

---

## Future Enhancements

1. **Partial collapse** - Collapse only levels 3+, keep 1-2 expanded
2. **Smart collapse** - Collapse all arrays, keep objects expanded
3. **Keyboard navigation** - Arrow keys to navigate between foldable sections
4. **Breadcrumb trail** - Show current path in collapsed structure
5. **Persist preferences** - Remember which sections user prefers collapsed

---

## Related Documentation

- `collapse-feature-learnings.md` - Basic collapse implementation
- `collapse-quick-reference.md` - Quick reference for collapse features
- ACE Editor Folding API: https://ace.c9.io/

---

## Conclusion

The key insights for implementing hierarchical collapse in ACE Editor:

1. **Track state changes** - Compare previous vs current folds to detect expansions
2. **Prevent recursion** - Use semaphore flag to skip programmatic fold changes
3. **Update state after folding** - Critical for multi-level expansion to work
4. **Find and fold children** - Scan the expanded range and fold all foldable lines

This creates an intuitive "one level at a time" navigation experience that's essential for exploring deeply nested JSON structures. The user maintains full control over what they see, enabling progressive disclosure of complex data.
