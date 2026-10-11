# Event Model Viewer

A web-based application for visualizing event-driven architecture models using Event Modeling, defined in the `.emj` (JSON) or `.emy` (YAML) format. Features an interactive editor with collapsable objects, a drag-and-drop tree view, and a diagram viewer.

# Event Model Viewer

A web-based application for visualizing event-driven architecture models using Event Modeling, defined in the `.emj` (JSON) or `.emy` (YAML) format. Features an interactive editor with collapsable objects, a drag-and-drop tree view, and a diagram viewer.

## Usage

### Standalone (single HTML file)

On build the file **event-model-viewer.html** is created as a single file application. The file can easily be commited to your git repository together with the emj/emy files. This way the viewer lives next to the event model and can be used by anyone.

By having the viewer as a single file application next to the emj/emy files, you will always have a viewer that can handle your diagrams without the fear for compatibility issues or version mismatches. The viewer can be used for any event model defined in the emj or emy format, making it a versatile tool for visualizing and sharing event-driven architecture models.

To see a diagram simply open **event-model-viewer.html** in a web browser and load the emj or emy file. You can then edit the file in the code view or tree view and see the changes reflected in the diagram in real-time. After edits the updated diagram can be saved back to an emj/emy file, exported as task files, or exported as an image. **Export as Tasks** downloads the same Markdown/JSON files produced by server mode, one file per browser download. Task files are named `<model>-<slice>.md` and `.json`; the model-prefixed index files describe the export, and slices without a title are omitted.

### Server mode (EventModelServer)

For a more integrated local experience, the project ships a self-contained Windows desktop application (`EventModelServer.exe`) that hosts the viewer and exposes a file-system API. This removes the need to manually open/save files — the server watches your emj/emy files and pushes live updates to the browser.

**Quick start:**

```cmd
build_server.cmd          # build the .exe (requires .NET 9 SDK)
EventModelServer.exe      # opens browser automatically
```

It scans the folder the exe lives in for `.emj` and `.emy` files by default. Use the **📁 Folder** button in the toolbar to browse to and select a different folder — the choice is remembered for the next launch. Matching paths appear as the scan finds them, so the first file can open while the rest of the folder is still being searched.

Use **📤 Export as Tasks** to write the selected Markdown and/or JSON task export files to a selected local folder. Files use the model filename (or, for a new model, its title) as a prefix. See [`server/docs/README.md`](server/docs/README.md) for the full API reference and architecture overview.

## Event Model Format (.emj / .emy)

The viewer supports event models defined in either the `.emj` format (Event Model JSON) or the `.emy` format (Event Model YAML) — same schema, just a different encoding on disk. When creating a new file you choose which one to use; opening/saving always keeps the file in the format it's already in (see [`CONTEXT.md`](CONTEXT.md) for the full glossary). The structure is:


### Building Blocks
- **Trigger** - What initiates a use case (user, automation, external system)
- **Command** - Intention to change system state
- **Event** - Business fact that occurred
- **View** - Current state projection from events

### Patterns
- **Command Pattern** - Trigger → Command → Event(s)
- **View Pattern** - Event(s) → View
- **Automation Pattern** - Event(s) → View → Automated Trigger → Command → Event(s)
- **Translation Pattern** - External Event(s) → View → Automated Trigger → Command → Event(s)

### Example Structure
```json
{
  "title": "Shopping Cart",
  "slices": [
    {
      "name": "Add item",
      "trigger": { "role": "User", "type": "input-ui" },
      "command": {
        "name": "Add item",
        "properties": [...],
        "events": [...]
      },
      "events": [...],
      "tests": [...]
    }
  ]
}
```

See `em.emj` (or its equivalent `em.emy`) for a complete example.

## EMJ/EMY format specification

The full field-by-field reference for the `.emj`/`.emy` schema has moved to [`viewer/docs/rules/format.md`](viewer/docs/rules/format.md) — it's also available in-app via the **?** help button.

## Features

### 📝 Code Editor (JSON or YAML)
- **Format-aware editing** - Shows raw JSON for `.emj` files or raw YAML for `.emy` files
- **Collapsable objects and arrays** - Navigate large event model files easily
- **Smart labels** - See property names and item counts when collapsed
- **Live editing** - Changes update the diagram in real-time
- **Syntax highlighting** - Clear visual distinction
- **Collapse to top level / Expand next level** - Navigate nested objects and arrays progressively

