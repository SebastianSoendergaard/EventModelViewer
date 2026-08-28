# Single shared codec-driven editor for `.emj`/`.emy`, not two editor modules

Adding `.emy` (YAML) as a second on-disk encoding of the Event Model — alongside `.emj` (JSON) — meant the code editor (`code-view.js`), file open/save, and server load/save all needed to become format-aware. The two encodings differ only in serialization (parse/stringify, ACE syntax mode); the schema, the diagram, the tree view, and every other consumer of the in-memory model are unaffected.

We considered duplicating `code-view.js` into a JSON variant and a YAML variant, since that would keep each one simple and format-specific. We rejected this: ~80% of the module (ACE wiring, debounced sync, undo/redo, fold/label UI) is format-agnostic, and maintaining two copies risks fixing a bug in one and not the other.

Instead we extracted a small shared `Codec` module (`viewer/src/codec/codec.js`) exposing `parse`, `stringify`, `aceMode`, and extension/format helpers for both encodings. `code-view.js` (and file-buttons, server-integration) stay single modules that call into `Codec` rather than hardcoding JSON. `Codec` is loaded unwrapped (like `EventBus`) so it's globally available to every module in both the standalone and server builds.

Format is always explicit — derived from a file's extension or carried in the `FILE_LOADED` event's `format` field — never sniffed from content. A document is always saved back in the format it was opened or created in; there is no format-conversion feature. New documents prompt the user to pick `.emj` or `.emy` up front via a shared `FormatPicker` modal, used by both the standalone and server "New" flows.

**Consequences:** any future encoding (e.g. TOML) is a `Codec` addition, not a new editor module. Conversely, a format-specific quirk that can't be expressed as parse/stringify/aceMode would force reconsidering this abstraction.
