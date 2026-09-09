# Event Model Viewer

Visualizes and edits Event Model documents (per Dymitruk/Dilger Event Modeling) through a code editor (JSON or YAML), tree view, and diagram renderer, either standalone in a browser or backed by a local file-system server.

## Language

**Event Model**:
The document this app edits — slices, triggers, commands, events, views, and tests. It has exactly one schema, but is stored on disk in either of two text encodings, chosen explicitly per document (never inferred from content, never converted after the fact).
_Avoid_: model file (ambiguous about which encoding)

**Hotspot**:
An important point or highlight in an Event Model, scoped either to the overall workflow or to an individual slice. Model-level and slice-level hotspots remain separate even when their text is identical.
_Avoid_: hotspot section (does not identify the scope)

**Note**:
A slice-scoped explanatory annotation shown beside the command/view, distinct from a Hotspot and Slice Hint. A Note is context for readers, not implementation guidance, a test, a requirement, or a relationship participant.
_Avoid_: slice hint (a Note is not implementation guidance)

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
The Event Model Viewer deployment that manages model files through a local server and supports task-file export to a selected local folder.
_Avoid_: server viewer

**Task Export**:
The shared export capability that turns the current Event Model into the server-compatible set of Markdown/JSON Task File Pairs and `index.md`/`index.json`; the Server-based Viewer writes these files to a selected folder, while the Standalone Viewer downloads them individually.
_Avoid_: task download (does not cover server delivery)

**Deduplicated Slice**:
The logical slice formed by merging every raw `slices[]` entry that shares an id (or name, when no id is set). Multiple raw entries with the same id are fragments of one slice — the layout mechanic places a fragment next to whichever elements feed it — not distinct slices. Merging unions their `events`/`tests` and fills in `trigger`/`command`/`view`/`border`/`background` from whichever fragment defines them.
_Avoid_: duplicate slice (ambiguous about which side of the merge is meant)

**Slice State Marker**:
A visual encoding of a slice's state. A slice may use an optional border, an optional background color, or both; these are presentation cues rather than separate domain states.
_Avoid_: slice status (the model does not define a separate status value)

**Slice Hint**:
Optional implementation guidance for one slice. Slice hints are carried with the slice into its task export and remain separate from tests, acceptance criteria, and workflow notes.
_Avoid_: task hint (does not identify the slice boundary)

**Fit Zoom**:
The diagram's zoom level at which the whole Event Model is visible with no blank space and no scrollbars — computed as `min(viewport width / diagram width, viewport height / diagram height)`, so it always matches whichever dimension is the tighter fit. It is the default zoom on load and the lower bound zooming out can reach; it is recomputed whenever the diagram's content or the viewport changes. Zooming in past Fit Zoom is unbounded and produces scrollbars as expected.
_Avoid_: 100% zoom, minimum zoom (Fit Zoom is rarely 100% and can exceed it for small models)

**Task File Pair**:
The `.md`/`.json` pair exported per Deduplicated Slice by Task Export, named `NNN-slicename.md`/`NNN-slicename.json`. Both describe the exact same slice — its pattern, own elements, one-hop-back dependencies, tests, and relations — the Markdown for a human or AI agent to read, the JSON (versioned via `schemaVersion`, see `docs/adr/0004-versioned-json-schema-for-exported-task-files.md`) for a code-generation tool to parse programmatically. `index.md`/`index.json` are the equivalent pair for the whole export's manifest. The file contract is shared by both viewer deployments; only delivery differs.
_Avoid_: task file (ambiguous about which half of the pair is meant)
