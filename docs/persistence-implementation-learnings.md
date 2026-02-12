# LocalStorage Persistence Implementation - Learnings

**Date**: 2026-02-12  
**Feature**: Auto-save JSON data and UI state to browser localStorage

## Overview

Implemented comprehensive browser persistence using localStorage to save:
- JSON event model data (auto-save on every edit)
- Panel resizer position (editor/viewer split ratio)
- Original filename tracking for smart save operations

Plus added New, Open, and Save file operations with a modern file menu UX.

## Requirements Implemented

1. **Auto-save JSON** - Persist JSON data between browser reloads
2. **Auto-restore** - Load saved data automatically on page load
3. **New functionality** - Clear everything and start fresh
4. **Save functionality** - Download JSON to file with smart filename
5. **Resizer persistence** - Remember panel split position (was already implemented)

## Key Implementation Details

### 1. LocalStorage Keys Used

```javascript
// JSON data persistence
localStorage.setItem('eventModelJson', jsonString);
localStorage.setItem('eventModelFileName', filename);

// Panel state persistence (already existed)
localStorage.setItem('eventModelViewerLayout', layoutString);
```

### 2. Auto-Save Integration

**Location**: `updateDiagram()` function (~line 2605)

```javascript
function updateDiagram() {
    if (currentJson) {
        renderDiagram(JSON.stringify(currentJson));
        // Auto-save to localStorage
        saveJsonToLocalStorage();
    }
}
```

**Why here?** `updateDiagram()` is called whenever JSON changes (editor edits, file loads, undo/redo). It already has debouncing logic built-in, so we get free debouncing for localStorage saves.

### 3. New Variable: Filename Tracking

Added global variable to track loaded filename:

```javascript
let currentFileName = null; // Track loaded filename for save functionality
```

This enables smart "Save" behavior:
- If file was loaded → use original filename
- If new content → derive from `title` field
- Fallback → "event-model.json"

### 4. UI Changes - Modern File Menu

**Before:**
```html
<div class="file-input-wrapper">
    <input type="file" id="fileInput" accept=".json">
    <label for="fileInput" class="file-label">Choose JSON File</label>
</div>
```

**After:**
```html
<button class="file-label" id="newBtn">📄 New</button>
<div class="file-input-wrapper">
    <input type="file" id="fileInput" accept=".json">
    <label for="fileInput" class="file-label">📁 Open</label>
</div>
<button class="file-label" id="saveBtn">💾 Save</button>
```

Standard file menu order: New → Open → Save

### 5. Core Functions Added

#### saveJsonToLocalStorage()
```javascript
function saveJsonToLocalStorage() {
    try {
        const jsonString = JSON.stringify(currentJson);
        localStorage.setItem('eventModelJson', jsonString);
        if (currentFileName) {
            localStorage.setItem('eventModelFileName', currentFileName);
        }
        console.log('JSON auto-saved to localStorage');
    } catch (error) {
        if (error.name === 'QuotaExceededError') {
            console.warn('localStorage quota exceeded, could not save JSON');
        } else {
            console.warn('Failed to save JSON to localStorage:', error);
        }
    }
}
```

**Key points:**
- Try-catch wraps localStorage operations
- Handles `QuotaExceededError` specifically (5-10MB limit)
- Saves filename alongside JSON for save operation

#### loadJsonFromLocalStorage()
```javascript
function loadJsonFromLocalStorage() {
    try {
        const saved = localStorage.getItem('eventModelJson');
        if (saved) {
            const json = JSON.parse(saved);
            currentJson = json;
            
            // Restore filename if available
            const savedFileName = localStorage.getItem('eventModelFileName');
            if (savedFileName) {
                currentFileName = savedFileName;
                fileName.textContent = savedFileName;
            } else {
                fileName.textContent = 'Restored from previous session';
            }
            
            // Initialize history
            historyManager.clear();
            historyManager.pushState(currentJson);
            
            // Update editor, tree view, and diagram
            if (codeMirrorView && codeMirrorView.setValue) {
                codeMirrorView.setValue(JSON.stringify(currentJson, null, 2), -1);
            }
            renderTreeView();
            renderDiagram(JSON.stringify(currentJson));
            
            console.log('JSON loaded from localStorage');
            return true;
        }
    } catch (error) {
        console.warn('Failed to load JSON from localStorage:', error);
        // Clear corrupted data
        localStorage.removeItem('eventModelJson');
        localStorage.removeItem('eventModelFileName');
    }
    return false;
}
```

