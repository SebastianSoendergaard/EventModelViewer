# Resizer Implementation Learnings

## Overview
This document captures the technical learnings from implementing a draggable resizer between the editor and viewer panels, including collapsible panels, state persistence, and performance optimization.

## Requirements
The resizer needed to support:
1. **Manual drag resize** - Users can drag to adjust the split between editor (left) and viewer (right)
2. **Independent collapse** - Each panel can collapse independently
3. **Mutual exclusion** - Only one panel can be collapsed at a time
4. **State persistence** - Panel widths and collapse states survive browser reloads
5. **Default split** - Initial layout is 25% editor / 75% viewer
6. **Smooth animations** - Collapse/expand should be animated
7. **Responsive resize** - No lag during dragging

## Technical Architecture

### State Management
```javascript
const panelState = {
    editor: {
        collapsed: false,
        savedWidth: '25%'
    },
    viewer: {
        collapsed: false,
        savedWidth: '75%'
    }
};
```

**Key Design Decision**: Store widths as percentages, not pixels, for responsive behavior across different screen sizes.

### localStorage Persistence
```javascript
function saveLayoutState() {
    const state = {
        editor: { collapsed: panelState.editor.collapsed, savedWidth: panelState.editor.savedWidth },
        viewer: { collapsed: panelState.viewer.collapsed, savedWidth: panelState.viewer.savedWidth }
    };
    localStorage.setItem('eventModelViewerLayout', JSON.stringify(state));
}

function loadLayoutState() {
    const saved = localStorage.getItem('eventModelViewerLayout');
    if (saved) {
        const state = JSON.parse(saved);
        panelState.editor = state.editor || { collapsed: false, savedWidth: '25%' };
        panelState.viewer = state.viewer || { collapsed: false, savedWidth: '75%' };
    }
}
```

**Gotcha Discovered**: Property name consistency is critical. Initially saved as `width` but loaded as `savedWidth`, causing persistence to fail silently. Now both use `savedWidth`.

## Challenges and Solutions

### Challenge 1: Resizer Lag During Drag

**Problem**: Initial implementation had noticeable lag when dragging the resizer. The panels would visually "lag behind" the cursor movement.

**Root Cause**: CSS transitions on panel width changes:
```css
.editor-panel, .diagram-panel {
    transition: width 0.3s ease-in-out;
}
```

These transitions are great for smooth collapse/expand animations, but they cause lag during continuous resize operations.

**Solution**: Dynamically disable transitions during drag operations using a `.resizing` class:

```css
.editor-panel.resizing,
.diagram-panel.resizing {
    transition: none !important;
}
```

```javascript
resizer.addEventListener('mousedown', (e) => {
    isResizing = true;
    // Disable transitions for immediate response
    editorPanel.classList.add('resizing');
    diagramPanel.classList.add('resizing');
});

document.addEventListener('mouseup', () => {
    if (isResizing) {
        // Re-enable transitions
        editorPanel.classList.remove('resizing');
        diagramPanel.classList.remove('resizing');
        saveLayoutState();
    }
});
```

**Key Insight**: Animations and real-time drag operations require different approaches. Use classes to toggle between animation modes.

### Challenge 2: State Persistence Not Working

**Problem**: Custom split positions were not persisting between browser reloads, always reverting to 25%/75%.

**Root Cause**: Property name mismatch in save/load functions:
- `saveLayoutState()` was saving to `state.editor.width`
- `loadLayoutState()` was reading from `state.editor.savedWidth`

**Solution**: Standardized on `savedWidth` throughout:
```javascript
// Save
editor: { collapsed: ..., savedWidth: panelState.editor.savedWidth }

// Load  
panelState.editor = state.editor || { collapsed: false, savedWidth: '25%' };
```

**Key Insight**: When debugging persistence issues, log both the saved and loaded state to verify property names match exactly.

### Challenge 3: Mutual Exclusion Between Panels

**Problem**: Users could collapse both panels simultaneously, leaving no content visible.

**Initial Approach**: Try to prevent collapse if the other panel is already collapsed.

