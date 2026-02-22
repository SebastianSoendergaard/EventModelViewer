# Modular Architecture Learnings

## Overview

This document captures the learnings from splitting the monolithic `app.html` (~4600 lines) into a modular source tree while preserving single-file deployment. The build script assembles all modules back into one standalone `event-model-viewer.html`.

## Goals

1. **Maintainability** — each concern lives in its own file
2. **Single-file deployment** — one HTML file, no server required
3. **Incremental extraction** — move one module at a time, verify between steps
4. **Complete module isolation** — each module owns its HTML, CSS, and JS

---

## Module Hierarchy

```
app.html                         ← app shell (header, checkboxes, context menus)
 └── resizer/                    ← panel layout manager (owns both panels)
       ├── editor/               ← editor shell (tabs, historyManager, shared handlers)
       │     ├── code-view/      ← ACE code editor + toolbar
       │     └── tree-view/      ← JSON tree editor + toolbar
       └── viewer/               ← diagram renderer (zoom, pan, export)
```

### Why resizer is the parent, not a sibling

The resizer module manages the layout of both panels. It owns:
- `panelState` — collapse/expand state and saved widths for both panels
- `updatePanelLayout()` — applies widths and collapse classes to both panels
- `loadLayoutState()` / `saveLayoutState()` — persists layout to localStorage
- The collapse button click handlers for **both** editor and viewer panels
- The drag-resize mouse handlers

Because of this, it makes semantic sense for resizer to be the container that includes editor and viewer, not a child of either. The editor and viewer are content modules; resizer is the layout module that frames them.

---

## Build Script Design

### Placeholder pattern

Each module exposes three injection points:
- `<!-- MODULE_HTML -->` — injected into the parent's HTML
- `/* MODULE_CSS */` — injected into the parent's `<style>` block
- `// MODULE_JS` — injected into the parent's `<script>` block

The build script performs simple string replacement — no transpilation, no bundling tools needed.

### Three-level assembly

```
Level 1: code-view + tree-view → editor
Level 2: editor + viewer → resizer
Level 3: resizer → app
```

```javascript
// Level 1
editorHtml = editorHtml.replace('<!-- CODE_VIEW_HTML -->', codeViewHtml.trimEnd());
editorHtml = editorHtml.replace('<!-- TREE_VIEW_HTML -->', treeViewHtml.trimEnd());
const combinedEditorCss = editorCss + '\n\n' + codeViewCss + '\n\n' + treeViewCss;
const combinedEditorJs  = codeViewJs + '\n\n' + treeViewJs  + '\n\n' + editorJs;

// Level 2
resizerHtml = resizerHtml.replace('<!-- EDITOR_HTML -->', editorHtml.trimEnd());
resizerHtml = resizerHtml.replace('<!-- VIEWER_HTML -->', viewerHtml.trimEnd());
const combinedResizerCss = resizerCss + '\n\n' + combinedEditorCss + '\n\n' + viewerCss;
const combinedResizerJs  = combinedEditorJs + '\n\n' + viewerJs + '\n\n' + resizerJs;

// Level 3
result = appTemplate.replace('<!-- RESIZER_HTML -->', resizerHtml.trimEnd());
result = result.replace('/* RESIZER_CSS */', combinedResizerCss);
result = result.replace('// RESIZER_JS',     combinedResizerJs);
```

### CSS concatenation order matters

CSS is concatenated in dependency order — outer modules last so they can override inner module styles:

```
resizer.css → editor.css → code-view.css → tree-view.css → viewer.css
```

This means resizer-level rules (like panel transitions) apply after editor-level rules, which is correct since resizer is the layout authority.

### JS concatenation order and execution

JS is concatenated in dependency order — inner modules first:

```
code-view.js → tree-view.js → editor.js → viewer.js → resizer.js
```

**Why this order matters**: `resizer.js` defines `updatePanelLayout()` which is called by `editor.js` and `viewer.js` collapse handlers. Since `editor.js` and `viewer.js` are event handlers (not immediate calls), `updatePanelLayout` doesn't need to be declared before them — the handlers only run when a button is clicked, by which time all JS has executed.

However, `resizer.js` is placed last to ensure `codeMirrorView` (from `code-view.js`) is available when the `updatePanelLayout` / `mouseup` handlers call `codeMirrorView.resize()`.

