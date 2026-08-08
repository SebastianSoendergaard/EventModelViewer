# Collapse Feature Quick Reference

## For Developers

### Key Functions

#### `parseJsonToLines(json)`
Converts JSON object to array of line objects with metadata.

```javascript
const lines = parseJsonToLines({ trigger: { role: "User" } });
// Returns array of line objects with:
// - text: the actual line text
// - isCollapsible: true if can be collapsed
// - hasObjectValue: true if line has "prop": {
// - hasArrayValue: true if line has "prop": [
```

#### `findMatchingBracket(lines, startIndex)`
Finds the closing bracket for a collapsible line.

```javascript
const endIndex = findMatchingBracket(lines, 5);
// Returns index of line with matching closing bracket
```

#### `getCollapsedLabel(lines, startIndex, endIndex)`
Extracts meaningful label for collapsed view.

```javascript
const label = getCollapsedLabel(lines, 5, 12);
// Returns: "trigger" or "Add item" or "properties (3 items)"
```

### Detection Patterns

| Pattern | Regex | Example |
|---------|-------|---------|
| Property + Object | `/["']\s*:\s*\{/` | `"trigger": {` |
| Property + Array | `/["']\s*:\s*\[/` | `"events": [` |
| Property Name | `/["']([^"']+)["']\s*:\s*[\{\[]/` | Extract "trigger" |
| Name Property | `/["']name["']\s*:\s*["']([^"']+)["']/` | Extract "Add item" |

### How Collapse Works

```
1. User uploads JSON
   ↓
2. parseJsonToLines() - Marks collapsible lines
   ↓
3. renderCodeEditor() - Creates HTML with ▼ icons
   ↓
4. User clicks toggle
   ↓
5. Add/remove line index from collapsedLines Set
   ↓
6. findMatchingBracket() - Find what to hide
   ↓
7. getCollapsedLabel() - Get label to show
   ↓
8. Re-render with ... label
```

## For Users

### Keyboard Shortcuts (Future)
- `Ctrl/Cmd + [` - Collapse current section
- `Ctrl/Cmd + ]` - Expand current section
- `Ctrl/Cmd + Shift + [` - Collapse all
- `Ctrl/Cmd + Shift + ]` - Expand all

### Current Features
- ▶ Click to expand
- ▼ Click to collapse
- "Collapse All" button in toolbar
- Smart labels show property names
- Array counts displayed
- Nested collapse/expand

### What Can Be Collapsed?
✅ All objects: `{ ... }`
✅ All arrays: `[ ... ]`
✅ All properties with objects: `"trigger": { ... }`
✅ All properties with arrays: `"events": [ ... ]`

### What's Shown When Collapsed?
1. Property name (e.g., "trigger", "events")
2. Name from inside (e.g., "Add item", "Cart created")
3. Array item count (e.g., "properties (7 items)")
4. Line count (e.g., "15 lines")

## Testing

### Quick Test
```javascript
// In browser console after loading index.html
const json = { trigger: { role: "User" }, events: [] };
const lines = parseJsonToLines(json);
console.log(lines.filter(l => l.isCollapsible));
// Should show 2-3 collapsible lines
```

### Run Full Test Suite
```bash
cd tests
start collapse-functionality.test.html
```

## Common Issues

### Issue: Property not collapsible
**Check:** Does it have a value on the same line?
```javascript
// ✅ Collapsible
"trigger": {

// ❌ Not collapsible (bracket on next line)
"trigger":
{
```

### Issue: Wrong bracket matched
**Check:** Are there nested structures confusing the counter?
- Use character-by-character counting, not `includes()`
- Track depth properly

### Issue: Label not showing
**Check:** Label extraction priorities
1. Property name first
2. "name" property second
3. Fallback to line count

## Performance Notes

- ✅ Fast for files < 5,000 lines
- ⚠️ Slower for files 5,000-10,000 lines
- ❌ May freeze for files > 10,000 lines

**Optimization ideas:**
- Virtual scrolling for large files
- Memoize bracket matching results
- Lazy render collapsed sections

## Examples from em.json

```json
{
  "title": "Understanding Eventsourcing - Cart",    // Not collapsible (string value)
  "slices": [                                       // ✅ Collapsible → "slices (7 items)"
    {                                               // ✅ Collapsible → "Add item" (from name)
      "id": "1",                                    // Not collapsible
      "name": "Add item",                          // Not collapsible
      "trigger": {                                  // ✅ Collapsible → "trigger"
        "role": "User",                            // Not collapsible
        "type": "input-ui"                         // Not collapsible
      },
      "command": {                                  // ✅ Collapsible → "command"
        "name": "Add item",                        // Not collapsible
        "properties": [                             // ✅ Collapsible → "properties (7 items)"
          {                                         // ✅ Collapsible → "CartId" (from name)
            "name": "CartId",                      // Not collapsible
            "type": "Guid"                          // Not collapsible
          }
        ],
        "events": [                                 // ✅ Collapsible → "events (2 items)"
          {                                         // ✅ Collapsible → "Cart created"
            "name": "Cart created"                 // Not collapsible
          }
        ]
      }
    }
  ]
}
```

## Files Modified

- `index.html` (lines 879-1100)
  - `parseJsonToLines()`
  - `findMatchingBracket()`
  - `getCollapsedLabel()`

## Related Documentation

- [Detailed Learnings](collapse-feature-learnings.md)
- [Test Suite](../tests/collapse-functionality.test.html)
- [Test Documentation](../tests/README.md)

---

*Quick reference for Event Model Viewer collapse functionality*
*Last updated: 2026-02-10*