**Key points:**
- Validates JSON before using (`JSON.parse()` may throw)
- Clears corrupted data automatically
- Initializes all UI components (editor, tree, diagram, history)
- Returns boolean for success/failure

#### createNew()
```javascript
function createNew() {
    // Clear current data
    currentJson = null;
    currentFileName = null;
    
    // Clear localStorage
    clearLocalStorage();
    
    // Clear file input
    fileInput.value = '';
    fileName.textContent = 'No file selected';
    
    // Clear history
    historyManager.clear();
    
    // Clear editors
    if (codeMirrorView && codeMirrorView.setValue) {
        codeMirrorView.setValue('', -1);
    }
    renderTreeView();
    
    // Clear diagram
    const diagramEl = document.getElementById('diagram');
    diagramEl.innerHTML = '<div class="placeholder">Create or load an event model to visualize</div>';
    
    console.log('New document created');
}
```

**Key points:**
- Resets all state variables
- Clears localStorage
- Resets all UI components to empty state
- Shows helpful placeholder message

#### saveToFile()
```javascript
function saveToFile() {
    if (!currentJson) {
        alert('No content to save');
        return;
    }
    
    // Determine filename
    let filename = 'event-model.json';
    
    if (currentFileName) {
        // Use original filename if available
        filename = currentFileName;
    } else if (currentJson.title) {
        // Derive from title field
        filename = sanitizeFilename(currentJson.title) + '.json';
    }
    
    // Create blob and download
    const jsonString = JSON.stringify(currentJson, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    console.log('File saved as:', filename);
}
```

**Key points:**
- Smart filename logic (original → title → fallback)
- Uses Blob API for download
- Cleans up temporary DOM elements and URLs
- Pretty-prints JSON with 2-space indentation

#### sanitizeFilename()
```javascript
function sanitizeFilename(title) {
    return title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .substring(0, 50) || 'event-model';
}
```

Converts "My Event Model!" → "my-event-model"

### 6. Initialization Logic

**Location**: After editor initialization (~line 3004)

```javascript
// Initialize CodeMirror for Code tab
initCodeMirror();

console.log('Editor initialized');

// Load saved JSON from localStorage
loadJsonFromLocalStorage();
```

Called AFTER editor is initialized so `codeMirrorView` is available.

### 7. File Upload Handler Update

Added filename tracking:

```javascript
fileInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) {
        currentFileName = file.name;  // ← Track filename
        fileName.textContent = file.name;
        
        // ... existing file reading logic ...
        
        // Save to localStorage
        saveJsonToLocalStorage();  // ← Auto-save after load
    }
});
```

### 8. Button Event Handlers

```javascript
// New button handler
const newBtn = document.getElementById('newBtn');
newBtn.addEventListener('click', () => {
    if (currentJson) {
        const confirmed = confirm('Create a new document? Any unsaved changes will be lost.');
        if (!confirmed) return;
    }
    createNew();
});

// Save button handler
const saveBtn = document.getElementById('saveBtn');
saveBtn.addEventListener('click', () => {
    saveToFile();
});
```

**UX consideration:** Confirmation dialog only shows if `currentJson` exists, preventing unnecessary prompts.

## Integration Points Summary

| Feature | Integration Point | Line (approx) |
|---------|------------------|---------------|
| Auto-save trigger | `updateDiagram()` | 2605 |
| Auto-load trigger | After `initCodeMirror()` | 3004 |
| Filename tracking | File upload handler | 3006 |
| Resizer save | `mouseup` event (already existed) | 2993 |
| Resizer restore | `loadLayoutState()` (already existed) | 2637 |

## Error Handling Strategy

### 1. QuotaExceededError
```javascript
catch (error) {
    if (error.name === 'QuotaExceededError') {
        console.warn('localStorage quota exceeded, could not save JSON');
    }
}
```

localStorage typically has 5-10MB limit. Event models should fit easily, but we handle gracefully.

### 2. Corrupted Data
```javascript
catch (error) {
    console.warn('Failed to load JSON from localStorage:', error);
    // Clear corrupted data
    localStorage.removeItem('eventModelJson');
    localStorage.removeItem('eventModelFileName');
}
```

