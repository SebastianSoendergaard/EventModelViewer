# Collapsed Label Improvements - Implementation Learnings

**Date**: 2026-02-12  
**Feature**: Enhanced contextual labels for collapsed JSON sections in both Tree and Code views  
**Git Commit**: 0c127d7 introduced `getCollapsedLabel()`, this work extends it to show property name + value

## Problem Statement

The previous implementation of the code editor showed contextual information when collapsing JSON sections, but it displayed EITHER the property name OR its value, not both together. This made navigation through collapsed code less effective.

**Examples of the issue:**
- Showed: `"Add item"` (just the value)
- Wanted: `slice: Add item` (context + value)
- Showed: `"trigger"` (just the property name)
- Wanted: `trigger: User` (property + its identifying value)

## Solution Overview

Enhanced the `getCollapsedLabel()` function to intelligently combine property names with their identifying values, providing better context for navigation in both Tree view and Code view.

## Implementation Details

### 1. Enhanced getCollapsedLabel() Function

**Location**: `index.html` lines ~1404-1565

**Key improvements:**

#### A. Property Name + Value Combination
```javascript
// Combine property name with identifier value
if (propertyName && identifierValue) {
    let label = `${propertyName}: ${identifierValue}`;
    // Truncate if too long
    if (label.length > 60) {
        label = label.substring(0, 57) + '...';
    }
    return label;
}
```

**Result**: `trigger: User`, `command: Add item`, `view: Cart items`

#### B. Enhanced Array Handling with Item Names
```javascript
// For arrays, show count and optionally item names
if (propertyName && startText.includes('[')) {
    let itemCount = 0;
    let itemNames = [];
    
    // Extract item names from array elements
    for (let i = startIndex + 1; i < endIndex; i++) {
        // Count items and extract their names
        if (line === '{' || line.startsWith('{')) {
            itemCount++;
            // Look for name property within this item
            const itemEnd = findMatchingBracket(lines, i);
            // ... extract name ...
            itemNames.push(itemNameMatch[1]);
        }
    }
    
    let label = `${propertyName} (${itemCount} ${itemCount === 1 ? 'item' : 'items'})`;
    
    // Add names if there aren't too many (≤3)
    if (itemNames.length > 0 && itemNames.length <= 3) {
        label += ': ' + itemNames.join(', ');
    }
    
    return label;
}
```

**Result**: 
- `properties (7 items)`
- `events (2 items): Cart created, Item added`
- `tests (3 items): Creates cart..., Adds item..., Fails when...`

#### C. Context Detection for Array Items
```javascript
// For top-level objects in arrays (like slices)
if (identifierValue) {
    let context = 'object';
    
    // Check if we're in the slices array
    for (let i = startIndex - 1; i >= Math.max(0, startIndex - 10); i--) {
        const prevLine = lines[i].text.trim();
        if (prevLine.includes('"slices"') || prevLine.includes("'slices'")) {
            context = 'slice';
            break;
        }
    }
    
    let label = identifierValue;
    if (context !== 'object') {
        label = `${context}: ${identifierValue}`;
    }
    
    return label;
}
```

**Result**: `slice: Add item`, `slice: Cart items`, `slice: Remove item`

#### D. Additional Property Support
Added detection for `error` property to support test scenario labels:
```javascript
// Match "error": "value"
const errorMatch = line.match(/["']error["']\s*:\s*["']([^"']+)["']/i);
```

**Priority**: name > title > role > type > error > id

### 2. Tree View Integration

Tree view already used the `getCollapsedLabel()` function, so improvements were automatically applied.

**No additional changes needed** - the enhanced function immediately improved Tree view labels.

### 3. Code View (ACE Editor) Integration

**Challenge**: Code view uses ACE Editor, which has its own fold rendering system.

#### Initial Attempts (Failed)
1. ❌ **Overriding `fold.placeholder` property directly** - ACE doesn't respect this after fold creation
2. ❌ **Overriding `drawFoldedLine()` method** - Too complex, inconsistent rendering
3. ❌ **Intercepting `addFold()` method** - Placeholder parameter gets ignored

#### Successful Solution
**Listen to `changeFold` event and update placeholders dynamically:**

```javascript
// Location: initCodeMirror() function
editor.session.on('changeFold', function() {
    const folds = editor.session.getAllFolds();
    
    folds.forEach((fold) => {
        const startRow = fold.start.row;
        const endRow = fold.end.row;
        
        // Get the folded lines
        const lines = [];
        for (let i = startRow; i <= endRow; i++) {
            const lineText = editor.session.getLine(i);
            lines.push({ text: lineText, isCollapsible: true });
        }
        
        // Generate custom label using our function
        const label = getCollapsedLabel(lines, 0, lines.length - 1);
        fold.placeholder = `...${label}`;
    });
    
    // Force re-render to apply changes
    editor.renderer.updateFull();
});
```

