# Event Model Viewer

Visualizes and edits Event Model documents (per Dymitruk/Dilger Event Modeling) through a code editor (JSON or YAML), tree view, and diagram renderer, either standalone in a browser or backed by a local file-system server.

## Language

**Event Model**:
The document this app edits — slices, triggers, commands, events, views, and tests. It has exactly one schema, but is stored on disk in either of two text encodings, chosen explicitly per document (never inferred from content, never converted after the fact).
_Avoid_: model file (ambiguous about which encoding)

**.emj (JSON encoding)**:
An Event Model written as JSON text.
_Avoid_: emj format, JSON file

**.emy (YAML encoding)**:
An Event Model written as YAML text — the same schema as `.emj`, just YAML syntax.
_Avoid_: emy format, YAML file
