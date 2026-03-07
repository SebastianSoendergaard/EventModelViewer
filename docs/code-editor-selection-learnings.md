# Code Editor Selection & Implementation Learnings

**Date**: 2026-02-12  
**Context**: Replacing custom contenteditable-based line editor with a full-featured code editor  
**Outcome**: Successfully integrated ACE Editor after failed CodeMirror 6 attempts

---

## Background & Requirements

### Initial Problem
The original Code tab used a custom implementation with `contenteditable` spans for line-by-line editing. While it supported collapse/expand functionality, it lacked:
- Proper arrow key navigation across lines
- Multi-line selection and editing
- Standard keyboard shortcuts (Home, End, Ctrl+A, etc.)
- Smooth cursor movement and text insertion
- Standard text editor UX

### Requirements
1. Full text editor capabilities (arrow keys, selection, shortcuts)
2. JSON syntax highlighting
3. Code folding (collapse/expand)
4. Works with single-file HTML (no build process)
5. Loads from CDN
6. Compatible with file:// protocol (double-click to open)
7. Maintains existing features (auto-refresh, undo/redo, tab switching)

---

## Attempt 1: CodeMirror 6

### Why CodeMirror 6?
- Modern, actively maintained
- Native JSON support
- Built-in code folding
- Lightweight (~150KB gzipped)
- Extensible architecture
- Recommended as industry standard

### Implementation Approach
Loaded CodeMirror 6 via ES modules from CDN:
```javascript
import { EditorView, basicSetup } from "https://esm.sh/codemirror@6.0.1";
import { EditorState } from "https://esm.sh/@codemirror/state@6.2.0";
import { json } from "https://esm.sh/@codemirror/lang-json@6.0.1";
// ... more modules
```

### Problems Encountered

#### Problem 1: ES Modules with file:// Protocol
**Issue**: ES module imports don't work reliably with `file://` URLs due to CORS restrictions.

**Attempted Solutions**:
1. esm.sh CDN - didn't load
2. Skypack CDN - didn't load
3. jsDelivr with importmap - didn't load
4. esm.sh with version pinning (v135) - loaded but...

**Result**: Modules loaded but led to Problem 2.

#### Problem 2: Multiple Instances of @codemirror/state
**Error**:
```
Error: Unrecognized extension value in extension set ([object Object]). 
This sometimes happens because multiple instances of @codemirror/state are loaded, 
breaking instanceof checks.
```

**Root Cause**: 
- CodeMirror 6 has a complex dependency tree
- Each package (`@codemirror/view`, `@codemirror/language`, etc.) depends on `@codemirror/state`
- When loaded separately from CDN, each package may bundle its own copy of `@codemirror/state`
- JavaScript `instanceof` checks fail when comparing objects from different module instances
- This breaks CodeMirror's internal extension system

**Attempted Solutions**:
1. Single CDN source (esm.sh) - still multiple instances
2. Version pinning (`?pin=v135`) - still multiple instances
3. Bundle mode (`?bundle`) - still multiple instances
4. Promise.all with consistent CDN base - still multiple instances

**Why it failed**: CDN module bundlers resolve dependencies independently for each package, creating duplicate copies of shared dependencies.

#### Problem 3: No Simple Bundle Available
- CodeMirror 6 doesn't provide a single-file UMD/IIFE bundle
- Designed for modern build tools (webpack, vite, rollup)
- Not optimized for direct browser use without a bundler

### Conclusion on CodeMirror 6
**Verdict**: ❌ Not suitable for single-file HTML applications without a build process.