**Better Solution**: Auto-expand the other panel when collapsing one:

```javascript
// Editor collapse handler
panelCollapseBtn.addEventListener('click', () => {
    // If trying to collapse editor while viewer is collapsed, expand viewer first
    if (!panelState.editor.collapsed && panelState.viewer.collapsed) {
        panelState.viewer.collapsed = false;
    }
    panelState.editor.collapsed = !panelState.editor.collapsed;
    updatePanelLayout();
    saveLayoutState();
});
```

**Key Insight**: Instead of blocking user actions, intelligently adjust state to maintain system invariants (at least one panel visible).

### Challenge 4: Collapse Button Positioning

**Problem**: Initially both panels had inconsistent button positioning:
- Editor: Button on right, text on left (space-between)
- Viewer: Initially also space-between, but UX felt inconsistent

**Solution**: Different justify-content for each panel:
```css
.panel-header {
    display: flex;
    justify-content: space-between; /* Default for editor */
    align-items: center;
    gap: 0.75rem;
}

.diagram-panel .panel-header {
    justify-content: flex-start; /* Override for viewer */
}
```

**Result**: 
- Editor: Text left, button right (traditional collapse behavior)
- Viewer: Button left, text next to it (symmetrical with left-side position)

**Key Insight**: Panel headers can have different layouts without duplicating code by using specific overrides.

## Implementation Details

### Resizer HTML Structure
```html
<div class="editor-panel" id="editorPanel">
    <div class="panel-header">...</div>
    <div class="editor-container">...</div>
    <div class="resizer" id="resizer"></div>  <!-- Child of editor panel -->
</div>

<div class="diagram-panel" id="diagramPanel">
    <div class="panel-header">...</div>
    <div class="diagram-container">...</div>
</div>
```

**Note**: Resizer is a child of `editor-panel`, not a sibling. This structural constraint was maintained from original implementation.

### Resizer Event Flow
1. **mousedown on resizer**:
   - Check both panels are expanded (disable resize if either collapsed)
   - Store starting X position and current editor width
   - Add `.resizing` class to both panels (disable transitions)
   - Set cursor to `col-resize` globally

2. **mousemove on document**:
   - Calculate delta from start position
   - Calculate new widths as percentages
   - Apply min/max constraints (10% - 90%)
   - Update both panel widths immediately
   - Store new widths in `panelState` (not saved yet)

3. **mouseup on document**:
   - Remove `.resizing` class (re-enable transitions)
   - Call `saveLayoutState()` to persist to localStorage
   - Trigger ACE editor resize if needed

### Width Constraints
```javascript
const minWidth = containerWidth * 0.1;  // 10% minimum
const maxWidth = containerWidth * 0.9;  // 90% maximum
```

**Rationale**: Prevents panels from becoming unusably small or taking over entire viewport.

### Panel Layout States

The `updatePanelLayout()` function handles 4 possible states:

1. **Both expanded**: Use saved widths (e.g., 30% / 70%)
2. **Editor collapsed**: Editor = 40px, Viewer = 100% - 40px
3. **Viewer collapsed**: Editor = 100% - 40px, Viewer = 40px
4. **Both collapsed**: Not allowed (mutual exclusion prevents this)

```javascript
function updatePanelLayout() {
    const editorCollapsed = panelState.editor.collapsed;
    const viewerCollapsed = panelState.viewer.collapsed;
    
    editorPanel.classList.toggle('collapsed', editorCollapsed);
    diagramPanel.classList.toggle('collapsed', viewerCollapsed);
    
    if (!editorCollapsed && !viewerCollapsed) {
        // Both expanded - use saved widths
        editorPanel.style.width = panelState.editor.savedWidth;
        diagramPanel.style.width = panelState.viewer.savedWidth;
    } else if (editorCollapsed) {
        // Editor collapsed - viewer takes full width minus collapsed editor
        editorPanel.style.width = '40px';
        diagramPanel.style.width = 'calc(100% - 40px)';
    } else {
        // Viewer collapsed - editor takes full width minus collapsed viewer
        editorPanel.style.width = 'calc(100% - 40px)';
        diagramPanel.style.width = '40px';
    }
    
    // Update collapse button icons
    panelCollapseBtn.textContent = editorCollapsed ? '▶' : '◀';
    viewerCollapseBtn.textContent = viewerCollapsed ? '▶' : '◀';
    
    // Resize ACE editor if exists
    if (codeMirrorView && codeMirrorView.resize) {
        setTimeout(() => codeMirrorView.resize(), 0);
    }
}
```

