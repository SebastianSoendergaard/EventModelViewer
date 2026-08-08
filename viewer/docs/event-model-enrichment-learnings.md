# Event Model Enrichment Pipeline - Technical Guide

**Date:** 2026-03-07  
**Feature:** Intermediate enriched model representation for Event Model Viewer  
**Status:** ✅ Implemented and tested  
**Location:** `src/event-model/event-model.js`

---

## Overview

The event-model module transforms raw JSON into a **structured, enriched intermediate model** before the diagram renders. It is the single source of truth for all business rules about element identification, swimlane assignment/ordering, and cross-reference resolution.

This eliminates scattered, duplicated rule logic that previously existed across `diagram.js` and other modules.

---

## Problem Statement

### Before This Implementation

1. **ID resolution scattered** — `diagram.js` used ad-hoc `id || name` fallback in multiple places.
2. **Name-based cross-references** — `command.events`, `view.events`, `trigger.views` were matched by string equality against element names inside `diagram.js`, which owns no business rules.
3. **External event sentinel clash** — `enrichEvent()` set `swimlane = 'External'` as a sentinel for unnamed externals; this conflicted with models where users actually named their swimlane "External" (e.g. the "Publish cart" slice in `em.json`). External events were silently dropped from the grid.
4. **Ambiguous name matches** — When two events share a name (e.g. `"Inventory changed"` exists as both an external and internal event), name-only matching always returned the first match, which happened to be the wrong external event.
5. **`discoverSwimlanes()` lived in `diagram.js`** — business ordering rules (automation lanes first, external event lanes last) were mixed with rendering logic.

### Requirements

- One place for all business rules: ID calculation, swimlane ordering, cross-reference resolution.
- `diagram.js` receives an already-clean model and performs only rendering.
- Pure function `buildEventModel()` is unit-testable without a DOM or EventBus.
- Backward compatible — raw `em.json` format unchanged.

---

## Architecture

### Pipeline

```
Raw JSON  (from FILE_LOADED / JSON_CHANGED)
     ↓
event-model.js: buildEventModel(json)
     │
     ├─ Pass 1: Enrich every element
     │    ├─ calcId()    → explicit id > slug(name) > ""
     │    ├─ swimlane    → normalised to "" if absent/blank
     │    └─ external    → boolean flag set from raw JSON
     │
     ├─ Build lookup Maps
     │    ├─ allEventById   (id → event)
     │    ├─ allEventsByName  (name → event[])
     │    ├─ allViewById    (id → view)
     │    └─ allViewsByName   (name → view[])
     │
     └─ Pass 2: Resolve cross-references
          ├─ command.events  → slice-local resolution
          ├─ view.events     → global resolution
          └─ trigger.views   → global resolution
               ↓ all arrays now contain canonical ids
     ↓
EventBus.emit(MODEL_CHANGED, { model })
     ↓
diagram.js renders enriched model (zero rule logic)
```

### Module Communication

```javascript
// event-model.js subscribes to raw data events
EventBus.on(Events.FILE_LOADED, ({ json }) => {
    const model = buildEventModel(json);
    EventBus.emit(Events.MODEL_CHANGED, { model });
});

EventBus.on(Events.JSON_CHANGED, ({ json }) => {
    const model = buildEventModel(json);
    EventBus.emit(Events.MODEL_CHANGED, { model });
});

// diagram.js subscribes to the enriched model
EventBus.on(Events.MODEL_CHANGED, ({ model }) => {
    renderDiagram(model);
});
```

---

## Implementation Details

### 1. ID Calculation (`calcId`)

**Rule:** explicit `id` field → `slugify(name)` → `""` (empty — ignored in references)

```javascript
function slugify(str) {
    return (str || '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function calcId(element) {
    if (element.id) return element.id;
    if (element.name) return slugify(element.name);
    return '';
}
```

**Applied to ALL element types:** slice, trigger, command, event, view.

**Example:** event with `name: "Inventory changed"` → `id: "inventory-changed"`  
**Example:** event with explicit `id: "Cart published - external"` → keeps that exact string as its id.

---

### 2. Swimlane Normalisation (`enrichTrigger`, `enrichEvent`)

**Trigger rule:** use `swimlane` attribute if present; else `""`.

