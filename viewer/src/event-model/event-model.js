        // =====================================================================
        // event-model.js — Enriches raw JSON into a structured event model
        //
        // This module is the ONLY place where element-identification and
        // swimlane-ordering rules are implemented. All other modules receive
        // the enriched model via MODEL_CHANGED and must not re-implement rules.
        //
        // Wrapped in IIFE by build.js; communicates only via EventBus.
        // =====================================================================

        // ----- Pure calculation helpers (copy-paste into test files) -----

        /**
         * Calculates a canonical id for any model element.
         * Rule: use element.id if present → use element.name as-is → ""
         * An empty-string id means the element has no cross-referenceable identity.
         * Note: only the id and name fields are considered — no other attributes.
         */
        function calcId(element) {
            if (!element) return '';
            if (element.id) return element.id;
            if (element.name) return element.name;
            return '';
        }

        function validateSliceHints(json) {
            if (!json || typeof json !== 'object' || !Array.isArray(json.slices)) return;
            json.slices.forEach(function(slice, index) {
                if (!slice || typeof slice !== 'object' || !Object.prototype.hasOwnProperty.call(slice, 'hints')) {
                    return;
                }
                if (!Array.isArray(slice.hints) || slice.hints.some(function(hint) { return typeof hint !== 'string'; })) {
                    var label = slice.name ? ' "' + slice.name + '"' : ' at index ' + index;
                    throw new Error('Invalid hints for slice' + label + ': expected a list of strings');
                }
            });
        }

        function validateSliceNotes(json) {
            if (!json || typeof json !== 'object' || !Array.isArray(json.slices)) return;
            json.slices.forEach(function(slice, index) {
                if (!slice || typeof slice !== 'object' || !Object.prototype.hasOwnProperty.call(slice, 'note')) {
                    return;
                }
                if (typeof slice.note !== 'string') {
                    var label = slice.name ? ' "' + slice.name + '"' : ' at index ' + index;
                    throw new Error('Invalid note for slice' + label + ': expected a string');
                }
            });
        }

        /**
         * Enriches a trigger object:
         *   - Adds calculated id
         *   - Normalises swimlane to "" if absent or whitespace-only
         */
        function enrichTrigger(trigger) {
            return Object.assign({}, trigger, {
                id: calcId(trigger),
                swimlane: (trigger.swimlane && trigger.swimlane.trim()) ? trigger.swimlane : ''
            });
        }

        /**
         * Enriches a command object:
         *   - Adds calculated id
         */
        function enrichCommand(command) {
            return Object.assign({}, command, {
                id: calcId(command)
            });
        }

        /**
         * Enriches an event object:
         *   - Adds calculated id
         *   - Normalises swimlane:
         *       has named swimlane             → that name (including user-defined "External")
         *       external with no named swimlane → "External"  (same lane as named "External")
         *       non-external with no swimlane  → ""
         *   - Normalises external to boolean
         *
         * Swimlanes are identified solely by name.  "External" (assigned here) and
         * swimlane: "External" (user-defined) are the same lane.
         */
        function enrichEvent(event) {
            const isExternal = !!event.external;
            const swimlane = (event.swimlane && event.swimlane.trim())
                ? event.swimlane
                : (isExternal ? 'External' : '');
            return Object.assign({}, event, {
                id: calcId(event),
                swimlane: swimlane,
                external: isExternal
            });
        }

        /**
         * Enriches a view object:
         *   - Adds calculated id
         */
        function enrichView(view) {
            return Object.assign({}, view, {
                id: calcId(view)
            });
        }

        /**
         * Builds ordered swimlane arrays from a list of enriched slices.
         *
         * Trigger lane ordering rules:
         *   1. automation / translation triggers first (in discovery order)
         *   2. all other trigger swimlanes (in discovery order)
         *   3. triggers with no swimlane last (single "no-role" lane)
         *
         * Event lane ordering rules:
         *   1. events with no swimlane first (single "no-system" lane)
         *   2. named non-external swimlanes (in discovery order)
         *   3. named external swimlanes (in discovery order)
         *   4. external events with no named swimlane → "External" lane last
         *
         * Returns arrays in the same lane-object format used by diagram.js's
         * buildGridMap / getLaneKey functions so diagram.js needs no lane-key changes.
         */
        function buildSwimlanesFromSlices(slices) {
            // --- Trigger lanes ---
            const automationLanes = [];
            const otherTriggerLanes = [];
            let hasNoRoleTrigger = false;
            const seenTriggerLanes = new Set();

            slices.forEach(function(slice) {
                if (!slice.trigger) return;
                var sw = slice.trigger.swimlane;
                var type = slice.trigger.type;
                if (sw) {
                    if (!seenTriggerLanes.has(sw)) {
                        seenTriggerLanes.add(sw);
                        if (type === 'automation' || type === 'translation') {
                            automationLanes.push(sw);
                        } else {
                            otherTriggerLanes.push(sw);
                        }
                    }
                } else {
                    hasNoRoleTrigger = true;
                }
            });

            var triggerLanes = [];
            automationLanes.forEach(function(sw) { triggerLanes.push({ type: 'role', role: sw, label: sw }); });
            otherTriggerLanes.forEach(function(sw) { triggerLanes.push({ type: 'role', role: sw, label: sw }); });
            if (hasNoRoleTrigger) triggerLanes.push({ type: 'no-role', label: '' });
            if (triggerLanes.length === 0) triggerLanes.push({ type: 'no-role', label: '' });

            // --- Event lanes ---
            // After enrichEvent(), ALL external events have a swimlane name ("External"
            // by default, or a user-defined name).  Swimlanes are identified by name only;
            // "External" (default) and swimlane:"External" (user-defined) are the same lane.
            //
            // Ordering: no-system first → named non-external → named external (last)
            var hasNoSystemEvent = false;
            var nonExternalSwimlanes = [];
            var externalSwimlanes = [];
            var seenNonExternal = new Set();
            var seenExternal = new Set();

            slices.forEach(function(slice) {
                (slice.events || []).forEach(function(event) {
                    if (event.external) {
                        // event.swimlane is always set by enrichEvent (defaults to "External")
                        if (!seenExternal.has(event.swimlane)) {
                            seenExternal.add(event.swimlane);
                            externalSwimlanes.push(event.swimlane);
                        }
                    } else if (event.swimlane) {
                        if (!seenNonExternal.has(event.swimlane)) {
                            seenNonExternal.add(event.swimlane);
                            nonExternalSwimlanes.push(event.swimlane);
                        }
                    } else {
                        hasNoSystemEvent = true;
                    }
                });
            });

            var eventLanes = [];
            if (hasNoSystemEvent) eventLanes.push({ type: 'no-system', label: '' });
            nonExternalSwimlanes.forEach(function(sw) { eventLanes.push({ type: 'system', system: sw, label: sw }); });
            externalSwimlanes.forEach(function(sw) { eventLanes.push({ type: 'system', system: sw, label: sw }); });
            if (eventLanes.length === 0) eventLanes.push({ type: 'no-system', label: '' });

            return { trigger: triggerLanes, event: eventLanes };
        }

        // ----- Cross-reference resolution helpers -----

        /**
         * Resolves an event reference string (which may be an explicit id OR a name)
         * to a canonical element id using the provided lookup maps.
         *
         * Strategy:
         *   1. Exact id match (handles explicit ids like "Cart published - external")
         *   2. Name match, preferring non-external when multiple events share a name
         *   3. Returns the original ref unchanged if nothing matches
         */
        function resolveEventRef(ref, eventById, eventsByName) {
            if (!ref) return ref;
            var idMatch = eventById.get(ref);
            if (idMatch) return idMatch.id;
            var nameMatches = eventsByName.get(ref) || [];
            if (nameMatches.length > 0) {
                var preferred = null;
                for (var i = 0; i < nameMatches.length; i++) {
                    if (!nameMatches[i].external) { preferred = nameMatches[i]; break; }
                }
                preferred = preferred || nameMatches[0];
                return preferred.id || ref;
            }
            return ref;
        }

        /**
         * Resolves a view reference string (which may be an explicit id OR a name)
         * to a canonical element id using the provided lookup maps.
         */
        function resolveViewRef(ref, viewById, viewsByName) {
            if (!ref) return ref;
            var idMatch = viewById.get(ref);
            if (idMatch) return idMatch.id;
            var nameMatches = viewsByName.get(ref) || [];
            if (nameMatches.length > 0) return nameMatches[0].id || ref;
            return ref;
        }

        /**
         * Second-pass: resolves all cross-reference arrays within a slice to
         * canonical element ids.  Must be called after all slices are enriched so
         * the global lookup maps are complete.
         *
         *   slice.command.events   — resolved against slice-local events only
         *   slice.view.events      — resolved against ALL events (cross-slice)
         *   slice.trigger.views    — resolved against ALL views (cross-slice)
         */
        function resolveSliceRefs(slice, allEventById, allEventsByName, allViewById, allViewsByName) {
            var result = Object.assign({}, slice);

            // command.events: always same-slice — build per-slice maps for precision
            if (slice.command && Array.isArray(slice.command.events)) {
                var sliceEventById = new Map();
                var sliceEventsByName = new Map();
                (slice.events || []).forEach(function(ev) {
                    if (ev.id) sliceEventById.set(ev.id, ev);
                    if (ev.name) {
                        var bucket = sliceEventsByName.get(ev.name) || [];
                        bucket.push(ev);
                        sliceEventsByName.set(ev.name, bucket);
                    }
                });
                result.command = Object.assign({}, slice.command, {
                    events: slice.command.events.map(function(ref) {
                        return resolveEventRef(ref, sliceEventById, sliceEventsByName);
                    })
                });
            }

            // view.events: cross-slice event references
            if (slice.view && Array.isArray(slice.view.events)) {
                result.view = Object.assign({}, slice.view, {
                    events: slice.view.events.map(function(ref) {
                        return resolveEventRef(ref, allEventById, allEventsByName);
                    })
                });
            }

            // trigger.views: cross-slice view references
            if (slice.trigger && Array.isArray(slice.trigger.views)) {
                result.trigger = Object.assign({}, slice.trigger, {
                    views: slice.trigger.views.map(function(ref) {
                        return resolveViewRef(ref, allViewById, allViewsByName);
                    })
                });
            }

            return result;
        }

        /**
         * Main transformation entry point.
         *
         * Pass 1 — Enrich every element (id, swimlane, external flag).
         * Pass 2 — Resolve all cross-reference arrays to canonical ids:
         *          command.events, view.events, trigger.views.
         *
         * Returns null if json is null (cleared document).
         */
        function buildEventModel(json) {
            if (!json) return null;
            validateSliceHints(json);
            validateSliceNotes(json);

            // --- Pass 1: Enrich element fields ---
            var slices = Array.isArray(json.slices) ? json.slices.map(function(slice) {
                var enrichedSlice = {
                    id:      calcId(slice),
                    name:    slice.name   || '',
                    border:  slice.border || '',
                    hotspots: Array.isArray(slice.hotspots) ? slice.hotspots : [],
                    trigger: slice.trigger  ? enrichTrigger(slice.trigger)  : null,
                    command: slice.command  ? enrichCommand(slice.command)   : null,
                    events:  Array.isArray(slice.events) ? slice.events.map(enrichEvent) : [],
                    view:    slice.view     ? enrichView(slice.view)         : null,
                    tests:   Array.isArray(slice.tests) ? slice.tests : []
                };
                if (typeof slice.note === 'string' && slice.note.trim()) {
                    enrichedSlice.note = slice.note;
                }
                if (Object.prototype.hasOwnProperty.call(slice, 'hints')) {
                    enrichedSlice.hints = slice.hints.slice();
                }
                return enrichedSlice;
            }) : [];

            // --- Pass 2: Build global lookup maps, then resolve cross-references ---
            var allEventById    = new Map();
            var allEventsByName = new Map();
            var allViewById     = new Map();
            var allViewsByName  = new Map();

            slices.forEach(function(slice) {
                (slice.events || []).forEach(function(ev) {
                    if (ev.id) allEventById.set(ev.id, ev);
                    if (ev.name) {
                        var bucket = allEventsByName.get(ev.name) || [];
                        bucket.push(ev);
                        allEventsByName.set(ev.name, bucket);
                    }
                });
                if (slice.view) {
                    if (slice.view.id) allViewById.set(slice.view.id, slice.view);
                    if (slice.view.name) {
                        var bucket = allViewsByName.get(slice.view.name) || [];
                        bucket.push(slice.view);
                        allViewsByName.set(slice.view.name, bucket);
                    }
                }
            });

            slices = slices.map(function(slice) {
                return resolveSliceRefs(slice, allEventById, allEventsByName, allViewById, allViewsByName);
            });

            return {
                title:     json.title || '',
                hotspots:  Array.isArray(json.hotspots) ? json.hotspots : [],
                slices:    slices,
                swimlanes: buildSwimlanesFromSlices(slices)
            };
        }

        // ----- EventBus wiring -----

        EventBus.on(Events.FILE_LOADED, function(payload) {
            var json = payload ? payload.json : null;
            EventBus.emit(Events.MODEL_CHANGED, { model: buildEventModel(json) });
        });

        EventBus.on(Events.JSON_CHANGED, function(payload) {
            var json = payload ? payload.json : null;
            EventBus.emit(Events.MODEL_CHANGED, { model: buildEventModel(json) });
        });
