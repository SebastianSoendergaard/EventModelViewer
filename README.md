# Event Model Viewer

A web-based application for visualizing event-driven architecture models using Event Medeling defined in JSON format. Features an interactive JSON editor with collapsible objects, a drag-and-drop tree view, and a diagram viewer using Mermaid.js.

## Diagram JSON specification

```
title: the title of the work flow
slices: list of slices on the diagram
  slice: a single slice
    name: name of the slice
    border: color to mark a slice and its state (e.g. black=>todo, red=>in progress, green=>done)
    trigger: something that triggers actions in the flow  
      role: name of the role/person/system that initiates an action
      type: type of the trigger e.g. ui or automation
      buttons: list of buttons to show on ui trigger
    command: a command
      name: name of the command
      properties: list of properties for the command
        name: name of a command property
        type: type of a command property
      events: list of references to events (id of event if it exists else name) 
    view: a view
      name: name of the view
      properties: list of properties for the view
        name: name of a view property
        type: type of a view property
      events: list of references to events (id of event if it exists else name) 
    events: list of events 
      id: unique id of an event, can be used for reference on name clashes, if not defined fallback to name property
      name: name of an event
      external: true if the event is external
      properties: list of properties for the event
        name: name of an event property
        type: type of an event property
    tests: list of test cases for the slice
      name: name of the test case
      given: list of preconditional events
        name: id or name of the event
        properties: list of properties for the event
          name: name of an event property
          value: value of an event property
      when:  
        name: name of the command
        properties: list of properties for the command
          name: name of a command property
          value: value of a command property
      then: list of resulting events
        name: id or name of the event
        properties: list of properties for the event
          name: name of an event property
          value: value of an event property
```


## Features

### 📝 JSON Editor (Code View)
- **Collapsible objects and arrays** - Navigate large JSON files easily
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

### 🎯 Event Modeling Support
Visualizes Event Modeling patterns:
- Slices (bounded contexts)
- Triggers (UI, automation)
- Commands (write operations)
- Events (business facts)
- Views (read models)
- Tests (given-when-then)

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

## Project Structure

```
EventModelViewer/
├── index.html              # Main application (single-page app)
├── em.json                 # Example event model
├── em-schema.json          # JSON schema definition
├── docs/                   # Documentation
│   ├── README.md           # Documentation index
│   ├── collapse-feature-learnings.md
│   └── collapse-quick-reference.md
├── tests/                  # Test suite
│   ├── README.md           # Test documentation
│   └── collapse-functionality.test.html
└── dev-tools/              # Development utilities
```

## Documentation

### For Users
- 📖 **Quick Reference** - [docs/collapse-quick-reference.md](docs/collapse-quick-reference.md)
  - How to use collapse feature
  - What can be collapsed
  - Tips and tricks

### For Developers
- 🔍 **Detailed Learnings** - [docs/collapse-feature-learnings.md](docs/collapse-feature-learnings.md)
  - Implementation details
  - Technical decisions
  - Performance considerations
  - Lessons learned

- 🧪 **Test Suite** - [tests/README.md](tests/README.md)
  - How to run tests
  - Test coverage
  - Adding new tests

## Testing

Run the comprehensive test suite:

```bash
cd tests
start collapse-functionality.test.html
```

**Test Coverage:**
- ✅ 29+ automated tests
- ✅ 100% pass rate
- ✅ Covers all collapse functionality
- ✅ Edge cases and real-world scenarios

See [tests/README.md](tests/README.md) for details.

## Technology Stack

- **HTML5** - Structure
- **CSS3** - Styling with gradients and animations
- **JavaScript (ES6+)** - Logic and interactivity
- **Mermaid.js** - Diagram rendering
- **No build tools** - Just open and run!

## Browser Support

Works in all modern browsers:
- ✅ Chrome 120+
- ✅ Firefox 121+
- ✅ Edge 120+
- ✅ Safari 17+

## Recent Updates

### 2026-02-13: Add Slice Button
- ✨ Quick slice creation with + button in both toolbars
- ✨ Context menu with two template options
- ✨ Full slice template (trigger, command, view, events, tests)
- ✨ Event-only slice template for minimal structures
- 📝 Added comprehensive documentation
- 🔄 Full integration with undo/redo and persistence

### 2026-02-10: Enhanced Collapse Functionality
- ✨ All objects and arrays now collapsible (not just standalone brackets)
- ✨ Smart labels show property names and item counts
- ✨ Improved bracket matching for nested structures
- 📝 Comprehensive documentation added
- 🧪 Full test suite with 29+ tests

See [docs/collapse-feature-learnings.md](docs/collapse-feature-learnings.md) for technical details.

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
- **Automation Pattern** - Event(s) → View → Trigger → Command
- **Translation Pattern** - Event(s) → View → Trigger → Command (cross-system)

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
      "tests": [...]
    }
  ]
}
```

See `em.json` for a complete example.

## Contributing

### Adding Features
1. Implement the feature
2. Add tests to `tests/`
3. Document learnings in `docs/`
4. Update this README

### Documentation Standards
- Use Markdown format
- Include code examples
- Explain trade-offs
- Add references

See [docs/README.md](docs/README.md) for templates.

## Customization

### Modifying Diagram Generation
Edit the `convertJsonToMermaid()` function in `index.html` to support custom JSON structures.

### Styling
All styles are in the `<style>` section of `index.html`. Key classes:
- `.editor-panel` - Left panel
- `.diagram-panel` - Right panel
- `.code-line` - Individual editor lines
- `.line-toggle` - Collapse/expand icons

### Mermaid Configuration
```javascript
mermaid.initialize({ 
    startOnLoad: false,
    theme: 'default',  // 'default', 'dark', 'forest', 'neutral'
    securityLevel: 'loose'
});
```

## Troubleshooting

**Diagram not showing?**
- Check browser console for errors
- Ensure JSON is valid
- Verify Mermaid CDN is accessible

**Collapse not working?**
- Load a JSON file first
- Check that properties have objects/arrays on same line
- See [docs/collapse-quick-reference.md](docs/collapse-quick-reference.md)

**Performance issues?**
- Files over 5,000 lines may be slow
- Use "Collapse All" to reduce rendering
- Consider splitting large JSON files

## Roadmap

### Planned Features
- [ ] Persist collapse state (localStorage)
- [ ] Keyboard navigation
- [ ] Syntax highlighting
- [ ] Line numbers
- [ ] Export diagrams (PNG, SVG)
- [ ] Multiple diagram types
- [ ] Dark mode
- [ ] Custom themes

See individual doc files for more enhancement ideas.

## License

[Add your license here]

## Resources

### Event Modeling
- [Event Modeling Official Site](https://eventmodeling.org/)
- [Event Modeling Book by Adam Dymitruk & Martin Dilger](https://leanpub.com/eventmodeling-and-eventsourcing)

### Technical References
- [Mermaid.js Documentation](https://mermaid.js.org/)
- [MDN Web Docs](https://developer.mozilla.org/)

---

**Version:** 2.0  
**Last Updated:** 2026-02-10  
**Maintainer:** [Your name/team]
