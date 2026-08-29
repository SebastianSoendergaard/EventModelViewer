# Versioned JSON schema for exported task files

The "Export as Tasks" feature (`export-tasks.js`) writes, per Deduplicated Slice, a paired Markdown file (for a human/AI agent to read) and a JSON file (for a code-generation tool to parse programmatically), plus `index.md`/`index.json`. Unlike the Markdown — which is free-form prose nobody parses structurally — the JSON's exact shape (field names, `dependencies.events` vs `dependencies.externalEvents`, kebab-case `pattern` codes, `relations` edges) is a contract that external code-gen tooling will come to depend on.

We considered leaving the JSON unversioned, on the theory that this is an internal export format we control end-to-end. We rejected this: once a third-party tool is written against the shape, any future change (renaming a field, restructuring `dependencies`, adding a new pattern) becomes a breaking change we can't detect at the point of consumption — the tool would just silently misread the new files.

Instead every exported slice JSON and `index.json` carries a top-level `"schemaVersion": 1` (the constant `TASK_JSON_SCHEMA_VERSION` in `export-tasks.js`). Consuming tools can branch on it; we bump it whenever the shape changes in a way that could break existing consumers (adding a new optional field does not require a bump; renaming/removing a field or changing a value's format does).

**Consequences:** a schema change that warrants a version bump should also get a short changelog note in this ADR or a follow-up one describing what changed between versions, so a tool author can diff behavior across versions without reverse-engineering it from git history.
