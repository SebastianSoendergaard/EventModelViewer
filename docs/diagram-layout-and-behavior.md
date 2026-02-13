# Event Model Viewer - Diagram Layout and Behavior

This document provides comprehensive learnings about how the swimlane-based diagram layout is structured and how it behaves at runtime.

## Table of Contents
- [Overview](#overview)
- [Layout Model](#layout-model)
- [Swimlane Discovery](#swimlane-discovery)
- [Grid Structure](#grid-structure)
- [Element Placement](#element-placement)
- [Slice Borders](#slice-borders)
- [Toggle Behavior](#toggle-behavior)
- [Arrow Logic](#arrow-logic)
- [Styling Decisions](#styling-decisions)
- [Rendering Flow](#rendering-flow)
- [Key CSS Classes](#key-css-classes)

## Overview

The Event Model Viewer uses a CSS Grid-based layout to display event modeling diagrams with horizontal swimlanes. This replaced the previous vertical slice-based layout to better match Event Modeling methodology where:
- **Vertical slices** represent temporal sequence (time flows left to right)
- **Horizontal swimlanes** represent domain context (roles for triggers, systems for events)

## Layout Model

### Core Structure
- **CSS Grid** (`swimlane-grid`) instead of flexbox columns
- **Columns** represent slices (time-ordered use cases)
- **Rows** represent swimlanes organized by:
  - Trigger roles (User, Bot, etc.)
  - Commands/Views (single shared row)
  - Event systems (Internal, External system, etc.)
  - Tests (bottom row)

### Grid Configuration
```css
.swimlane-grid {
    display: inline-grid;
    row-gap: 0;
    column-gap: 40px;           /* Space between slices */
    position: relative;
    min-width: 100%;
    width: max-content;          /* Expands to fit content */
}
```

**Key characteristics:**
- `inline-grid` allows the grid to size to content width
- `column-gap: 40px` provides visual separation between slices
- `width: max-content` ensures slices expand to accommodate side-by-side events
- No row-gap to keep swimlanes visually connected

## Swimlane Discovery

### Trigger Lanes (by role)
Discovery order determines lane sequence:

1. **Automation triggers first** (`type === 'automation'`)
   - Ordered by first appearance in slices array
2. **Other roles next** 
   - Ordered by first appearance
3. **No-role triggers last** (when `trigger.role` is empty/missing)

### Event Lanes (by system/external)
Discovery order:

1. **No-system events first** (when `event.system` is empty/missing)
2. **Unique system values** (ordered by first appearance)
3. **External events last** (`event.external === true`)

### Manual Styling Adjustments

**Empty labels for cleaner appearance:**
- No-system event lane: label changed to empty string `''`
- No-role trigger lane: label changed to empty string `''`
- Commands/Views lane: label changed to empty string `''`

**Rationale:** These labels are implied by the content, so removing text reduces visual clutter while maintaining the lane structure.

**Lane header transparency:**
- Removed `border-right: 2px solid #dee2e6` from `.lane-header`
- Changed background to `transparent` (from `#f8f9fa`)
- This creates a cleaner, less boxy appearance

### Swimlanes Toggle Behavior
When **"Show swimlanes" is OFF:**
```javascript
discoverSwimlanes(data, false)
// Returns:
{
  triggerLanes: [{ type: 'all', label: 'All Triggers' }],
  eventLanes: [{ type: 'all', label: 'All Events' }]
}
```
- All triggers collapse into a single lane
- All events collapse into a single lane
- Role/system properties are effectively ignored
- Vertical slice structure remains intact

## Grid Structure

### Row Numbering
```
Row 1:     Slice headers
Row 2..N:  Trigger lanes (one per unique role)
Row N+1:   Commands/Views (single row)
Row N+2..: Event lanes (one per unique system)
Row LAST:  Tests
```

**Critical implementation detail:**
```javascript
let currentRow = 2; // Row 1 reserved for headers, lanes start at 2
```

This fixes the "off-by-one" issue where triggers were overlapping with headers.

### Column Sizing
```javascript
const gridTemplateColumns = showSwimlanes 
    ? `120px repeat(${numSlices}, minmax(240px, max-content))`
    : `repeat(${numSlices}, minmax(240px, max-content))`;
```

- **120px**: Fixed width for lane header column (when swimlanes enabled)
- **minmax(240px, max-content)**: Each slice column
  - Minimum 240px prevents cramping
  - `max-content` allows expansion for wide content (side-by-side events)

## Element Placement

### Cell Alignment
**All grid cells align to top:**
```css
.grid-cell {
    display: flex;
    flex-direction: column;
    align-items: flex-start;       /* Horizontal alignment */
    justify-content: flex-start;   /* Vertical alignment - TOP */
}
```

**Before fix:** Elements were centered (`justify-content: center`), causing inconsistent vertical positioning.

**After fix:** All elements snap to top of cells, creating clean horizontal alignment across swimlanes.

### Commands and Views Spacing
```css
.element.command,
.element.view {
    padding: 22px 26px;  /* Extra padding for breathing room */
}
```

Default element padding is `16px 20px`. Commands and views get more space because they're visually prominent and need emphasis.

### Events Horizontal Grouping

**Problem:** Events in the same slice but different lanes need to align horizontally by their order in the slice.

**Solution:**
```javascript
// Calculate total events in slice
const totalEventsInSlice = slice.events.length;

// Create grid with fixed number of columns
let eventsHtml = `<div class="events-group" style="grid-template-columns: repeat(${totalEventsInSlice}, minmax(240px, max-content));">`;

// Each event gets a specific grid column
eventsHtml += generateEvent(event, sliceIndex, eventIndex, eventIndex + 1);
```

```javascript
// In generateEvent():
const gridColumnStyle = gridColumn ? ` style="grid-column: ${gridColumn};"` : '';
```

**Result:** External "Inventory changed" (column 1) appears left of internal "Inventory changed" (column 2) even though they're in different swimlane rows.

### Tests Cell
```css
.grid-cell.test-cell {
    justify-content: flex-start;  /* Top alignment */
    align-items: stretch;          /* Full width */
}

.grid-cell .tests-container {
    width: 100%;                   /* Occupy full cell width */
}
```

Tests expand to use full cell width and align to top of the cell.

## Slice Borders

### Border Overlay Approach
Instead of applying borders to individual cells, slice borders are rendered as full-column overlays:

```javascript
data.slices.forEach((slice, sliceIndex) => {
    if (!slice.border) return;
    const colNum = showSwimlanes ? sliceIndex + 2 : sliceIndex + 1;
    const rowEnd = gridMap.testRow + 1; // Grid row end is exclusive
    html += `<div class="slice-border" style="grid-column: ${colNum}; grid-row: 1 / ${rowEnd}; border-color: ${slice.border};"></div>`;
});
```

```css
.slice-border {
    pointer-events: none;  /* Don't block clicks */
    border: 3px solid;
    border-radius: 8px;
    z-index: 2;            /* Above grid cells (z-index: 1) */
    background: transparent;
}
```

**Benefits:**
- Single element spans entire column (header to tests)
- Consistent border width across all rows
- Easy to show/hide via display toggle
- No need to coordinate borders between cells

### "Show Slices" Toggle
```javascript
function toggleSliceBorders(show) {
    const borders = document.querySelectorAll('.slice-border');
    borders.forEach(border => {
        border.style.display = show ? 'block' : 'none';
    });
}
```

The checkbox simply toggles visibility of the overlay elements.

## Toggle Behavior

### Show Swimlanes Toggle
```javascript
showSwimlanesCheckbox.addEventListener('change', () => {
    if (currentJson) {
        renderDiagram(JSON.stringify(currentJson, null, 2));
    }
});
```

**Full diagram re-render** because:
- Lane structure changes completely
- Grid template changes (adds/removes header column)
- Element placement changes (different row assignments)

### Show Slices Toggle
```javascript
toggleSliceBorders(showSlicesCheckbox.checked);
```

**Lightweight toggle** - just shows/hides border overlays without re-rendering.

### Show Tests / Show Types Toggles
```javascript
function toggleTests(show) {
    const testsContainers = document.querySelectorAll('.tests-container');
    testsContainers.forEach(container => {
        container.classList.toggle('hidden', !show);
    });
}
```

**CSS-based toggle** using `.hidden { display: none; }` class.

## Arrow Logic

### Connection Preservation
All existing arrow logic is preserved. The grid layout maintains compatibility by:
- Preserving `data-*` attributes on elements
- Keeping CSS classes (`.element`, `.trigger`, `.command`, `.view`, `.event`)
- Using `getBoundingClientRect()` for geometry (works with any layout)

### Arrow Types

#### 1. Trigger → Command
```javascript
if (trigger && command) {
    drawArrow(svg, trigger, command, diagramDiv, 'bottom', 'top');
}
```
Vertical arrow from bottom of trigger to top of command.

#### 2. Command → Events
```javascript
const commandEventNames = commandEventsAttr.split(',');
commandEventNames.forEach(eventName => {
    const matchingEvents = events.filter(event => 
        event.getAttribute('data-event-name') === eventName
    );
    // Draw arrows to matching events
});
```
- Uses `data-command-events` attribute (comma-separated event names)
- Prefers internal events (without ID) when multiple events share a name
- Backward compatible: connects to all events if no explicit list

#### 3. Event → Trigger (Automation)
```javascript
// Same-slice: vertical
if (isSameSlice) {
    drawArrow(svg, event, trigger, diagramDiv, 'top', 'bottom', isDashed);
}
// Cross-slice: horizontal
else {
    drawArrow(svg, event, trigger, diagramDiv, 'right', 'left', isDashed);
}
```
- Searches for nearest **preceding** event first
- Falls back to nearest **subsequent** event with dashed arrow
- Uses event ID if present, otherwise matches by name

#### 4. Event → View
```javascript
const selectedMatch = selectNearestPrecedingEvent(eventMatches, viewSliceIndex);
if (selectedMatch) {
    drawArrow(svg, selectedMatch.element, view, diagramDiv, 'top', 'bottom', isDashed);
}
```
Vertical arrow from event (below) to view (above).

#### 5. View → Trigger (Next Slice)
```javascript
// MANUAL CHANGE: Exit from top instead of right
drawArrow(svg, view, nextTrigger, diagramDiv, 'top', 'left');
```

**Original:** `drawArrow(svg, view, nextTrigger, diagramDiv, 'right', 'left')`  
**Updated:** Exit from **top** of view to **left** side of next trigger

**Rationale:** More intuitive flow showing the view "triggering" the next action vertically before moving horizontally.

### Arrow Geometry
```javascript
function drawArrow(svg, fromElement, toElement, container, fromSide, toSide, isDashed) {
    const fromRect = fromElement.getBoundingClientRect();
    const toRect = toElement.getBoundingClientRect();
    
    // Account for zoom and scroll
    const scale = currentZoom;
    const offsetX = (wrapperRect.left - containerRect.left) / scale;
    const offsetY = (wrapperRect.top - containerRect.top) / scale;
    
    // Calculate connection points based on sides
    // Generate Bezier curve path
}
```

**Bezier curves:**
- Vertical: `C ${startX} ${midY}, ${endX} ${midY}, ${endX} ${endY}`
- Horizontal: `C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`
- Mixed: `Q ${midX} ${midY}, ${endX} ${endY}` (quadratic)

### Grid Cell Grouping
```javascript
// Group cells by slice index
const slicesByIndex = new Map();
document.querySelectorAll('.grid-cell[data-slice-index]').forEach(cell => {
    const sliceIndex = parseInt(cell.getAttribute('data-slice-index'));
    if (!slicesByIndex.has(sliceIndex)) {
        slicesByIndex.set(sliceIndex, []);
    }
    slicesByIndex.get(sliceIndex).push(cell);
});

// Find trigger/command/view/events across all cells in a slice
slicesByIndex.forEach((cells, sliceIndex) => {
    let trigger = null, command = null, view = null;
    const events = [];
    
    cells.forEach(cell => {
        if (cell.querySelector('.element.trigger')) trigger = ...;
        if (cell.querySelector('.element.command')) command = ...;
        // etc.
    });
});
```

This allows arrow logic to work with elements spread across multiple grid cells.

## Styling Decisions

### Transparency and Clean Design
**Background colors removed:**
```css
.grid-cell {
    background: transparent;  /* Was: white */
}

.lane-header {
    background: transparent;  /* Was: #f8f9fa */
}

.grid-cell.slice-header {
    background: transparent;  /* Was: #f8f9fa */
}
```

**Removed:**
- Alternating row colors (`.grid-cell:nth-child(even)`)
- Grid cell borders in some contexts

**Result:** Cleaner, more minimal appearance that emphasizes the content over the grid structure.

### Z-Index Layering
```
z-index: 1  - Grid cells
z-index: 1  - Arrow SVG
z-index: 2  - Slice border overlays
z-index: 10 - Lane headers (sticky)
```

Ensures borders appear above cells and lane headers stay on top during scroll.

## Rendering Flow

### Complete Rendering Sequence

1. **Parse JSON** → `renderDiagram(jsonString)`

2. **Discover swimlanes** → `discoverSwimlanes(data, showSwimlanes)`
   - Scan for unique roles and systems
   - Build ordered lane arrays

3. **Build grid map** → `buildGridMap(triggerLanes, eventLanes)`
   - Assign row numbers to each lane
   - Calculate total rows

4. **Generate HTML** → `generateEventModelDiagram(data)`
   - Create grid container
   - Render slice headers (row 1)
   - Render border overlays
   - Organize elements into cell contents map
   - Render lane headers
   - Render cells with content
   - Fill empty cells

5. **Draw arrows** → `drawAllArrows()`
   - Create SVG overlay
   - Group cells by slice
   - Draw all connection types
   - Apply zoom/scroll transformations

6. **Apply toggles**
   - `toggleSliceBorders(showSlicesCheckbox.checked)`
   - `toggleTests(showTestsCheckbox.checked)`
   - `toggleTypes(showTypesCheckbox.checked)`

### Cell Contents Organization
```javascript
const cellContents = new Map(); // key: "colNum-rowNum", value: array of HTML strings
const cellMeta = new Map();     // key: "colNum-rowNum", value: { hasTests: boolean }

data.slices.forEach((slice, sliceIndex) => {
    const colNum = showSwimlanes ? sliceIndex + 2 : sliceIndex + 1;
    
    // Map trigger to its lane row
    const laneKey = getTriggerLaneKey(slice.trigger, showSwimlanes);
    const rowNum = gridMap.triggerRowMap.get(laneKey);
    const cellKey = `${colNum}-${rowNum}`;
    cellContents.get(cellKey).push(generateTrigger(...));
    
    // Map events to their lane rows
    // Map tests to test row
});
```

This approach:
- Decouples element generation from grid position
- Allows multiple elements per cell
- Simplifies rendering of sparse grids (many empty cells)

## Key CSS Classes

### Grid Structure
- `.swimlane-grid` - Main grid container
- `.swimlane-grid.swimlanes-hidden` - When swimlanes toggle is OFF
- `.lane-header` - Lane name labels (left column)
- `.lane-header.slice-header-cell` - Top-left corner cell
- `.grid-cell` - Individual grid cell
- `.grid-cell.test-cell` - Cell containing tests
- `.grid-cell.slice-header` - Top row cells (slice names)

### Element Types
- `.element` - Base class for all diagram elements
- `.element.trigger` - Trigger elements
- `.element.command` - Command elements  
- `.element.view` - View elements
- `.element.event` - Event elements
- `.element.event.external` - External events

### Grouping and Decoration
- `.events-group` - Horizontal group of events in a lane
- `.tests-container` - Wrapper for test cases
- `.slice-border` - Full-column border overlay

### Data Attributes
- `data-slice-index` - Slice number (for arrow logic)
- `data-event-name` - Event name (for matching)
- `data-event-id` - Event ID (for unique matching)
- `data-command-events` - Comma-separated event names (command → event connections)
- `data-trigger-events` - Comma-separated event names (event → trigger connections)
- `data-view-events` - Comma-separated event names (event → view connections)
- `data-slice-border-color` - Border color value

## Performance Considerations

### Grid vs Manual Positioning
**Benefits of CSS Grid:**
- Native browser layout engine (highly optimized)
- No JavaScript calculations for positioning
- Automatic content sizing with `max-content`
- Natural alignment across rows and columns

**Potential bottleneck:**
- Large diagrams (50+ slices, 20+ lanes) may slow down with full re-render
- Consider virtualization if needed (render only visible + buffer)

### Arrow Rendering
- SVG paths are efficient even with 100+ arrows
- `getBoundingClientRect()` is called per arrow (acceptable for typical diagrams)
- Debounced redraw on window resize prevents performance issues

### Toggle Performance
- Slice borders toggle: O(n) where n = number of slices (fast)
- Swimlanes toggle: Full re-render (slower but acceptable for UX)
- Tests/types toggle: O(n) DOM queries (fast)

## Common Patterns and Anti-Patterns

### ✅ DO

- Keep grid cells empty and let CSS Grid handle spacing
- Use `max-content` for dynamic column widths
- Preserve all `data-*` attributes when generating elements
- Group cells by slice index before drawing arrows
- Use overlay approach for slice borders

### ❌ DON'T

- Don't use absolute positioning within grid cells (breaks alignment)
- Don't calculate grid positions in JavaScript (use grid-column/grid-row)
- Don't rely on alternating row colors for lane identification (removed)
- Don't query `.slice` elements (use `.grid-cell[data-slice-index]`)
- Don't forget to account for swimlanes toggle when calculating column numbers

## Future Enhancements

Potential improvements not yet implemented:

1. **Lane Collapse/Expand**
   - Individual lane visibility toggles
   - Collapsed lanes could show element count badge

2. **Advanced Filtering**
   - Filter by role, system, or event type
   - Search/highlight specific elements
   - "Jump to slice" navigation

3. **Orthogonal Arrow Routing**
   - Route arrows through grid gutters
   - Reduce overlapping connections

4. **Virtualization**
   - Render only visible slices for huge diagrams
   - Lazy-load arrows for off-screen content

5. **Responsive Breakpoints**
   - Mobile view with vertical scrolling
   - Collapsible lane headers on small screens

## Debugging Tips

### Grid Layout Issues
```javascript
// Inspect grid structure in browser console
document.querySelector('.swimlane-grid').style.gridTemplateColumns;
document.querySelector('.swimlane-grid').style.gridTemplateRows;

// Check cell positions
document.querySelectorAll('.grid-cell').forEach(cell => {
    console.log(cell.style.gridColumn, cell.style.gridRow, cell.textContent);
});
```

### Arrow Not Drawing
- Check if element has `data-slice-index` attribute
- Verify element has correct CSS class (`.element.trigger`, etc.)
- Confirm element is in DOM before `drawAllArrows()` is called
- Check browser console for warnings about missing events

### Lane Not Appearing
- Verify lane is added to `triggerLanes` or `eventLanes` array
- Check `buildGridMap()` assigns row number to lane key
- Ensure elements use correct lane key matching function

## Related Documentation

- [Arrow Logic Implementation](arrow-logic-implementation-learnings.md)
- [Collapse Feature](collapse-feature-learnings.md)
- [History/Undo/Redo](history-undo-redo.md)
- [Tree View](tree-view-quick-reference.md)

---

**Last Updated:** 2026-02-13  
**Contributors:** GitHub Copilot CLI
