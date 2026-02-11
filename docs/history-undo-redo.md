# History Manager: Undo/Redo Implementation

## Overview

The Event Model Viewer includes a comprehensive history manager that tracks all JSON changes and provides undo/redo functionality. Users can revert changes using UI buttons or keyboard shortcuts.

## Features

### 1. **Unified History Tracking**
- Tracks changes from **both** code editor and tree view
- Single history stack for all operations
- Maintains up to 50 states in memory

### 2. **User Interface**
- Undo/redo buttons in **both toolbars** (code and tree)
- Buttons are disabled when undo/redo is not available
- Tooltips on all toolbar buttons

### 3. **Keyboard Shortcuts**
- `Ctrl+Z` - Undo last change
- `Ctrl+Y` - Redo undone change
- Works when focus is NOT in code editor (to avoid conflicts)

### 4. **Smart Tracking**
- **Code Editor:** Debounced tracking (1 second after typing stops)
- **Tree View:** Immediate tracking after:
  - Drag-and-drop operations
  - Context menu copy
  - Context menu delete
  - Inline value editing

## Architecture

### History Manager Object

```javascript
const historyManager = {
    states: [],          // Array of JSON snapshots (max 50)
    currentIndex: -1,    // Current position in history
    maxStates: 50,       // Maximum history items
    isRestoring: false,  // Flag to prevent loops during restore
    
    pushState(json) { },    // Add new state
    undo() { },             // Undo to previous state
    redo() { },             // Redo to next state
    canUndo() { },          // Check if undo is possible
    canRedo() { },          // Check if redo is possible
    clear() { },            // Clear all history
    updateButtons() { }     // Update button disabled states
};
```

### State Management

**States are stored as:**
- Deep clones of `currentJson`
- Prevents reference-based mutation
- Each state is independent

**Current index points to:**
- The currently active state in history
- `-1` when no history exists
- Moves backward on undo, forward on redo

## How It Works

### 1. Pushing States

When JSON changes, a new state is added:

```javascript
historyManager.pushState(currentJson);
```

**Smart behavior:**
- Ignores duplicate states (no change = no push)
- Clears forward history if in middle of stack
- Maintains maximum 50 states (removes oldest)
- Deep clones JSON to prevent mutation

### 2. Undo Operation

```javascript
historyManager.undo();
```

**Process:**
1. Checks if undo is possible (`currentIndex > 0`)
2. Moves index backward: `currentIndex--`
3. Restores state from history array
4. Updates all three views (tree, code, diagram)
5. Updates button disabled states

### 3. Redo Operation

```javascript
historyManager.redo();
```

**Process:**
1. Checks if redo is possible (`currentIndex < states.length - 1`)
2. Moves index forward: `currentIndex++`
3. Restores state from history array
4. Updates all three views
5. Updates button disabled states

### 4. Restore State

```javascript
restoreState(json) {
    this.isRestoring = true;  // Prevent pushState during restore
    currentJson = JSON.parse(JSON.stringify(json));
    renderCodeEditor();
    renderTreeView();
    updateDiagram();
    this.isRestoring = false;
}
```

**Critical:** `isRestoring` flag prevents infinite loops by blocking pushState during restore operations.

## Integration Points

### Code Editor (Debounced)

In `updateJsonFromEditor()`:

```javascript
debounceTimer = setTimeout(() => {
    try {
        const jsonText = /* ... get text from editor ... */;
        const parsed = JSON.parse(jsonText);
        currentJson = parsed;
        updateDiagram();
        
        // Push to history after successful parse
        historyManager.pushState(currentJson);
    } catch (error) {
        // Invalid JSON, don't update or push
    }
}, 1000);
```

