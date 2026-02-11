# Tree View Quick Reference

**Quick guide for using the Tree View editor features**

---

## Overview

The Tree View provides a visual, hierarchical representation of your JSON data with powerful editing capabilities.

---

## Basic Navigation

### Switch to Tree View
1. Click the **"Tree"** tab in the editor panel
2. Your JSON appears as an expandable/collapsible tree

### Collapse/Expand Nodes
- **Click ▶/▼** next to a node to toggle its children
- **Collapse All** button - Collapses all expandable nodes
- **Expand All** button - Expands all nodes

### Visual Indicators
- **⋮ symbol** - Parent items (objects/arrays) that can be copied/deleted
- **Colored badges** - Show item types:
  - 🔵 Blue = Object
  - 🟠 Orange = Array
  - 🟣 Purple = String
  - 🟢 Green = Number
  - 🩷 Pink = Boolean
  - ⚫ Gray = Null

---

## Editing Features

### 1. **Reorder Items (Drag-and-Drop)**

**How to use:**
1. Click and hold on any tree item box
2. Drag to a new position
3. Look for the green line showing where it will be placed
4. Release to drop

**Visual feedback:**
- ✅ **Green line** = Valid drop location
- ❌ **Red line** = Invalid (e.g., can't drop parent into its own child)
- Dragged item becomes semi-transparent

**Works with:**
- Root-level items
- Nested items at any depth
- Array items (automatically renumbers indices)
- Object properties

---

### 2. **Copy Items (Right-Click)**

**How to use:**
1. Right-click on a parent item (object or array with ⋮ symbol)
2. Select **"Copy"** from the menu
3. A duplicate appears immediately below the original

**Behavior:**
- Adds `_copy` suffix to object property names
- Deep copies entire structure (all children included)
- Array items get renumbered automatically
- Creates new unique IDs internally

**Example:**
```json
{ "command": "AddItem" }  ← Original
{ "command_copy": "AddItem" }  ← Copy appears here
```

**Note:** Only works on parent items (objects/arrays), not leaf values.

---

### 3. **Delete Items (Right-Click)**

**How to use:**
1. Right-click on a parent item (object or array with ⋮ symbol)
2. Select **"Delete"** from the menu
3. Confirm in the dialog
4. Item is removed

**Safety:**
- Always asks for confirmation before deleting
- Shows item name in confirmation dialog
- No undo (be careful!)

**Note:** Only works on parent items (objects/arrays), not leaf values.

---

### 4. **Edit Values (Double-Click)**

**How to use:**
1. Double-click on a leaf value (string, number, boolean, null)
2. Input field appears with current value selected
3. Type your new value
4. Press **Enter** to save OR click outside
5. Press **Escape** to cancel

**Type validation:**
- **Strings:** Any text accepted
- **Numbers:** Must be valid number (42, 3.14, -10)
- **Booleans:** Must be exactly "true" or "false"
- **Null:** Must be exactly "null"

**Visual feedback:**
- Input field has blue border
- Invalid input shows alert and doesn't save
- All views update immediately on save

**Note:** Only works on leaf values, not parent items (objects/arrays).

---

## Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Save edit | **Enter** |
| Cancel edit | **Escape** |
| Close context menu | **Escape** or click outside |

---

## Feature Summary Table

| Feature | Trigger | Works On | Keyboard |
|---------|---------|----------|----------|
| **Reorder** | Click + Drag | All items | - |
| **Copy** | Right-click → Copy | Parent items only (⋮) | - |
| **Delete** | Right-click → Delete | Parent items only (⋮) | - |
| **Edit** | Double-click | Leaf values only | Enter/Esc |

---

## Common Workflows

### Duplicate and Modify
1. Right-click item → **Copy**
2. Double-click leaf values in the copy
3. Edit them to create a variant

### Reorganize Structure
1. Drag items to reorder
2. Drop into different parents
3. Watch tree, code, and diagram update

### Quick Value Changes
1. Double-click value
2. Type new value
3. Press Enter

### Clean Up Structure
1. Right-click unnecessary items
2. Select **Delete**
3. Confirm removal

---

## Tips & Tricks

### Tip 1: Multi-View Sync
All changes automatically update:
- ✅ Tree view
- ✅ Code editor
- ✅ Diagram

### Tip 2: Valid Drop Zones
Look for the green line! It shows exactly where your item will land.

### Tip 3: Parent vs Leaf
- **Parent items (⋮):** Right-click for copy/delete
- **Leaf values:** Double-click to edit

### Tip 4: Array Reordering
Arrays automatically renumber when you drag items. The indices stay correct!

### Tip 5: Nested Copying
When you copy a parent, ALL its children come with it. Great for duplicating complex structures.

### Tip 6: Cancel Anytime
- Editing? Press **Escape**
- Context menu open? Click outside or press **Escape**
- Dragging? Release outside a valid zone

---

## Limitations

### Current Restrictions
- ❌ No multi-select (one item at a time)
- ❌ No undo/redo (changes are immediate)
- ❌ Can't edit parent items inline (use code editor or context menu)
- ❌ Can't copy leaf values directly (copy parent instead)

### Validation Rules
- Can't drop parent into its own child (prevents circular refs)
- Can't edit objects/arrays inline (they have complex structure)
- Type validation enforced (can't put "abc" in a number field)

---

## Troubleshooting

### Context Menu Doesn't Appear
**Fix:** Make sure you're right-clicking on a parent item (look for ⋮ symbol)

### Can't Drop Item
**Fix:** Check for red line - you might be trying to drop parent into its child

### Edit Doesn't Start
**Fix:** Make sure you're double-clicking a leaf value, not a parent item

### Changes Don't Save
**Fix:** Check for validation errors - invalid input shows an alert

### Values Look Wrong
**Fix:** Check the type - make sure "true" is lowercase for booleans

---

## Learn More

For detailed implementation information, see:
- [tree-context-menu-learnings.md](tree-context-menu-learnings.md)
- [tree-inline-edit-learnings.md](tree-inline-edit-learnings.md)
- [tree-drag-drop-learnings.md](tree-drag-drop-learnings.md)

---

*Last updated: 2026-02-11*
