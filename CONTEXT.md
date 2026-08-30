# Event Model Viewer

Visualizes and edits Event Model documents (per Dymitruk/Dilger Event Modeling) through a code editor (JSON or YAML), tree view, and diagram renderer, either standalone in a browser or backed by a local file-system server.

## Language

**Event Model**:
The document this app edits — slices, triggers, commands, events, views, and tests. It has exactly one schema, but is stored on disk in either of two text encodings, chosen explicitly per document (never inferred from content, never converted after the fact).
_Avoid_: model file (ambiguous about which encoding)

**Hotspot**:
An important point or highlight in an Event Model, scoped either to the overall workflow or to an individual slice. Model-level and slice-level hotspots remain separate even when their text is identical.
_Avoid_: hotspot section (does not identify the scope)

**.emj (JSON encoding)**:
An Event Model written as JSON text.
_Avoid_: emj format, JSON file

**.emy (YAML encoding)**:
An Event Model written as YAML text — the same schema as `.emj`, just YAML syntax.
_Avoid_: emy format, YAML file

**Standalone Viewer**:
The browser-only deployment of the Event Model Viewer, using local model-file open and save.
_Avoid_: browser viewer

**Server-based Viewer**:
The Event Model Viewer deployment that manages model files through a local server and supports task-file export.
_Avoid_: server viewer

**Deduplicated Slice**:
The logical slice formed by merging every raw `slices[]` entry that shares an id (or name, when no id is set). Multiple raw entries with the same id are fragments of one slice — the layout mechanic places a fragment next to whichever elements feed it — not distinct slices. Merging unions their `events`/`tests` and fills in `trigger`/`command`/`view`/`border` from whichever fragment defines them.
_Avoid_: duplicate slice (ambiguous about which side of the merge is meant)

**Task File Pair**:
The `.md`/`.json` pair exported per Deduplicated Slice by "Export as Tasks" (server mode), named `NNN-slicename.md`/`NNN-slicename.json`. Both describe the exact same slice — its pattern, own elements, one-hop-back dependencies, tests, and relations — the Markdown for a human or AI agent to read, the JSON (versioned via `schemaVersion`, see `docs/adr/0004-versioned-json-schema-for-exported-task-files.md`) for a code-generation tool to parse programmatically. `index.md`/`index.json` are the equivalent pair for the whole export's manifest.
_Avoid_: task file (ambiguous about which half of the pair is meant)
