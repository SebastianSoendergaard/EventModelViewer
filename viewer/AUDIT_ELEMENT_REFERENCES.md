# AUDIT: Element Reference Resolution in EventModelViewer

## QUICK REFERENCE

All id resolution happens in 3 layers:

1. **Enriched Model** (event-model.js): Calculates canonical id for every element
2. **DOM Attributes** (diagram.js generate* functions): Stores ids in data-attributes
3. **Cross-Slice Routing** (drawAllArrows): Reads attributes and resolves cross-references

---

## KEY FINDINGS

### Location 1: Enriched Model Calculation
File: src/event-model/event-model.js

**Function: calcId() - Lines 26-35**
- Rules: id if present → slugify(name) → ""
- Converts "Cart created" → "cart-created"

**Enrichment Functions - Lines 42-93**
- enrichTrigger(42-46): Adds \id: calcId(trigger)\
- enrichEvent(69-83): Adds \id: calcId(event)\
- enrichView(90-93): Adds \id: calcId(view)\
- enrichCommand(53-56): Adds \id: calcId(command)\

**Result**: Every element in model has pre-calculated .id

---

### Location 2: Resolution Functions in diagram.js

**Function: findEventElements() - Lines 99-115**
- Queries \data-event-id\ (ID-first)
- Fallback: \data-event-name\ (name)
- Used by drawAllArrows() line 286 for view→event routing

**Function: findViewElements() - Lines 138-156**
- Queries \data-view-id\ (ID-first)
- Fallback: \data-view-name\ (name)
- Used by drawAllArrows() line 342 for trigger→view routing

**Function: getTriggerLaneKey() - Lines 634-641**
- NOT id resolution - uses .swimlane property

**Function: getEventLaneKey() - Lines 646-659**
- NOT id resolution - uses .swimlane and .external properties

**Function: generateTrigger() - Lines 1013-1044**
- Sets \data-trigger-id = trigger.id || trigger.name\ (Line 1015)
- Sets \data-trigger-views = trigger.views.join(',')\ (Line 1014)
- ⚠️ trigger.views NOT enriched (raw JSON values)

**Function: generateEvent() - Lines 1085-1104**
- Sets \data-event-id = event.id\ (Line 1089, conditional)
- Sets \data-event-name = event.name\ (always)
- ✓ Uses pre-calculated event.id

**Function: generateView() - Lines 1113-1130**
- Sets \data-view-id = view.id || view.name\ (Line 1115)
- Sets \data-view-events = eventNames.join(',')\ (Line 1116)
- ⚠️ eventNames (view.events) NOT enriched (raw JSON values)

**Function: generateCommand() - Lines 1046-1083**
- Resolves command.events array (Lines 1052-1068)
- Pass 1: exact id match against \ventsInSlice.map(e => e.id)\
- Pass 2: name match, prefer non-external
- Sets \data-command-events = resolved IDs\ (Line 1070)
- ✓ Correctly enriches on-the-fly

---

### Location 3: Cross-Slice Routing in drawAllArrows()

**Command → Events (Lines 241-269)**
- Reads \data-command-events\ (pre-resolved)
- ID-first match against \data-event-id\
- Name fallback to \data-event-name\

**Event → View (Lines 275-328)**
- Reads \data-view-events\ from view elements (raw event names)
- Calls findEventElements(eventIdentifier) for each
- findEventElements does ID-first then name fallback

**View → Trigger (Lines 331-360)**
- Reads \data-trigger-views\ from trigger elements (raw view names)
- Calls findViewElements(viewIdentifier) for each
- findViewElements does ID-first then name fallback

---

## CRITICAL ISSUES

### Issue 1: trigger.views Not Enriched
**Line**: diagram.js:1014
**Code**: \const triggerViews = trigger.views ? trigger.views.join(',') : '';\
**Problem**: 
- Contains raw names from JSON, not enriched view ids
- Example: trigger.views=["Cart Items"] but view.id="cart-view-1"
- Lookup fails in drawAllArrows line 333

### Issue 2: view.events Not Enriched
**Line**: diagram.js:1117
**Code**: \data-view-events="\"\
**Problem**:
- Contains raw event names from JSON, not enriched event ids
- Example: view.events=["Cart created"] but event.id="cart-created"
- Lookup fails in drawAllArrows line 280 (but has name fallback)

### Issue 3: Unnecessary Fallback in generateTrigger
**Line**: diagram.js:1015
**Code**: \const triggerIdVal = trigger.id ? trigger.id : (trigger.name || '');\
**Problem**:
- trigger.id ALWAYS exists (from enrichment)
- Fallback to name is dead code
- Should be: \const triggerIdVal = trigger.id;\

### Issue 4: Unnecessary Fallback in generateView
**Line**: diagram.js:1115
**Code**: \const viewIdVal = view.id ? view.id : (view.name || '');\
**Problem**:
- view.id ALWAYS exists (from enrichment)
- Fallback to name is dead code
- Should be: \const viewIdVal = view.id;\

---

## COMPLETE RESOLUTION MAP

| Lookup | Location | Resolution | Data-Attr Set | Pre-Calculated |
|--------|----------|------------|----------------|----------------|
| event.id | event-model:30-35 | calcId() | - | BASE |
| event | diagram:1089 | event.id | data-event-id | ✓ |
| view.id | event-model:30-35 | calcId() | - | BASE |
| view | diagram:1115 | view.id \|\| view.name | data-view-id | ✓ (with fallback) |
| trigger.id | event-model:30-35 | calcId() | - | BASE |
| trigger | diagram:1015 | trigger.id \|\| trigger.name | data-trigger-id | ✓ (with fallback) |
| command.id | event-model:30-35 | calcId() | - | BASE |
| cmd→event | diagram:1056-62 | ID then name in slice | data-command-events | ✓ |
| evt→view | diagram:286 | findEventElements(id/name) | - | ✓ |
| view→trigger | diagram:342 | findViewElements(id/name) | - | ✓ |

---

## TEST COVERAGE

File: tests/arrow-logic.test.html

**Standalone Copies**:
- findEventElements() lines 59-70
- findViewElements() lines 73-85
- resolveCommandEvents() lines 88-116

**Tests**:
- ✓ findEventElements by ID
- ✓ findEventElements by name fallback
- ✓ findViewElements by ID/name
- ✓ Command→Event ID resolution
- ✓ Cross-slice selection logic

**Missing**:
- ⚠️ No test for trigger.views enrichment
- ⚠️ No test for view.events enrichment
