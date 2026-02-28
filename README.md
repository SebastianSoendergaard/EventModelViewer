# Event Model Viewer

A web-based application for visualizing event-driven architecture models using Event Modeling defined in a JSON format. Features an interactive JSON editor with collapsable objects, a drag-and-drop tree view, and a diagram viewer.

## Usage

On build the file **event-model-viewer.html** is created as a single file application. The file can easily be commited to your git repository together with the event model json files. This way the viewer lives next to the event model and can be used by anyone. 

By having the viewer as a single file application next to the diagram json files, you will always have a viewer that can handle your diagrams without the fear for compatibility issues or version mismatches. The viewer can be used for any event model defined in the supported json format, making it a versatile tool for visualizing and sharing event-driven architecture models.

To see a diagram simply open **event-model-viewer.html** in a web browser and load the json file. You can then edit the json file in the code view or tree view and see the changes reflected in the diagram in real-time. After edits the updated diagram can be saved back to a json file or exported as an image.

## Event Model Format

The viewer supports event models defined with:

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

See `em.json` for a complete example.

## Diagram JSON specification

```
title: the title of the work flow
slices: list of slices on the diagram
  slice: a single slice
    name: name of the slice
    border: color to mark a slice and its state (e.g. black=>todo, red=>in progress, green=>done)
    trigger: something that triggers actions in the flow 
      name: name of the trigger that initiates an action
      type: type of the trigger e.g. ui or automation
      swimlane: name of the swimlane (role/person/system) the trigger belongs to, if not defined it will be put in a default swimlane 
      buttons: list of buttons to show on ui trigger
      views: list of dependencies of views (id of view if defined, else name of view) 
    command: a command
      name: name of the command
      id: unique id of a command, can be used for reference on name clashes, if not defined fallback to name property
      properties: list of properties for the command
        name: name of a command property
        type: type of a command property
      events: list of references to events (id of event if defined, else name of event) 
    view: a view
      name: name of the view
      id: unique id of a view, can be used for reference on name clashes, if not defined fallback to name property
      properties: list of properties for the view
        name: name of a view property
        type: type of a view property
      events: list of dependencies of events (id of event if defined, else name of event) 
    events: list of events 
      name: name of an event
      id: unique id of an event, can be used for reference on name clashes, if not defined fallback to name property
      swimlane: name of the swimlane (aggregate/module/system) the event belongs to, if not defined it will be put in a default swimlane
      external: true if the event is external
      properties: list of properties for the event
        name: name of an event property
        type: type of an event property
    tests: list of test cases for the slice
      name: name of the test case
      given: list of preconditional events
        name: name of the event
        properties: list of properties for the event
          name: name of an event property
          value: value of an event property
      when: the action 
        name: name of the command
        properties: list of properties for the command
          name: name of a command property
          value: value of a command property
      then: list of resulting events or views
        name: name of the event or view
        properties: list of properties for the event or view
          name: name of an event or view property
          value: value of an event or view property
```

## Features

### 📝 JSON Editor (Code View)
- **Collapsable objects and arrays** - Navigate large JSON files easily
- **Smart labels** - See property names and item counts when collapsed
- **Live editing** - Changes update the diagram in real-time
- **Syntax highlighting** - Clear visual distinction
- **Collapse/Expand All** - Quick navigation controls

### 🌳 Tree View (NEW)
- **Hierarchical visualization** - See JSON structure as a tree
- **Drag-and-drop reordering** - Move items by dragging between elements
- **Context menu for parent items** - Right-click on objects/arrays (not leaf values) to copy or delete
- **Inline editing** - Double-click on leaf values to edit them in place
- **Copy with _copy suffix** - Duplicate items instantly with smart naming
- **Delete with confirmation** - Safely remove items with confirmation dialog
- **Meaningful badges** - Shows property names and types clearly
- **Collapse/Expand** - Individual and global controls
- **Real-time sync** - Changes update code view and diagram instantly
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
- **Error messages** - Helpful feedback for invalid JSON

## Quick Start

1. **Open the viewer**
   ```bash
   # Open in your default browser
   start index.html
   ```

2. **Load an event model**
   - Click "Open"
   - Select `em.json` (example included)
   - Or paste JSON directly into the editor

3. **Navigate the JSON**
   
   **Code View:**
   - Click ▼ to collapse sections
   - Click ▶ to expand sections
   - Use "Collapse All" / "Expand All" buttons
   - Use ↶/↷ buttons or Ctrl+Z/Ctrl+Y to undo/redo changes
   
   **Tree View:**
   - Click "Tree" tab to switch views
   - Drag boxes to reorder items
   - **Double-click leaf values** (strings, numbers, booleans, null) to edit them
   - Press Enter to save, Escape to cancel editing
   - Right-click on parent items (objects/arrays with ⋮ indicator) to show context menu
   - Select "Copy" to duplicate an item (adds _copy suffix)
   - Select "Delete" to remove an item (with confirmation)
   - Note: Context menu only works on parent items, not leaf values
   - Click ▶/▼ to collapse/expand nodes
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