## Performance Considerations

### CSS Transitions
- **Enabled**: During collapse/expand for smooth 0.3s animation
- **Disabled**: During manual resize for immediate visual feedback
- **Method**: Class-based toggling (`.resizing` class)

### ACE Editor Resize
Must call `editor.resize()` after width changes:
```javascript
setTimeout(() => codeMirrorView.resize(), 0);
```

**Why setTimeout?**: Ensures DOM has updated before ACE recalculates its internal dimensions.

### localStorage Frequency
- **Save on**: mouseup after resize, collapse/expand clicks
- **NOT saved on**: Every mousemove during drag (would cause excessive writes)

## Testing Scenarios

### Manual Resize
1. Drag resizer left/right
2. Check panels resize immediately (no lag)
3. Release mouse
4. Reload browser - widths should persist

### Collapse Operations
1. Collapse editor → viewer expands to full width
2. Collapse viewer → editor expands to full width  
3. Collapse editor while viewer collapsed → viewer auto-expands
4. Reload browser → collapse states persist

### Edge Cases
1. Drag resizer to extreme left (10% limit)
2. Drag resizer to extreme right (90% limit)
3. Collapse/expand rapidly
4. Resize window - panels stay responsive

## Recommendations

### For Future Enhancements

1. **Vertical Split**: Current implementation is horizontal only. For vertical split:
   - Change from `width` to `height`
   - Change cursor from `col-resize` to `row-resize`
   - Use `clientY` instead of `clientX`
   - Update constraints for vertical space

2. **Keyboard Shortcuts**: Consider adding:
   - `Ctrl+[` - Toggle editor collapse
   - `Ctrl+]` - Toggle viewer collapse
   - `Ctrl+\` - Reset to default 25/75 split

3. **Touch Support**: Add touch event handlers:
   - `touchstart` → mousedown logic
   - `touchmove` → mousemove logic
   - `touchend` → mouseup logic

4. **Accessibility**: Consider:
   - ARIA labels for resizer
   - Keyboard navigation for resize (arrow keys)
   - Screen reader announcements for state changes

### Code Organization

Current implementation has all resize logic inline in a single `<script>` tag. For larger projects:
- Extract to separate `resizer.js` module
- Create a `PanelManager` class to encapsulate state
- Use event emitters for state change notifications

### Alternative Approaches Considered

**CSS Grid Instead of Flexbox**:
```css
.main-container {
    display: grid;
    grid-template-columns: var(--editor-width) 5px 1fr;
}
```
**Pros**: Easier width management
**Cons**: Harder to implement collapse animations, less browser support for dynamic grid changes

**Split.js Library**:
Popular library for split panes: https://split.js.org/

**Pros**: Battle-tested, handles edge cases
**Cons**: External dependency, added bundle size (not suitable for single-file architecture)

## Key Learnings Summary

1. **Disable transitions during drag operations** for responsive feel
2. **Use percentages for widths** to support responsive layouts
3. **Standardize property names** between save/load for persistence
4. **Implement mutual exclusion** to prevent invalid UI states
5. **Save on mouseup**, not during drag, to avoid excessive writes
6. **Different panel layouts** can share base styles with specific overrides
7. **Call editor.resize()** after width changes with setTimeout
8. **Log state changes** during development to debug persistence issues
9. **Min/max constraints** prevent unusable panel sizes
10. **Class-based animation toggling** provides fine control over transitions

## Related Documentation
- [Code Editor Selection](./code-editor-selection-learnings.md) - ACE Editor integration
- [INDEX.md](./INDEX.md) - Full documentation index

## Version History
- **2026-02-12**: Initial documentation of resizer implementation