```javascript
function enrichTrigger(trigger) {
    return {
        ...trigger,
        id: calcId(trigger),
        swimlane: (trigger.swimlane || '').trim()
    };
}
```

**Event rule:** External events without a named swimlane get `swimlane = "External"`. The `"External"` swimlane name is shared with any user-defined `swimlane: "External"` field — they are the same lane, because **swimlanes are identified solely by name**.

```javascript
function enrichEvent(event) {
    const isExternal = !!event.external;
    const swimlane = (event.swimlane && event.swimlane.trim())
        ? event.swimlane
        : (isExternal ? 'External' : '');
    return { ...event, id: calcId(event), swimlane, external: isExternal };
}
```

> **Bug fixed (original attempt):** An earlier implementation kept `swimlane = ''` for unnamed
> externals and used the `.external` flag as a sentinel for lane placement. This caused
> `getEventLaneKey` to return a lane key (`'external'`) that didn't match the lane key produced
> by `buildSwimlanesFromSlices` for named externals (`'system:External'`), causing the event
> to be silently dropped from the grid.

---

### 3. Swimlane Ordering (`buildSwimlanesFromSlices`)

All ordering rules are in `buildSwimlanesFromSlices()`.

**Trigger ordering:**
1. Automation/translation triggers first (`trigger.type === 'automation'` or `'translation'`)
2. Other named roles
3. No-role triggers last (empty/absent swimlane)

**Event ordering:**
1. No-system events first (empty/absent swimlane, not external)
2. Named system events (ordered by first appearance)
3. External events last (`external: true`)

The returned `model.swimlanes.trigger` and `model.swimlanes.event` arrays are consumed directly by `diagram.js` to build the CSS Grid row map — no sorting or discovery needed at render time.

---

### 4. Cross-Reference Resolution (Pass 2)

#### Why it's needed

Raw JSON `command.events` / `view.events` / `trigger.views` can contain:
- An explicit **id** (e.g. `"Cart published - external"`)  
- An event **name** (e.g. `"Inventory changed"`)  
- When two events share a name, only one should be selected

After Pass 2, every reference array contains only **canonical ids** — the same string that is stored in `element.id` after Pass 1 enrichment.

#### resolveEventRef

```javascript
function resolveEventRef(ref, idMap, nameMap) {
    // Exact id match (includes explicit string ids from raw JSON)
    if (idMap.has(ref)) return ref;

    // Name match — prefer non-external when duplicates exist
    const candidates = nameMap.get(ref) || [];
    if (candidates.length > 0) {
        const preferred = candidates.find(e => !e.external) || candidates[0];
        return preferred.id || ref;
    }

    // Fallback: return as-is (warn-safe; diagram.js will log a warning)
    return ref;
}
```

#### Scope of resolution

| Field | Scope | Rationale |
|-------|-------|-----------|
| `command.events` | Slice-local | Commands produce events in the same slice only |
| `view.events` | Global | Views can reference events from any slice |
| `trigger.views` | Global | Triggers can reference views from any slice |

---

## Bugs Fixed

### Bug 1 — External event not rendered ("Publish cart" slice)

**Symptom:** The external "Cart published" event was missing from the diagram entirely.

**Root cause (original):**
- `enrichEvent()` set `swimlane = 'External'` as a string sentinel for unnamed externals.
- `buildSwimlanesFromSlices()` checked `swimlane === 'External'` to produce `{type:'external'}` lane.
- `getEventLaneKey()` for external events with named swimlane returned `system:External` — key mismatch with the `'external'` key produced by `getLaneKey({type:'external'})`.
- Lane key mismatch → event assigned to `undefined` row → dropped from grid.

**Second attempted fix (wrong):** Removed sentinel; kept `swimlane=""` for unnamed externals; relied on `.external` flag. This broke `buildSwimlanesFromSlices` which no longer knew where unnamed externals belonged.

**Correct fix:** 
- Unnamed external events always get `swimlane = "External"` (not a sentinel — it is the actual lane name).
- User-defined `swimlane: "External"` is the same lane — swimlanes identified by name only.
- `buildSwimlanesFromSlices` treats all external events the same: they all have a named swimlane.
- `getEventLaneKey` uses swimlane name only, not the `.external` flag.
- `getLaneKey` for `type:'system'` returns `system:External` — keys match ✓