**Debouncing prevents:**
- Pushing state on every keystroke
- Memory bloat from rapid changes
- Poor UX (can't undo small edits)

### Tree View Actions (Immediate)

#### Drag and Drop
```javascript
function handleDrop(e) {
    // ... perform drop operation ...
    rebuildJsonFromTree();
    renderTreeView();
    renderCodeEditor();
    updateDiagram();
    
    // Push to history immediately
    historyManager.pushState(currentJson);
}
```

#### Copy Node
```javascript
function copyTreeNode() {
    // ... copy node ...
    rebuildJsonFromTree();
    renderTreeView();
    renderCodeEditor();
    updateDiagram();
    
    // Push to history after copy
    historyManager.pushState(currentJson);
    hideContextMenu();
}
```

#### Delete Node
```javascript
function deleteTreeNode() {
    // ... delete node ...
    rebuildJsonFromTree();
    renderTreeView();
    renderCodeEditor();
    updateDiagram();
    
    // Push to history after delete
    historyManager.pushState(currentJson);
    hideContextMenu();
}
```

#### Inline Edit
```javascript
const saveEdit = () => {
    // ... save edited value ...
    rebuildJsonFromTree();
    renderTreeView();
    renderCodeEditor();
    updateDiagram();
    
    // Push to history after inline edit
    historyManager.pushState(currentJson);
};
```

### File Upload (Clear History)

```javascript
fileInput.addEventListener('change', (event) => {
    reader.onload = (e) => {
        currentJson = JSON.parse(jsonContent);
        
        // Clear history and push initial state
        historyManager.clear();
        historyManager.pushState(currentJson);
        
        renderCodeEditor();
        renderDiagram(jsonContent);
    };
});
```

**This ensures:**
- New file starts fresh history
- Can't undo to previous file's states
- First state is the loaded file

## UI Components

### Toolbar Buttons

**Code Toolbar:**
```html
<div class="code-toolbar">
    <button id="codeCollapseBtn" title="Collapse all JSON objects">▼</button>
    <button id="codeExpandBtn" title="Expand all JSON objects">▶</button>
    <button id="codeUndoBtn" title="Undo (Ctrl+Z)">↶</button>
    <button id="codeRedoBtn" title="Redo (Ctrl+Y)">↷</button>
</div>
```

**Tree Toolbar:**
```html
<div class="tree-toolbar">
    <button id="treeCollapseAllBtn" title="Collapse all nodes">▼</button>
    <button id="treeExpandAllBtn" title="Expand all nodes">▶</button>
    <button id="treeUndoBtn" title="Undo (Ctrl+Z)">↶</button>
    <button id="treeRedoBtn" title="Redo (Ctrl+Y)">↷</button>
</div>
```

### Button States

```css
button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    background: #f0f0f0;
}
```

**Dynamic updates:**
```javascript
updateButtons() {
    const canUndo = this.canUndo();
    const canRedo = this.canRedo();
    
    codeUndoBtn.disabled = !canUndo;
    codeRedoBtn.disabled = !canRedo;
    treeUndoBtn.disabled = !canUndo;
    treeRedoBtn.disabled = !canRedo;
}
```

### Keyboard Shortcuts

```javascript
document.addEventListener('keydown', (e) => {
    const isInEditor = e.target.closest('#codeEditor') !== null;
    
    // Ctrl+Z for undo
    if (e.ctrlKey && e.key === 'z' && !e.shiftKey && !isInEditor) {
        e.preventDefault();
        historyManager.undo();
    }
    
    // Ctrl+Y for redo
    if (e.ctrlKey && e.key === 'y' && !isInEditor) {
        e.preventDefault();
        historyManager.redo();
    }
});
```

**Key points:**
- Only works when NOT in code editor
- Prevents conflicts with browser's native undo
- `preventDefault()` stops default browser behavior

## Optimizations

### 1. Duplicate Prevention

```javascript
pushState(json) {
    const jsonString = JSON.stringify(json);
    if (this.states.length > 0 && this.currentIndex >= 0) {
        const lastState = this.states[this.currentIndex];
        if (JSON.stringify(lastState) === jsonString) {
            return; // No change, don't push
        }
    }
    // ... add state ...
}
```

**Prevents:**
- Multiple identical states in history
- Memory waste
- Confusing undo behavior (undoing to same state)

### 2. Forward History Clearing

```javascript
if (this.currentIndex < this.states.length - 1) {
    this.states = this.states.slice(0, this.currentIndex + 1);
}
```

**Standard undo/redo behavior:**
- When in middle of history and new state is pushed
- All "future" states are discarded
- Creates new timeline from current point

### 3. Maximum State Limit

```javascript
if (this.states.length > this.maxStates) {
    this.states.shift(); // Remove oldest
} else {
    this.currentIndex++;
}
```

**Memory management:**
- Limits history to 50 states
- Removes oldest when limit exceeded
- Prevents memory bloat with long editing sessions

### 4. Deep Cloning

```javascript
// When pushing
const clonedJson = JSON.parse(JSON.stringify(json));
this.states.push(clonedJson);

// When restoring
currentJson = JSON.parse(JSON.stringify(json));
```

**Prevents mutation:**
- States are independent copies
- Modifying current JSON doesn't affect history
- Restoring doesn't create shared references

## Edge Cases Handled

### 1. Single State
- Can't undo with only 1 state
- `canUndo()` returns false
- Buttons disabled

### 2. At End of History
- Can't redo when at latest state
- `canRedo()` returns false
- Redo button disabled

### 3. Null/Undefined States
```javascript
if (!json) return; // Ignore null/undefined
```

### 4. Restore Loop Prevention
```javascript
if (this.isRestoring) return; // Don't push during restore
```

### 5. Invalid JSON (Code Editor)
```javascript
try {
    const parsed = JSON.parse(jsonText);
    currentJson = parsed;
    historyManager.pushState(currentJson);
} catch (error) {
    // Don't push invalid JSON
}
```

## User Experience

### Visual Feedback
- ✅ Buttons show disabled state (grayed out, 40% opacity)
- ✅ Tooltips explain functionality
- ✅ Both toolbars have identical controls
- ✅ Keyboard shortcuts work globally

### Behavior
- ✅ Debounced code editor (smooth typing experience)
- ✅ Immediate tree actions (instant feedback)
- ✅ All three views stay synchronized
- ✅ History persists during session
- ✅ Clears on file upload (expected behavior)

### Performance
- ✅ Max 50 states prevents memory bloat
- ✅ Deep cloning is fast for typical JSON sizes
- ✅ Button updates are instant
- ✅ No lag during normal operations

## Testing

See `tests/history.test.html` for comprehensive test suite:

- ✅ 17 tests covering all functionality
- ✅ History initialization
- ✅ Push state logic
- ✅ Undo/redo operations
- ✅ Edge cases
- ✅ Memory management
- ✅ Deep cloning

**Run tests:**
```bash
start tests\history.test.html
```

## Troubleshooting

### Undo/Redo Not Working
1. Check browser console for errors
2. Verify buttons are not disabled
3. Try keyboard shortcuts (Ctrl+Z, Ctrl+Y)
4. Ensure you're not in code editor when using shortcuts

### History Not Tracking Code Changes
1. Wait 1 second after typing stops
2. Ensure JSON is valid (invalid JSON is ignored)
3. Check if actual change occurred (duplicates ignored)

### History Not Tracking Tree Changes
1. Verify action completed successfully
2. Check console for errors
3. Ensure `pushState()` is called after action

### Buttons Always Disabled
1. Check if history has states
2. Try making an edit
3. Verify button event listeners are attached
4. Check browser console for errors

## Future Enhancements

Possible improvements:
- [ ] Configurable history limit (user setting)
- [ ] History view panel (see list of states)
- [ ] Named checkpoints (bookmarks in history)
- [ ] Ctrl+Shift+Z as alternative redo shortcut
- [ ] Visual diff between states
- [ ] Persistent history (localStorage)
- [ ] Branch visualization (when undoing and making new changes)

---

**Last Updated:** 2026-02-11
**Status:** ✅ Fully implemented and tested