If `JSON.parse()` fails, we assume corruption and clear the data rather than leaving it in a broken state.

### 3. User Feedback
- Console warnings for debugging
- `alert()` for critical user actions ("No content to save")
- `confirm()` dialog for destructive actions ("Create new document?")

## Testing Checklist

✅ **Auto-save**: Edit JSON → refresh browser → changes persist  
✅ **Auto-restore**: Reload page → see previous JSON  
✅ **File upload**: Load file → overrides saved data  
✅ **New button**: Clear everything → refresh → empty state  
✅ **Save button**: Download file with correct name  
✅ **Resizer**: Adjust split → refresh → position restored  
✅ **Error handling**: Corrupted localStorage → clears automatically  

## Lessons Learned

### 1. Leverage Existing Infrastructure
The app already had:
- `updateDiagram()` with debouncing
- `panelState` object for layout
- `saveLayoutState()` for resizer persistence

By hooking into existing code, we avoided duplicating logic.

### 2. Smart Auto-Save Placement
Placing `saveJsonToLocalStorage()` in `updateDiagram()` gives us:
- Auto-save on any JSON change
- Free debouncing (diagram rendering is already debounced)
- Single integration point

### 3. Filename Tracking is Crucial
Without tracking `currentFileName`, we'd have no way to know the original filename for the "Save" operation. This enables better UX.

### 4. Initialization Order Matters
Must call `loadJsonFromLocalStorage()` AFTER `initCodeMirror()` because we need the editor instance to be ready.

### 5. Graceful Degradation
If localStorage fails (quota, browser restrictions, corrupted data), the app still works - you just lose persistence. Non-blocking errors.

### 6. UX Considerations
- Confirmation dialog only when needed (data exists)
- Smart filename derivation (original → title → fallback)
- Clear visual feedback (filename display)
- Standard file menu order (New → Open → Save)

## Browser Compatibility Notes

### localStorage Support
- ✅ All modern browsers (Chrome, Firefox, Edge, Safari)
- ⚠️ Private/Incognito mode may restrict or disable localStorage
- ⚠️ User can manually clear localStorage via browser settings

### Blob/Download API
- ✅ Widely supported for file downloads
- Uses `URL.createObjectURL()` + `<a download>`

### File Input API
- ✅ FileReader API well-supported
- Handles `.json` file filtering

## Future Enhancements

### Potential Improvements
1. **Visual save indicator** - Show "Saved" or "Saving..." status
2. **Export/Import all data** - Backup localStorage to file
3. **Multiple documents** - Save multiple models with naming
4. **Cloud sync** - Optional cloud storage integration
5. **Auto-save toggle** - Let users disable auto-save if desired
6. **Version history** - Keep multiple versions in localStorage
7. **Keyboard shortcuts** - Ctrl+S for save, Ctrl+N for new

### Storage Limits
Current approach stores entire JSON as string. For very large models:
- Consider compression (LZ-string library)
- Consider IndexedDB for larger storage limits
- Consider chunking large models

## Code Quality Notes

### What Went Well
- ✅ Clean function naming (`saveJsonToLocalStorage`, `loadJsonFromLocalStorage`)
- ✅ Comprehensive error handling with try-catch
- ✅ Console logging for debugging
- ✅ Minimal code changes (surgical edits)

### Code Style
- Followed existing naming conventions (`currentJson`, `panelState`)
- Matched existing code style (function declarations, spacing)
- Added comments at key integration points

## Conclusion

Successfully implemented full localStorage persistence with minimal code changes:
- **~150 lines** of new code
- **5 new functions** (save, load, clear, createNew, saveToFile)
- **2 new buttons** (New, Save)
- **1 new variable** (currentFileName)

The implementation is robust, user-friendly, and integrates seamlessly with the existing codebase. All features work as expected with proper error handling and UX considerations.

## References

- MDN: [localStorage API](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage)
- MDN: [Blob API](https://developer.mozilla.org/en-US/docs/Web/API/Blob)
- MDN: [FileReader API](https://developer.mozilla.org/en-US/docs/Web/API/FileReader)
- Event Modeling: [eventmodeling.org](https://eventmodeling.org/)