---

### Bug 2 — Wrong command→event arrows ("Inventory changed", "Price changed")

**Symptom:** Commands in the "Inventory changed" and "Price changed" slices drew arrows to the wrong (external) event.

**Root cause:** Old `generateCommand()` in `diagram.js` did name-only matching: `.find(el => el.getAttribute('data-event-name') === ref)` — always returned the first match, which was the external event.

**Fix:** Moved resolution to `event-model.js` Pass 2. `resolveEventRef()` preferentially returns non-external events when names collide. `diagram.js` receives resolved ids, no name-matching needed.

---

### Bug 3 — Explicit id references unresolved

**Symptom:** The "Publish cart" command lists `"Cart published - external"` (an explicit id, not a name). Old name-only matching never found it.

**Fix:** `resolveEventRef()` checks id match (Pass 1) before name match (Pass 2). Explicit ids always resolve correctly.

---

## Lessons Learned

### 1. Sentinel values are fine when they are the domain value

Using a string like `"External"` as the default swimlane name for unnamed external events is correct — it becomes the actual lane name, not a hidden implementation detail. The rule "swimlanes are identified by name only" means `swimlane: "External"` (user-defined) and the assigned default `"External"` are always the same lane. There is no ambiguity.

### 2. Move resolution up the pipeline, not down

Resolving references inside the rendering layer (`diagram.js`) entangles business logic with DOM manipulation. Resolving in a pure data transformation step upstream means rendering becomes a simple mapping exercise.

### 3. Two-pass enrichment handles forward references

A single pass cannot resolve cross-references because an event referenced in slice 1 may be defined in slice 5. Build lookup maps after Pass 1, then resolve in Pass 2.

### 4. Prefer explicit id-match before name-match

Many edge cases (duplicate names, external vs internal events with same name) disappear when id-match is tried first. Name-match is a fallback for simple models that don't specify explicit ids.

### 5. Scope matters for cross-reference resolution

`command.events` are always slice-local (a command causes events in its own slice). `view.events` and `trigger.views` are global (a view can reference any event in the model). Using the wrong scope causes subtle bugs.

---

## Related Files

| File | Role |
|------|------|
| `src/event-model/event-model.js` | Two-pass enrichment pipeline |
| `src/viewer/diagram/diagram.js` | Consumes `MODEL_CHANGED`, pure rendering |
| `src/event-bus/event-bus.js` | `MODEL_CHANGED` event registration |
| `build.js` | Wires `event-model` before `diagram` in VIEWER_JS |
| `tests/event-model.test.html` | Browser-based unit tests for `buildEventModel()` |
| `em.json` | Example model with all complex cases |

---

## Testing Notes

The `buildEventModel()` function is a pure function — no DOM, no EventBus dependencies. Tests copy the function verbatim (no module imports needed):

```javascript
// tests/event-model.test.html pattern
const model = buildEventModel(rawJson);
assert(model.slices[0].trigger.id === 'add-item-trigger', 'trigger id calculated from name');
assert(model.slices[0].command.events[0] === 'item-added', 'event ref resolved to canonical id');
```

Key test scenarios from `em.json`:

| Scenario | What to verify |
|----------|----------------|
| "Add item" slice | `trigger.id` computed from name, `command.events` resolves to `'item-added'` |
| "Inventory changed" slice | `command.events` resolves to internal (non-external) `'inventory-changed'`, not external id |
| "Publish cart" slice | External "Cart published" event rendered; `command.events` resolves `"Cart published - external"` (explicit id) correctly |
| "Cart items" slice | `view.events` resolves cross-slice references globally |
| Named External swimlane | `swimlane: "External"` treated as user-defined lane name, not sentinel |

---

## Future Enhancements

1. **Validation errors** — Return a `model.errors[]` array from `buildEventModel()` instead of silent fallback; surface in UI.
2. **Cross-slice command refs** — Currently command.events is scoped to the same slice; extend if cross-slice command→event arrows become needed.
3. **Cycle detection** — Detect circular automation patterns (event A triggers command B which emits event A) and warn.
4. **Incremental enrichment** — For large models, re-enrich only changed slices on `JSON_CHANGED` (performance optimisation).

---

**Last Updated:** 2026-03-07  
**Contributors:** GitHub Copilot CLI