### 🌳 Tree editor (NEW)
- **Hierarchical visualization** - See the event model structure as a tree (regardless of whether the file is `.emj` or `.emy`)
- **Drag-and-drop reordering** - Move items by dragging between elements
- **Context menu for parent items** - Right-click on objects/arrays (not leaf values) to copy or delete
- **Inline editing** - Double-click on leaf values to edit them in place
- **Copy with _copy suffix** - Duplicate items instantly with smart naming
- **Delete with confirmation** - Safely remove items with confirmation dialog
- **Meaningful badges** - Shows property names and types clearly
- **Collapse to top level / Expand next level** - Individual controls stay local; global controls navigate progressively
- **Real-time sync** - Changes update the code editor and diagram instantly
- **Visual feedback** - Green/red indicators for valid/invalid drops

### ⏪ History & Undo/Redo (NEW)
- **Unified history** - Tracks changes from both code and tree view
- **Undo/Redo buttons** - Available in both toolbars
- **Keyboard shortcuts** - Ctrl+Z (undo), Ctrl+Y (redo)
- **Smart tracking** - Debounced for code editor, immediate for tree actions
- **50 state limit** - Prevents memory bloat
- **Button states** - Disabled when undo/redo not available
- **Tooltips** - All buttons have helpful hints
- **Session history** - Clears on file upload

### ➕ Add Slice Button (NEW)
- **Quick slice creation** - Add new slices with one click
- **Context menu** - Choose between Full slice or Event-only slice
- **Full slice template** - Complete structure with trigger, command, view, events, and tests
- **Event-only template** - Minimal slice with just events
- **Auto-placement** - New slices added to end of slices array
- **Smart defaults** - Placeholder values guide editing
- **Undo/redo support** - New slices tracked in history
- **Available in both views** - Works in code and tree view toolbars

### 📊 Diagram Viewer
- **Real-time rendering** - See changes instantly
- **Event Model visualization** - Purpose-built for event modeling
- **Zoom and pan** - Navigate large diagrams
- **Per-file presentation state** - Remembers filter visibility, zoom, and diagram position across file switches and browser reloads
- **Error messages** - Helpful feedback for invalid JSON

Presentation state is stored locally in the browser. The Server-based Viewer distinguishes files by server root and relative path; the Standalone Viewer uses the filename and extension, so files with the same filename (including extension) share presentation state. New files use the default filters and Fit Zoom. Editor/viewer panel layout remains shared across files.

## Quick Start

1. **Open the viewer**
   ```bash
   # Open in your default browser
   start event-model-viewer.html
   ```
   *Or use server mode for integrated file access — see [Server Mode](#usage) above.*

2. **Load an event model**
   - Click "Open"
   - Select `em.emj` or `em.emy` (examples included)
   - Or paste JSON/YAML directly into the editor

3. **Navigate the event model**
   
   **Code editor:**
   - Click ▼ to collapse sections
   - Click ▶ to expand one level at a time
   - Use "Collapse to top level" / "Expand next level" buttons
   - Use ↶/↷ buttons or Ctrl+Z/Ctrl+Y to undo/redo changes
   
   **Tree editor:**
   - Click the "Tree" tab to switch to the tree editor
   - Drag boxes to reorder items
   - **Double-click leaf values** (strings, numbers, booleans, null) to edit them
   - Press Enter to save, Escape to cancel editing
   - Right-click on parent items (objects/arrays with ⋮ indicator) to show context menu
   - Select "Copy" to duplicate an item (adds _copy suffix)
   - Select "Delete" to remove an item (with confirmation)
   - Note: Context menu only works on parent items, not leaf values
   - Click ▶/▼ to collapse a node or expand its direct children
   - Use "Collapse to top level" / "Expand next level" to navigate the whole tree progressively
   - Drop between items (green line = valid drop)

## Technology Stack

- **HTML5** - Structure
- **CSS3** - Styling with gradients and animations
- **JavaScript (ES6+)** - Logic and interactivity
- **No build tools** - Just open and run!

## Browser Support

Works in all modern browsers:
- ✅ Chrome 120+
- ✅ Firefox 121+
- ✅ Edge 120+
- ✅ Safari 17+

## License

MIT