---

## Key Technical Challenges

### Challenge 1: Temporal Dead Zone (TDZ) with `let`

**Problem**: `let` declarations are NOT hoisted. If viewer module code ran before viewer variables were declared, accessing them threw `ReferenceError`.

**Root Cause**: The original app had an initialization block at the top of the script that called functions and accessed variables that hadn't been declared yet because module JS was injected below.

**Solution**: Move the entire initialization block to **after all module JS placeholders**, so all `let` variables are declared before any initialization code runs.

```html
<script>
    // Shared declarations (const only — these are fine at top)
    const editorPanel = document.getElementById('editorPanel');
    ...

    // RESIZER_JS  ← all module code injected here (declares all let vars)

    // Initialization block — runs after all module JS
    loadLayoutState();
    updatePanelLayout();
    initCodeMirror();
    loadJsonFromLocalStorage();
</script>
```

**Key Insight**: `function` declarations are hoisted (safe to call before their textual position), but `let`/`const` are not. Keep initialization calls after all module injections.

### Challenge 2: Resizer position: absolute inside editor panel

**Original structure**: The `<div class="resizer">` was inside `<div class="editor-panel">`, positioned absolutely at the right edge using `position: absolute; right: 0; top: 0; bottom: 0`. This worked visually but coupled the resizer HTML to the editor module.

**After restructuring**: The resizer div became a flex sibling between editor and viewer:

```html
<!-- resizer.html -->
<!-- EDITOR_HTML -->
<div class="resizer" id="resizer"></div>
<!-- VIEWER_HTML -->
```

**CSS change required**: Removed `position: absolute` in favour of flex-child sizing:

```css
/* Before */
.resizer {
    position: absolute;
    right: 0; top: 0; bottom: 0;
    width: 5px;
}

/* After */
.resizer {
    align-self: stretch;
    flex-shrink: 0;
    width: 5px;
}
```

Also removed `.editor-panel.collapsed .resizer { display: none }` from `editor.css` — the JS `updatePanelLayout()` sets `resizer.style.display` directly, which is now the single source of truth.

**Key Insight**: When restructuring HTML hierarchy, audit all CSS rules that reference both the old parent and the element being moved. Rules like `.parent .child { ... }` break when the hierarchy changes.

### Challenge 3: Cross-module variable references

**Problem**: The `diagramContainer` pan handler in `app.html` references `isResizing` (defined in `resizer.js`) and `isDragging` (defined in `viewer.js`). These modules are injected later in the file.

**Why it still works**: The pan handler is an event listener callback — it only runs when the user interacts. By the time any interaction occurs, all module JS has executed and all `let` variables are declared. Closures capture variable *bindings*, not values, so there is no TDZ issue at call time.

**Key Insight**: Event handlers that close over `let` variables declared later in the same script are safe — the handler's body executes at event time, not definition time.

### Challenge 4: UTF-8 BOM encoding

**Problem**: PowerShell's default `[System.Text.Encoding]::UTF8` adds a Byte Order Mark (BOM) to the output file. Browsers handle this, but it produces a slightly different file from `index.html`.

**Solution**: Use `New-Object System.Text.UTF8Encoding $false` for BOM-free UTF-8, or use Node.js `fs.writeFileSync` with `{ encoding: 'utf8' }` (no BOM by default).

**Key Insight**: Always verify file encoding when build output differs unexpectedly from the reference file. BOM issues are invisible in most editors but detectable by file size comparison.

---

## Module Boundaries

### What belongs in each module

| Module | Owns |
|--------|------|
| `app` | Page shell: header, upload, checkboxes, context menu HTML; shared vars (`currentJson`, `currentFileName`); shared functions (`updateDiagram`, `saveJsonToLocalStorage`, `createNew`, `saveToFile`) |
| `resizer` | Panel layout: `panelState`, `loadLayoutState`, `saveLayoutState`, `updatePanelLayout`; resize drag handlers; both panel collapse button handlers; panel transition CSS; resizer element |
| `editor` | Editor shell: tabs, tab-switching; `historyManager` (shared between code/tree); undo/redo button handlers; add-slice functions; keyboard shortcuts; checkbox handlers |
| `code-view` | ACE editor: `codeEditor`, `codeMirrorView`, `collapsedLines`; `initCodeMirror`, `renderCodeEditor`, `parseJsonToLines`; code toolbar handlers |
| `tree-view` | Tree editor: `treeData`, `treeCollapsedNodes`; all tree render/edit functions; drag-drop; context menu handlers; tree toolbar handlers |
| `viewer` | Diagram: `currentZoom`, `isDragging`; `renderDiagram`, `setZoom`; zoom/pan/export handlers; all swimlane layout functions |

