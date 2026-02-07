# Event Model Viewer - Instructions

## Overview
Event Model Viewer is a web-based application that visualizes event-driven architecture models defined in JSON format. It provides an interactive interface with a JSON editor and a diagram viewer using Mermaid.js.

### Event Modeling
The viewer can edit and present Event Model diagrams as defined Adam Dymitruk and Martin Dilger. E.g. on https://eventmodeling.org/ and https://leanpub.com/eventmodeling-and-eventsourcing

#### Building blocks
- Trigger - What ’triggers’ a use case? It can be a user via a UI, some external software or an automated process.
- Command - Intention to change the state of the system
- Event - A business fact that has happened based on the command
- View - A current state based on one or more events

#### Patterns
- Command Pattern - Trigger -> Command -> Event(s)
- View Pattern - Event(s) -> View
- Automation Pattern - Event(s) -> View -> Automated Trigger -> Command -> Event(s)
- Translation Pattern - Event(s) (source system) -> View -> Automated Trigger -> Command -> Event(s) (other systems)

## Project Structure

```
EventModelViewer/
├── index.html          # Main application (single-page app)
└── em.json            # Example event model JSON file
```

## Features

### 1. **JSON File Upload**
- Click "Choose JSON File" to load a JSON file
- Accepts `.json` files only
- Displays selected filename
- Automatically populates the editor and renders the diagram

### 2. **JSON Editor Panel**
- Live JSON editor with syntax highlighting
- Auto-formatting with 2-space indentation
- Debounced auto-refresh (1 second delay after typing stops)
- Collapsible panel (click ◀/▶ button to toggle)
- When collapsed, takes up minimal space (40px width)

### 3. **Diagram Viewer**
- Real-time diagram rendering
- Supports Event Modeling visualization
- Displays helpful error messages for invalid JSON
- Centered and scrollable display area

## Supported JSON Formats

### Event Model Structure (em.json)
The included `em.json` demonstrates a domain-driven design event model with:
- **Slices**: Logical groupings of functionality
- **Triggers**: UI interactions (buttons, lists)
- **Commands**: Actions with properties
- **Events**: Domain events with properties
- **Views**: Read models/projections
- **Tests**: Given-When-Then test specifications

**Note**: The current implementation uses a generic converter. To visualize the event model format properly, the `convertJsonToMermaid()` function needs to be customized.

## How to Use

### Basic Usage
1. Open `index.html` in a web browser
2. Upload a JSON file or paste JSON directly into the editor
3. View the generated diagram in real-time

### Editing JSON
1. Type or paste JSON into the editor panel
2. Wait 1 second after stopping typing
3. The diagram updates automatically if JSON is valid
4. Invalid JSON won't show errors while typing (better UX)

### Collapsing the Editor
1. Click the ◀ button in the editor panel header
2. Editor collapses to 40px width
3. Click ▶ to expand again
4. Useful for focusing on the diagram

## Customization

### Modifying Diagram Generation
The `convertJsonToMermaid()` function (lines 288-332) converts JSON to Mermaid syntax. To support custom JSON structures:

1. Add a new condition for your structure type
2. Generate appropriate Mermaid code
3. Return the Mermaid string

Example:
```javascript
if (data.type === 'myCustomType') {
    let mermaidCode = 'graph TD\n';
    // Add your custom conversion logic
    return mermaidCode;
}
```

### Styling
All styles are embedded in the `<style>` section (lines 8-181). Key CSS classes:
- `.editor-panel`: Left panel with JSON editor
- `.diagram-panel`: Right panel with diagram
- `.collapsed`: State when editor is hidden
- `.error-message`: Error display styling

### Mermaid Configuration
Mermaid settings (lines 221-225):
```javascript
mermaid.initialize({ 
    startOnLoad: false,
    theme: 'default',        // Change theme: 'default', 'dark', 'forest', 'neutral'
    securityLevel: 'loose'
});
```

## Dependencies

- **Mermaid.js v10**: Loaded from CDN
  ```html
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
  ```

## Browser Compatibility

Works in all modern browsers that support:
- ES6 JavaScript
- FileReader API
- CSS Flexbox
- Mermaid.js

Tested on: Chrome, Firefox, Edge, Safari

## Event Model (em.json) Structure Explanation

The included event model represents a shopping cart domain:

### Slices
- **Add item** (slice 1): Handles adding items to cart
  - Trigger: UI with a button
  - Command: Add item (CartId, Description, Price)
  - Events: Cart created, Item added
  - Tests: Given-When-Then scenarios including error cases

- **Cart items** (slice 2): Displays cart contents
  - Trigger: UI with a list of items
  - View: Cart items projection
  - Tests: Validation scenarios

### Key Concepts
- **Triggers**: How users interact (buttons, lists)
- **Commands**: Write operations
- **Events**: Facts that occurred
- **Views**: Read models built from events
- **Tests**: Behavioral specifications

## Future Enhancements

To fully support the event model format:
1. Create a specialized converter for slices/commands/events
2. Generate sequence diagrams or state machines
3. Add interactive features (click nodes for details)
4. Support multiple diagram types
5. Add export functionality (PNG, SVG)

## Troubleshooting

**Diagram not showing:**
- Check browser console for errors
- Ensure JSON is valid
- Verify Mermaid CDN is accessible

**Upload not working:**
- Ensure file has `.json` extension
- Check file contains valid JSON
- Try pasting JSON directly into editor

**Auto-refresh not working:**
- Wait 1 second after typing stops
- Ensure JSON is syntactically valid
- Check browser console for errors

## Development Notes

- Single HTML file for easy deployment
- No build process required
- No backend dependencies
- Can be served from any static file server
- Works offline after initial load (once Mermaid is cached)

## License

[Add your license information here]
