# ADR 0004: Explicit conversion between `.emj` and `.emy`

- **Status:** Accepted
- **Date:** 2026-10-11

## Context

ADR 0003 established one shared codec and kept a document in the encoding it was opened or created with. The application now needs an explicit user action to convert between its JSON (`.emj`) and YAML (`.emy`) representations. Both encodings contain the same Event Model schema; detecting an encoding by inspecting text would make the file extension and tracked document format unreliable.

Persistence differs between the two deployments. The browser-only viewer has no server-side file operation and can replace its active in-memory representation. The server viewer can preserve the original file by creating a second file, but must safely support nested paths and avoid leaving an empty destination if writing fails.

## Decision

- Conversion is explicit and uses the document's tracked encoding; the application never infers the source encoding from its contents.
- Conversion parses and validates the current editor buffer, then serializes the same Event Model using the target encoding's standard formatting. Formatting and YAML comments are not preserved.
- In standalone mode, conversion replaces the active representation and updates the encoding and filename extension. A later save downloads the converted representation.
- In server mode, conversion creates a new file beside the source, preserving its basename and changing its extension. The new file is created with its converted content, without overwriting an existing path; the source remains unchanged and the new file becomes active only after creation succeeds.
- If parsing, validation, or destination creation fails, the active document remains unchanged and the error is shown to the user.

## Consequences

The server API must safely accept root-relative nested destinations and create their contents without exposing partial files. Conversion preserves Event Model data semantics, not text-level comments or whitespace. The editor's tracked format remains authoritative for loading, parsing, saving, and deciding which conversion action is available.
