# Documentation

This directory contains detailed documentation about the Event Model Viewer implementation, architecture, and learnings.

## Available Documents

### Quick References (For Users)

#### [tree-view-quick-reference.md](tree-view-quick-reference.md)
User-friendly guide for Tree View features.

**Topics covered:**
- How to reorder items (drag-and-drop)
- How to copy/delete items (context menu)
- How to edit values (inline editing)
- Keyboard shortcuts and tips
- Common workflows and troubleshooting

**Best for:**
- New users learning the tree view
- Quick feature lookup
- Understanding what's possible
- Troubleshooting common issues

---

### Implementation Guides (For Developers)

#### [collapse-feature-learnings.md](collapse-feature-learnings.md)
Comprehensive documentation of the collapsible JSON editor feature implementation.

**Topics covered:**
- Problem statement and context
- Key technical learnings
- Regex patterns for detection
- Bracket matching algorithms
- User experience considerations
- Performance analysis
- Code quality lessons
- Future enhancement ideas

**Best for:**
- Understanding how the collapse feature works
- Learning about JSON parsing patterns
- Reference for similar implementations
- Onboarding new developers

---

### [tree-context-menu-learnings.md](tree-context-menu-learnings.md)
Implementation guide for the right-click context menu feature in tree view.

**Topics covered:**
- Context menu implementation (copy/delete)
- Event handling with `closest()`
- Deep copy algorithm with unique IDs
- Multi-view synchronization
- Menu positioning and dismissal
- Parent-only restriction logic
- Edge cases and validation

**Best for:**
- Understanding context menu patterns
- Learning about DOM event delegation
- Reference for copy/delete operations
- Understanding data synchronization

---

### [tree-inline-edit-learnings.md](tree-inline-edit-learnings.md)
Implementation guide for double-click inline editing of leaf values.

**Topics covered:**
- Inline editing activation
- Type-safe value parsing and validation
- Race condition prevention (Enter+blur)
- Event listener cleanup strategies
- Multi-view synchronization
- User experience design
- Error handling and feedback

**Best for:**
- Understanding inline edit patterns
- Learning about race condition prevention
- Reference for type validation
- Understanding event lifecycle management

---

### [tree-drag-drop-learnings.md](tree-drag-drop-learnings.md)
Implementation guide for drag-and-drop item reordering in tree view.

**Topics covered:**
- HTML5 Drag and Drop API
- Drop zone strategy and positioning
- Descendant prevention (circular references)
- Array index renumbering
- Object key uniqueness
- Visual feedback during drag
- State management and cleanup

**Best for:**
- Understanding drag-and-drop implementation
- Learning about tree manipulation
- Reference for move/reorder operations
- Understanding data structure updates

---

### [history-undo-redo.md](history-undo-redo.md)
Comprehensive guide for the history manager and undo/redo functionality.

**Topics covered:**
- Unified history tracking (code + tree view)
- State management with circular buffer
- Undo/redo operations and algorithms
- Keyboard shortcuts (Ctrl+Z, Ctrl+Y)
- Button state management
- Memory optimization (50 state limit)
- Deep cloning and mutation prevention
- Integration points (code editor, tree actions)
- Restore loop prevention
- Debouncing strategies

**Best for:**
- Understanding undo/redo implementation
- Learning about state management patterns
- Reference for history tracking
- Understanding memory optimization techniques

---

### [code-editor-sync-learnings.md](code-editor-sync-learnings.md)
Deep dive into code editor multi-view synchronization issue and solution.

**Topics covered:**
- Root cause analysis (collapsed sections problem)
- DOM as source of truth pitfall
- ContentEditable complexity and trade-offs
- Event listener lifecycle management
- Debouncing strategies for user input
- Multi-view synchronization patterns
- Debug strategies with console logging
- Edge cases and validation
- User experience considerations

**Best for:**
- Understanding code editor limitations
- Learning about DOM manipulation pitfalls
- Reference for contenteditable implementations
- Understanding synchronization challenges
- Debugging async operations

---

## Contributing to Documentation

When adding new features or making significant changes:

1. **Create a learning document** - Document your discoveries and decisions
2. **Include code examples** - Show before/after or key snippets
3. **Explain trade-offs** - Why did you choose this approach?
4. **Note performance** - Any performance considerations?
5. **List references** - Links to resources that helped

### Document Template

```markdown
# Learnings: [Feature Name]

## Date: YYYY-MM-DD
## Feature: [Brief Description]

---

## Problem Statement
[What problem were you solving?]

## Key Learnings
[What did you discover?]

## Implementation
[How did you solve it?]

## Testing
[How did you verify it works?]

## Future Enhancements
[What could be improved?]

## Related Files
[Links to relevant code]
```

## Documentation Standards

- Use Markdown format (`.md`)
- Include code examples with syntax highlighting
- Add diagrams where helpful (Mermaid, ASCII art, or images)
- Keep language clear and concise
- Update index when adding new docs
- Date all documents

## Viewing Documentation

All markdown files can be viewed:
- In any text editor
- On GitHub (with rendering)
- Using a markdown preview tool
- In VS Code with markdown preview

---

*Last updated: 2026-02-11*