**Key insight**: The `changeFold` event fires AFTER folds are created/removed, allowing us to modify the placeholder immediately before rendering.

### 4. CSS Styling Challenges

**Problem**: ACE Editor's default `.ace_fold` styling included an overlay that blocked the custom text.

**Solution**: Override ACE's fold styles completely:

```css
/* Custom fold placeholder styling */
#codeEditor .ace_fold {
    color: #999 !important;
    font-style: italic !important;
    background: transparent !important;  /* Remove overlay */
    border: none !important;             /* Remove border */
    cursor: pointer !important;
    pointer-events: all !important;
    display: inline !important;
    padding: 0 4px !important;
    margin: 0 !important;
    position: relative !important;
    z-index: 1 !important;
}

/* Hide any pseudo-elements that might create overlays */
#codeEditor .ace_fold::before,
#codeEditor .ace_fold::after {
    display: none !important;
}
```

**Key issues fixed:**
- Removed `background` that created visual overlay
- Disabled `::before` and `::after` pseudo-elements
- Ensured proper `z-index` for text visibility

## Challenges Encountered

### 1. ACE Editor Documentation
ACE Editor's fold system is poorly documented. Had to experiment with multiple approaches to find what works.

### 2. Event Timing
The `changeFold` event timing was crucial - attempting to set placeholders too early resulted in them being overwritten.

### 3. CSS Specificity
ACE's internal styles required `!important` overrides to prevent the default overlay appearance.

### 4. Misspelled Options
ACE editor showed console warnings about `enableBasicAutocompletion` and `enableLiveAutocompletion` being misspelled options - these were removed.

## Testing Checklist

- [x] Tree view shows enhanced labels
- [x] Code view shows enhanced labels
- [x] Property + value combinations work (e.g., `trigger: User`)
- [x] Array item names show for small arrays (≤3 items)
- [x] Array counts work for all arrays
- [x] Context detection works for slices
- [x] Long labels truncate properly (>60 chars)
- [x] No visual overlay blocks the text
- [x] Fold/unfold functionality still works correctly
- [x] Collapse All / Expand All buttons work

## Label Examples

### Before → After

| Context | Before | After |
|---------|--------|-------|
| Trigger object | `trigger` | `trigger: User` |
| Command object | `Add item` | `command: Add item` |
| Slice object | `Add item` | `slice: Add item` |
| Events array (small) | `events (2 items)` | `events (2 items): Cart created, Item added` |
| Properties array | `properties (7 items)` | `properties (7 items)` *(unchanged, no names)* |
| Tests array | `tests (3 items)` | `tests (3 items): Creates cart..., Adds item..., ...` |
| View object | `Cart items` | `view: Cart items` |

## Best Practices Learned

1. **Reuse logic across views** - Having a single `getCollapsedLabel()` function ensures consistency
2. **Event-driven updates** - Listen to framework events (`changeFold`) rather than trying to intercept methods
3. **Force re-renders** - Call `editor.renderer.updateFull()` after modifying fold data
4. **CSS overrides** - Use `!important` to override third-party library styles when necessary
5. **Debug with console logs** - Added temporary logging to verify event firing and value changes
6. **Truncation is important** - Limit label length to prevent UI layout issues

## Files Modified

- `index.html`: 
  - Enhanced `getCollapsedLabel()` function (~160 lines of changes)
  - Added ACE fold event handler in `initCodeMirror()` (~30 lines)
  - Added CSS overrides for `.ace_fold` (~15 lines)

## Future Enhancements

Possible improvements for the future:

1. **Configurable label format** - Allow users to customize what properties to show
2. **Hover tooltips** - Show full content on hover for collapsed sections
3. **Smart truncation** - Truncate in the middle instead of end (e.g., `very...name`)
4. **Icon indicators** - Add visual icons for different JSON structure types
5. **Color coding** - Different colors for different contexts (slices, commands, events)

## Related Documentation

- `collapse-feature-learnings.md` - Original collapse/expand implementation
- `tree-view-quick-reference.md` - Tree view functionality
- Git commit `0c127d7` - Initial introduction of `getCollapsedLabel()` function

## References

- ACE Editor: https://ace.c9.io/
- Event Model specification: https://eventmodeling.org/
- Previous implementation: Git history commits b931509 (initial editor) → 0c127d7 (logical names)