**Recommendations**:
- ✅ Use with build tools (npm + webpack/vite)
- ✅ Use with local development server (http://)
- ❌ Avoid for file:// protocol applications
- ❌ Avoid for CDN-only implementations without bundling

---

## Solution: ACE Editor

### Why ACE Editor?
- Battle-tested (used by Cloud9 IDE, GitHub, AWS Console)
- Single-file loading from CDN
- No module dependency issues
- Works perfectly with file:// protocol
- Comprehensive feature set built-in
- Easy API

### Variable Naming Note

**Important:** The global variable is named `codeMirrorView` but contains an **ACE Editor** instance:

```javascript
window.codeMirrorView = ace.edit('code-editor');
```

**Why the misleading name?** Historical artifact from the failed CodeMirror 6 attempt (documented above). The variable name was kept to avoid updating all references throughout the codebase.

**Actual API used:**
- `codeMirrorView.setValue()` - ACE method, not CodeMirror
- `codeMirrorView.getValue()` - ACE method
- `codeMirrorView.session.setFoldStyle()` - ACE folding API

When reading code that references `codeMirrorView`, remember it's an ACE Editor instance with ACE's API, not CodeMirror's API.

### Implementation
```html
<script src="https://cdn.jsdelivr.net/npm/ace-builds@1.32.2/src-min-noconflict/ace.js"></script>
```

```javascript
const editor = ace.edit(codeEditor, {
    mode: "ace/mode/json",
    theme: "ace/theme/chrome",
    fontSize: "14px",
    showPrintMargin: false,
    wrap: true
});

editor.setValue(jsonContent, -1);
editor.session.setFoldStyle('markbegin');
```

### Why It Works
1. **Single Script**: One `<script>` tag, no modules, no dependencies
2. **Self-contained**: All features bundled together
3. **No CORS Issues**: Regular script loading works with file://
4. **Mature API**: Simple, well-documented methods
5. **Proven Reliability**: Used in production by major platforms

### Features Implemented
- ✅ JSON syntax highlighting (`mode: "ace/mode/json"`)
- ✅ Code folding (`session.setFoldStyle('markbegin')`)
- ✅ Full keyboard navigation (built-in)
- ✅ Auto-refresh on change (`session.on('change', handler)`)
- ✅ Collapse/Expand All (`session.foldAll()`, `session.unfold()`)
- ✅ Get/Set content (`getValue()`, `setValue()`)
- ✅ Integrates with existing undo/redo system

### Integration Points
```javascript
// Get content
const content = editor.getValue();

// Set content
editor.setValue(jsonContent, -1); // -1 = cursor to start

// Listen for changes
editor.session.on('change', function() {
    // Debounced update logic
});

// Collapse all
const session = editor.session;
session.foldAll();

// Expand all
session.unfold();
```

---

## Key Learnings

### 1. Module Systems Matter
**Lesson**: ES modules are great for modern development but problematic for simple file:// deployments.

**Best Practice**: For single-file HTML applications:
- Use traditional `<script>` tags with IIFE/UMD bundles
- Avoid ES module dependencies
- Choose libraries that provide pre-bundled versions

### 2. CDN Strategy
**Problem**: Different CDN providers bundle dependencies differently.

**Lesson**: When using CDN for complex libraries:
- Prefer libraries with official single-file bundles
- Test with file:// protocol, not just http://
- Check if the library is designed for browser use without build tools

### 3. Dependency Trees are Hidden Complexity
**Lesson**: Modern JavaScript libraries with complex dependency trees (like CodeMirror 6) need bundlers to:
- Deduplicate shared dependencies
- Resolve version conflicts
- Create a single module graph

**Without bundler**: Each package brings its own dependencies, causing conflicts.

### 4. Choose Libraries Designed for Your Use Case
**CodeMirror 6**: Modern, modular, extensible → Best for: Build tool environments  
**ACE Editor**: Monolithic, self-contained, mature → Best for: Single-file HTML, CDN usage

### 5. "Modern" Isn't Always Better
CodeMirror 6's modern architecture (ES modules, tree-shaking, modular extensions) is excellent for apps with build processes, but creates friction for simple deployments.

ACE Editor's older architecture (single bundle, namespace-based) works better for our use case.

---

## Recommendations for Future

### When to Use CodeMirror 6
✅ Projects with npm and build tools (webpack, vite, rollup)  
✅ Modern framework applications (React, Vue, Svelte)  
✅ Need cutting-edge features and extensions  
✅ Development with local server (http://)  

### When to Use ACE Editor
✅ Single-file HTML applications  
✅ No build process  
✅ Need to work with file:// protocol  
✅ Want battle-tested stability  
✅ Need comprehensive features out-of-the-box  

### When to Use Monaco Editor (VS Code's editor)
✅ Advanced IDE-like features needed  
✅ Have build process  
✅ Can handle larger bundle size (~3MB)  
✅ Need TypeScript/IntelliSense features  

### Alternative: Build Your Own Bundle
If CodeMirror 6 is required for file:// protocol:
1. Set up npm project
2. Install CodeMirror 6 packages
3. Use rollup/webpack to create single bundle
4. Include bundle in HTML
5. Maintain build process for updates

**Trade-off**: Adds complexity vs. using pre-built editor.

---

## Technical Debt Notes

### Current State
- Using ACE Editor for Code tab
- Old custom line editor code kept for compatibility (marked as deprecated)
- `renderCodeEditor()` function made safe with guard clause

### Future Improvements
1. **Clean up legacy code**: Remove old contenteditable line editor code
2. **Update CSS**: Remove unused line editor styles
3. **Consider Monaco**: If bundle size isn't a concern
4. **Add schema validation**: ACE supports custom JSON schemas

### Breaking Changes to Avoid
- Tree tab still uses custom tree view editor (don't touch)
- History manager shared between both editors
- Toolbar buttons work for both tabs

---

## Summary

**Problem**: Needed full text editor capabilities with code folding  
**First Choice**: CodeMirror 6 (modern, recommended)  
**Challenge**: ES modules + file:// protocol + dependency conflicts  
**Solution**: ACE Editor (proven, single bundle)  
**Result**: ✅ Fully functional editor with all required features

**Time Investment**: ~3 hours debugging CodeMirror 6, 30 minutes implementing ACE  
**Lesson**: Sometimes the "older" technology is the right tool for the job.

---

## Resources

### ACE Editor
- Website: https://ace.c9.io/
- GitHub: https://github.com/ajaxorg/ace
- CDN: https://cdn.jsdelivr.net/npm/ace-builds@1.32.2/

### CodeMirror 6
- Website: https://codemirror.net/
- GitHub: https://github.com/codemirror/dev
- Note: Requires build process for file:// protocol usage

### Related Docs
- See `code-editor-sync-learnings.md` for synchronization between tabs
- See `collapse-feature-learnings.md` for fold implementation details
