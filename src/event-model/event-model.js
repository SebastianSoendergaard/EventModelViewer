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
         * Converts a name string into a URL-style slug for use as a calculated id.
         * Example: "Cart created" → "cart-created"
         */
        function slugify(name) {
            return (name || '')
                .trim()
                .toLowerCase()
                .replace(/\s+/g, '-')
                .replace(/[^a-z0-9-]/g, '');
        }

        /**
         * Calculates a canonical id for any model element.
         * Rule: use element.id if present → slugify element.name → ""
         * An empty-string id means the element has no cross-referenceable identity.
         */
        function calcId(element) {
            if (!element) return '';
            if (element.id) return element.id;
            if (element.name) return slugify(element.name);
            return '';
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
         *       external with no named swimlane → "External"
         *       external with named swimlane   → that name
         *       non-external with swimlane     → that name
         *       non-external with no swimlane  → ""
         *   - Normalises external to boolean
         */
        function enrichEvent(event) {
            let swimlane;
            const isExternal = !!event.external;
            if (event.swimlane && event.swimlane.trim()) {
                swimlane = event.swimlane;
            } else {
                // No named swimlane — for external events getEventLaneKey uses the
                // external:true flag to place them in the 'External' lane.
                swimlane = '';
            }
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
            var hasNoSystemEvent = false;
            var hasUnnamedExternal = false;
            var nonExternalSwimlanes = [];
            var externalSwimlanes = [];
            var seenNonExternal = new Set();
            var seenExternal = new Set();

            slices.forEach(function(slice) {
                (slice.events || []).forEach(function(event) {
                    if (event.external) {
                        if (event.swimlane) {
                            // named external swimlane
                            if (!seenExternal.has(event.swimlane)) {
                                seenExternal.add(event.swimlane);
                                externalSwimlanes.push(event.swimlane);
                            }
                        } else {
                            hasUnnamedExternal = true;
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
            if (hasUnnamedExternal) eventLanes.push({ type: 'external', label: 'External' });
            if (eventLanes.length === 0) eventLanes.push({ type: 'no-system', label: '' });

            return { trigger: triggerLanes, event: eventLanes };
        }

        /**
         * Main transformation entry point.
         *
         * Converts raw JSON (as stored in em.json / emitted by FILE_LOADED)
         * into a fully-enriched event model.
         *
         * Returns null if json is null (cleared document).
         */
        function buildEventModel(json) {
            if (!json) return null;

            var slices = Array.isArray(json.slices) ? json.slices.map(function(slice) {
                return {
                    id:      calcId(slice),
                    name:    slice.name   || '',
                    border:  slice.border || '',
                    trigger: slice.trigger  ? enrichTrigger(slice.trigger)  : null,
                    command: slice.command  ? enrichCommand(slice.command)   : null,
                    events:  Array.isArray(slice.events) ? slice.events.map(enrichEvent) : [],
                    view:    slice.view     ? enrichView(slice.view)         : null,
                    tests:   Array.isArray(slice.tests) ? slice.tests : []
                };
            }) : [];

            return {
                title:     json.title || '',
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
