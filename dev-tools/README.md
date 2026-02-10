# Event Model Viewer

An interactive web-based application for visualizing event-driven architecture models defined in JSON format. Features a JSON editor and Mermaid.js diagram viewer for Event Modeling notation.

## Features

- **JSON File Upload**: Load event model JSON files
- **Live JSON Editor**: Edit models with syntax highlighting and auto-formatting
- **Real-time Diagram**: Visualize event models with automatic rendering
- **Interactive Controls**: Zoom, pan, collapse editor, toggle features
- **Event Modeling Support**: Visualize triggers, commands, events, views, and tests
- **Collapsible Panels**: Maximize diagram space when needed
- **Toggle Options**: Show/hide slice borders, tests, and type information

## Quick Start

1. Open `index.html` in a web browser
2. Click "Choose JSON File" to load an event model
3. View the generated diagram on the right panel
4. Edit JSON in the left panel to see live updates

## Development

### Running Tests

```bash
# Install dependencies
npm install

# Run all tests (93 tests)
npm test

# Run specific test suites
npm run test:unit           # Unit tests (55 tests)
npm run test:e2e            # E2E tests (26 tests)
npm run test:visual         # Visual regression tests (12 tests)

# Development mode
npm run test:watch          # Watch mode for TDD
```

### Test Coverage

✅ **93 tests - 100% passing**
- **Unit Tests**: 55 tests covering all logic functions
- **E2E Tests**: 26 tests for user workflows
- **Visual Tests**: 12 tests for visual consistency

See [TEST_SUITE_SUMMARY.md](TEST_SUITE_SUMMARY.md) for details.

### Project Structure

```
EventModelViewer/
├── index.html              # Main application (single-page app)
├── em.json                 # Example event model
├── tests/                  # Comprehensive test suite
│   ├── unit/              # Unit tests (Vitest + happy-dom)
│   ├── e2e/               # E2E tests (Playwright)
│   ├── visual/            # Visual regression tests
│   ├── fixtures/          # Test data files
│   └── helpers/           # Test utilities
├── package.json           # Dependencies and scripts
├── vitest.config.js       # Unit test configuration
└── playwright.config.js   # E2E test configuration
```

## Event Model JSON Format

The viewer supports Event Modeling notation with the following structure:

```json
{
  "title": "Model Name",
  "slices": [
    {
      "id": "1",
      "name": "Slice Name",
      "border": "#4CBB17",
      "trigger": {
        "role": "User",
        "type": "input-ui",
        "buttons": ["Button Name"]
      },
      "command": {
        "name": "Command Name",
        "properties": [
          {"name": "PropertyName", "type": "PropertyType"}
        ],
        "events": [
          {
            "name": "Event Name",
            "properties": [...]
          }
        ]
      },
      "view": {
        "name": "View Name",
        "events": ["Event Name"],
        "properties": [...]
      },
      "tests": [
        {
          "given": ["Precondition"],
          "when": "Action",
          "then": ["Expected Result"]
        }
      ]
    }
  ]
}
```

## Event Modeling Concepts

### Building Blocks
- **Trigger**: What initiates a use case (UI, external system, automation)
- **Command**: Intention to change system state
- **Event**: Business fact that occurred
- **View**: Current state projection from events

### Patterns
- **Command Pattern**: Trigger → Command → Event(s)
- **View Pattern**: Event(s) → View
- **Automation Pattern**: Event(s) → View → Automated Trigger → Command → Event(s)
- **Translation Pattern**: Event(s) → View → Trigger → Command → Event(s) (cross-system)

### Swimlanes
Horizontal groupings that cross all slices, forming a matrix with slices as columns.

## Browser Compatibility

Works in all modern browsers supporting:
- ES6 JavaScript
- FileReader API
- CSS Flexbox
- Mermaid.js

Tested on: Chrome, Firefox, Edge, Safari

## Dependencies

- **Mermaid.js v10**: Diagram rendering (loaded from CDN)
- **Development**: Vitest, Playwright, happy-dom, jsdom (test frameworks)

## Security

- ✅ XSS prevention via `escapeHtml()` function
- ✅ HTML escaping for all user input
- ✅ Validated with 10+ security-focused tests

## Contributing

### Adding Features (TDD Approach)

1. **Write tests first**:
   ```bash
   npm run test:watch
   ```

2. **Create test file**:
   ```javascript
   // tests/unit/my-feature.test.js
   import { describe, it, expect } from 'vitest';

   describe('My Feature', () => {
     it('should do something', () => {
       // Test implementation
     });
   });
   ```

3. **Implement feature** until tests pass

4. **Verify all tests**:
   ```bash
   npm test
   ```

5. **Commit**:
   ```bash
   git add .
   git commit -m "Add feature with tests"
   ```

See [tests/README.md](tests/README.md) for detailed testing guide.

## Customization

### Modifying Diagram Generation

Edit the `convertJsonToMermaid()` or `generateEventModelDiagram()` functions in `index.html` to customize how models are rendered.

### Styling

All styles are embedded in `index.html`. Key CSS classes:
- `.editor-panel`: Left panel with JSON editor
- `.diagram-panel`: Right panel with diagram
- `.event-model-diagram`: Diagram container
- `.slice`: Individual slice in the model

### Mermaid Configuration

```javascript
mermaid.initialize({ 
    startOnLoad: false,
    theme: 'default',  // Options: 'default', 'dark', 'forest', 'neutral'
    securityLevel: 'loose'
});
```

## Troubleshooting

**Diagram not showing:**
- Check browser console for errors
- Ensure JSON is valid
- Verify Mermaid CDN is accessible

**Tests failing:**
- Run `npm install` to ensure dependencies are installed
- For Playwright: `npx playwright install chromium`

**Visual tests show differences:**
- Update baselines after intentional design changes:
  ```bash
  npx playwright test tests/visual --update-snapshots
  ```

## License

[Add your license information here]

## References

- [Event Modeling](https://eventmodeling.org/) - Event Modeling methodology
- [Mermaid.js](https://mermaid.js.org/) - Diagram rendering library
- [Vitest](https://vitest.dev/) - Unit test framework
- [Playwright](https://playwright.dev/) - E2E test framework

---

**Test Status**: ✅ 93 tests passing | **Coverage**: Logic, Visual, E2E | **Security**: XSS Protected