### Shared variables — keep in app.html

`currentJson` and `currentFileName` are read by the viewer (to re-render) and written by both the editor (on every keystroke) and the file loader. Since all modules run in the same script scope, keeping them as `let` declarations in `app.html` (before all module injections) makes them available to all without any import/export mechanism.

### historyManager — keep in editor shell, not code-view or tree-view

Both `code-view` and `tree-view` push to and pull from `historyManager`. If it were in `code-view`, tree-view would depend on code-view (wrong direction). Keeping it in `editor.js` (the shell) makes both sub-modules depend upward on their parent — the correct direction.

---

## File Structure Reference

```
src/
├── app.html                    # App shell template (6 placeholders → 3 after restructure)
├── resizer/
│   ├── resizer.html            # EDITOR_HTML + resizer div + VIEWER_HTML
│   ├── resizer.css             # Panel transitions, .resizer styles
│   └── resizer.js              # panelState, layout functions, all panel handlers
├── editor/
│   ├── editor.html             # Editor panel shell with CODE_VIEW_HTML + TREE_VIEW_HTML
│   ├── editor.css              # Panel structure, tabs, container (no resizer styles)
│   ├── editor.js               # historyManager, tab switching, shared handlers
│   ├── code-view/
│   │   ├── code-view.html      # codeView div with toolbar
│   │   ├── code-view.css       # ACE editor, code-line, toolbar styles
│   │   └── code-view.js        # initCodeMirror, renderCodeEditor, all code functions
│   └── tree-view/
│       ├── tree-view.html      # treeView div with toolbar
│       ├── tree-view.css       # Tree nodes, context menus, drag-drop styles
│       └── tree-view.js        # renderTreeView, all tree functions
└── viewer/
    ├── viewer.html             # Diagram panel with zoom controls
    ├── viewer.css              # Diagram layout, swimlanes, element styles
    └── viewer.js               # setZoom, renderDiagram, all swimlane functions

build.js                        # Assembly script (run with: node build.js)
event-model-viewer.html         # Built output (~183 KB, single-file deployment)
index.html                      # Reference file (compare against built output)
```

---

## Running the Build

```bash
node build.js
# → Build successful: event-model-viewer.html
# → Size: 183 KB
```

Output is written to `event-model-viewer.html` in the project root. Compare against `index.html` to verify correctness.

---

## Key Learnings Summary

1. **Simple string replacement** is sufficient for a build script when modules have no dynamic imports — no bundler needed
2. **Placeholder naming convention** (`<!-- MODULE_HTML -->`, `/* MODULE_CSS */`, `// MODULE_JS`) makes injection points unambiguous and self-documenting
3. **Move initialization to after all injections** to avoid TDZ errors with `let` variables
4. **`function` declarations are hoisted**; cross-module calls work even when the callee's module text appears later
5. **Event handler closures are safe** to reference variables declared later in the same script — handlers run at event time, not definition time
6. **Restructuring HTML hierarchy requires CSS audit** — ancestor-descendant selectors break when hierarchy changes
7. **The parent module should own shared state** — `historyManager` belongs in `editor.js` because both `code-view` and `tree-view` use it, not in either sub-module
8. **Dependency direction**: sub-modules depend on their parent shell, never the reverse; resizer is the layout authority so it is the parent of editor and viewer
9. **CSS concatenation order** should follow dependency order with the most general (outermost) rules first so inner modules can override
10. **Verify by diff** — comparing built output to a known-good reference file (`index.html`) catches regressions immediately

## Related Documentation

- [Resizer Implementation](./resizer-implementation-learnings.md) — deep dive on drag resize and panel collapse
- [Code Editor Selection](./code-editor-selection-learnings.md) — ACE Editor integration details
- [INDEX.md](./INDEX.md) — full documentation index
