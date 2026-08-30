        // =====================================================================
        // export-tasks.js — "Export as Tasks": turns the currently loaded event
        // model into one Markdown task file per deduplicated slice, suitable for
        // handing to an AI coding agent. Server mode only (writes via POST /export).
        //
        // Operates entirely on the already-enriched MODEL_CHANGED payload (see
        // event-model.js), which is identical regardless of whether the document
        // was loaded from .emj (JSON) or .emy (YAML) — Codec.parse() normalizes
        // both encodings into the same in-memory shape before enrichment ever runs.
        // No format-specific code is needed here.
        //
        // Wrapped in IIFE by build.js; communicates only via EventBus except for
        // the fetch() calls needed to browse/write folders on the server.
        // =====================================================================

        // ----- Pure calculation helpers (copy-paste into test files) -----

        // Kept at 1 while the exported task format is unreleased. Bump it after
        // release whenever the JSON shape changes in a way that could break a
        // code-gen tool consuming it (see docs/adr). Markdown output is not
        // versioned — it's for humans/agents to read, not to parse structurally.
        var TASK_JSON_SCHEMA_VERSION = 1;

        function sanitizeSliceName(name) {
            return (name || '')
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-+|-+$/g, '')
                .substring(0, 50) || 'slice';
        }

        function padOrder(n, width) {
            var s = String(n);
            while (s.length < width) s = '0' + s;
            return s;
        }

        /**
         * Merges raw enriched slices that share an id (id falls back to name — see
         * event-model.js's calcId) into one logical "Deduplicated Slice" (see
         * CONTEXT.md). Multiple raw slice entries with the same id are fragments of
         * one slice — the diagram layout places a view fragment next to whichever
         * events feed it — not distinct slices. Unions events/tests; first fragment
         * to define trigger/command/view/border wins. Because a view (or, less
         * commonly, a trigger/command) fragment is placed next to whichever event
         * feeds it, different fragments of the same view/trigger typically carry a
         * *different* single entry in their `events`/`views` reference array —
         * those reference arrays are unioned across fragments too, not just
         * overwritten by the first fragment, so no dependency is silently dropped.
         * Preserves order of first appearance (used later for file numbering).
         */
        function unionRefs(existing, incoming) {
            var result = (existing || []).slice();
            (incoming || []).forEach(function(ref) {
                if (result.indexOf(ref) === -1) result.push(ref);
            });
            return result;
        }

        function mergeHints(existing, incoming) {
            var result = (existing || []).slice();
            (incoming || []).forEach(function(hint) {
                if (result.indexOf(hint) === -1) result.push(hint);
            });
            return result;
        }

        function mergeReferencingElement(merged, incoming, refField) {
            if (!incoming) return merged;
            if (!merged) return Object.assign({}, incoming);
            var result = Object.assign({}, merged);
            result[refField] = unionRefs(merged[refField], incoming[refField]);
            return result;
        }

        function deduplicateSlices(slices) {
            var order = [];
            var byKey = new Map();

            (slices || []).forEach(function(slice, index) {
                var key = slice.id || ('__slice_' + index);
                var merged = byKey.get(key);
                if (!merged) {
                    merged = {
                        id: slice.id || key,
                        name: slice.name || '',
                        border: slice.border || '',
                        trigger: null,
                        command: null,
                        view: null,
                        events: [],
                        tests: []
                    };
                    byKey.set(key, merged);
                    order.push(key);
                }

                if (Object.prototype.hasOwnProperty.call(slice, 'hints')) {
                    if (!Object.prototype.hasOwnProperty.call(merged, 'hints')) merged.hints = [];
                    merged.hints = mergeHints(merged.hints, slice.hints);
                }
                if (!merged.name && slice.name) merged.name = slice.name;
                if (!merged.border && slice.border) merged.border = slice.border;
                merged.trigger = mergeReferencingElement(merged.trigger, slice.trigger, 'views');
                merged.command = mergeReferencingElement(merged.command, slice.command, 'events');
                merged.view = mergeReferencingElement(merged.view, slice.view, 'events');

                (slice.events || []).forEach(function(ev) {
                    if (!merged.events.some(function(e) { return e.id === ev.id; })) {
                        merged.events.push(ev);
                    }
                });
                (slice.tests || []).forEach(function(t) { merged.tests.push(t); });
            });

            return order.map(function(key) { return byKey.get(key); });
        }

        /**
         * Classifies a deduplicated slice into one of the four Event Modeling
         * patterns. Automation/Translation take priority over the generic
         * trigger+command check — those slices also have a trigger and a command,
         * but their identity comes from the trigger's type (see triggers.md).
         */
        function classifySlicePattern(slice) {
            var triggerType = slice.trigger ? String(slice.trigger.type || '').toLowerCase() : '';
            if (triggerType === 'automation') return 'Automation';
            if (triggerType === 'translation') return 'Translation';
            if (slice.trigger && slice.command) return 'State Change';
            if (slice.view) return 'State View';
            if (slice.command) return 'State Change';
            return 'Unclassified';
        }

        /**
         * Maps classifySlicePattern()'s human-readable Title Case (used in the
         * Markdown file) to a stable kebab-case code for the JSON task file —
         * easier for a code-gen tool to match/switch on, and immune to future
         * wording tweaks to the Markdown's human-facing text.
         */
        function patternToCode(pattern) {
            return String(pattern || '')
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-+|-+$/g, '');
        }

        function exportTrigger(trigger) {
            if (!trigger) return null;
            var sourceType = String(trigger.type || '').trim().toLowerCase();
            return {
                swimlane: trigger.swimlane,
                type: sourceType === 'automation' ? 'automation' :
                    sourceType === 'translation' ? 'translation' : 'ui'
            };
        }

        function withoutId(element) {
            if (!element) return null;
            var result = Object.assign({}, element);
            delete result.id;
            return result;
        }

        function withDefaultId(element) {
            if (!element) return element;
            var result = Object.assign({}, element);
            if (!result.id && result.name) result.id = result.name;
            return result;
        }

        function withDefaultIds(elements) {
            return (elements || []).map(withDefaultId);
        }

        function mergeEvents(ownEvents, dependencyEvents) {
            var result = [];
            var seenIds = new Set();
            (ownEvents || []).concat(dependencyEvents || []).forEach(function(event) {
                var eventId = event.id || event.name;
                if (eventId && seenIds.has(eventId)) return;
                if (eventId) seenIds.add(eventId);
                result.push(withDefaultId(event));
            });
            return result;
        }

        /** Builds global id->element maps across ALL deduplicated slices, used to resolve one-hop-back dependencies. */
        function buildGlobalMaps(dedupedSlices) {
            var eventsById = new Map();
            var viewsById = new Map();
            dedupedSlices.forEach(function(slice) {
                (slice.events || []).forEach(function(ev) {
                    var eventId = ev.id || ev.name;
                    if (eventId) eventsById.set(eventId, ev);
                });
                if (slice.view) {
                    var viewId = slice.view.id || slice.view.name;
                    if (viewId) viewsById.set(viewId, slice.view);
                }
            });
            return { eventsById: eventsById, viewsById: viewsById };
        }

        /**
         * Computes this slice's one-hop-back dependencies:
         *   - events feeding its own view (split internal vs external), and
         *   - the view(s) feeding its own trigger.
         * Full element definitions are embedded regardless of which other slice
         * defines them — we don't care where they originate, only that they're
         * available even if the producing slice hasn't been implemented yet.
         * Does not chase dependencies further than one hop (that's the referenced
         * slice's own file's job).
         */
        function computeDependencies(slice, globalMaps) {
            var ownEventIds = new Set((slice.events || []).map(function(e) { return e.id || e.name; }));
            var internalEvents = [];
            var externalEvents = [];
            var seenEventIds = new Set();

            if (slice.view && Array.isArray(slice.view.events)) {
                slice.view.events.forEach(function(refId) {
                    if (ownEventIds.has(refId) || seenEventIds.has(refId)) return;
                    var ev = globalMaps.eventsById.get(refId);
                    if (!ev) return;
                    seenEventIds.add(refId);
                    if (ev.external) externalEvents.push(ev); else internalEvents.push(ev);
                });
            }

            var dependencyViews = [];
            var seenViewIds = new Set();
            if (slice.trigger && Array.isArray(slice.trigger.views)) {
                slice.trigger.views.forEach(function(refId) {
                    if (slice.view && (slice.view.id || slice.view.name) === refId) return; // this slice's own view, not a dependency
                    if (seenViewIds.has(refId)) return;
                    var view = globalMaps.viewsById.get(refId);
                    if (!view) return;
                    seenViewIds.add(refId);
                    dependencyViews.push(view);
                });
            }

            return { internalEvents: internalEvents, externalEvents: externalEvents, dependencyViews: dependencyViews };
        }

        // ----- Markdown rendering helpers -----

        function mdTable(headers, rows) {
            if (!rows || rows.length === 0) return '_None_';
            var lines = ['| ' + headers.join(' | ') + ' |', '| ' + headers.map(function() { return '---'; }).join(' | ') + ' |'];
            rows.forEach(function(row) { lines.push('| ' + row.join(' | ') + ' |'); });
            return lines.join('\n');
        }

        function renderTriggerSection(trigger) {
            if (!trigger) return '';
            var lines = ['## Trigger', ''];
            lines.push('- **Name:** ' + (trigger.name || trigger.id || '_unnamed_'));
            lines.push('- **Type:** ' + (trigger.type || 'ui'));
            if (trigger.swimlane) lines.push('- **Swimlane:** ' + trigger.swimlane);
            lines.push('');
            lines.push('**Properties:**', '', mdTable(['Name', 'Value'], (trigger.properties || []).map(function(p) {
                return [p.name || '', p.value !== undefined ? String(p.value) : ''];
            })));
            if (trigger.buttons && trigger.buttons.length) {
                lines.push('', '- **Buttons:** ' + trigger.buttons.join(', '));
            }
            return lines.join('\n');
        }

        function renderCommandSection(command) {
            if (!command) return '';
            var lines = ['## Command', '', '**' + (command.name || command.id) + '**', ''];
            lines.push('**Properties:**', '', mdTable(['Name', 'Type'], (command.properties || []).map(function(p) {
                return [p.name || '', p.type || ''];
            })));
            if (command.events && command.events.length) {
                lines.push('', '**Produces events:** ' + command.events.join(', '));
            }
            return lines.join('\n');
        }

        function renderEventSubsection(ev, headingLevel) {
            var h = headingLevel || 3;
            var prefix = new Array(h + 1).join('#');
            var lines = [prefix + ' ' + (ev.name || ev.id)];
            if (ev.swimlane) lines.push('- **Swimlane:** ' + ev.swimlane);
            if (ev.external) lines.push('- **External:** yes');
            lines.push('', '**Properties:**', '', mdTable(['Name', 'Type'], (ev.properties || []).map(function(p) {
                return [p.name || '', p.type || ''];
            })));
            return lines.join('\n');
        }

        function renderEventsSection(events) {
            if (!events || events.length === 0) return '';
            var lines = ['## Events', ''];
            events.forEach(function(ev) { lines.push(renderEventSubsection(ev, 3), ''); });
            return lines.join('\n').trim();
        }

        function renderViewSubsection(view, headingLevel) {
            var h = headingLevel || 3;
            var prefix = new Array(h + 1).join('#');
            var lines = [prefix + ' ' + (view.name || view.id)];
            lines.push('', '**Properties:**', '', mdTable(['Name', 'Type'], (view.properties || []).map(function(p) {
                return [p.name || '', p.type || ''];
            })));
            if (view.events && view.events.length) {
                lines.push('', '**Built from events:** ' + view.events.join(', '));
            }
            return lines.join('\n');
        }

        function renderViewSection(view) {
            if (!view) return '';
            return ['## View', '', renderViewSubsection(view, 3)].join('\n');
        }

        function renderDependencySections(deps) {
            var out = [];
            if (deps.internalEvents.length) {
                out.push(['## Depends on Events', '',
                    '_Produced by other slices — full definitions are included here so this slice can be implemented even if the producing slice isn\u2019t implemented yet._',
                    ''].concat(deps.internalEvents.map(function(ev) { return renderEventSubsection(ev, 3); })).join('\n\n'));
            }
            if (deps.externalEvents.length) {
                out.push(['## External Events', '',
                    '_Originate outside this system (integration/webhook events) — not implemented as part of this model._',
                    ''].concat(deps.externalEvents.map(function(ev) { return renderEventSubsection(ev, 3); })).join('\n\n'));
            }
            if (deps.dependencyViews.length) {
                out.push(['## Depends on View', ''].concat(deps.dependencyViews.map(function(v) { return renderViewSubsection(v, 3); })).join('\n\n'));
            }
            return out.join('\n\n');
        }

        function renderHints(hints) {
            if (!Array.isArray(hints) || hints.length === 0) return '';
            return ['## Hints', ''].concat(hints.map(function(hint) {
                return '- ' + hint;
            })).join('\n');
        }

        function renderTestElementRef(ref) {
            if (!ref) return '';
            var label = ref.name || ref.id || '';
            if (ref.properties && ref.properties.length) {
                label += ' (' + ref.properties.map(function(p) { return p.name + '=' + p.value; }).join(', ') + ')';
            }
            return label;
        }

        function renderGivenWhenThenPart(part) {
            var pieces = [];
            if (part.events) pieces.push('events: ' + part.events.map(renderTestElementRef).join('; '));
            if (part.views) pieces.push('views: ' + part.views.map(renderTestElementRef).join('; '));
            if (part.command) pieces.push('command: ' + renderTestElementRef(part.command));
            if (part.error) pieces.push('error: "' + part.error + '"');
            return pieces.join(', ');
        }

        function renderTests(tests) {
            if (!tests || tests.length === 0) return '';
            var lines = ['## Test Cases', ''];
            tests.forEach(function(t, i) {
                lines.push('### ' + (i + 1) + '. ' + (t.name || 'Test ' + (i + 1)));
                if (t.given) lines.push('- **Given:** ' + renderGivenWhenThenPart(t.given));
                if (t.when) lines.push('- **When:** ' + renderGivenWhenThenPart(t.when));
                if (t.then) lines.push('- **Then:** ' + renderGivenWhenThenPart(t.then));
                lines.push('');
            });
            return lines.join('\n').trim();
        }

        /**
         * Builds the Relations section: an authoritative bullet list plus a small
         * Mermaid flowchart for quick visual context. Dependency elements (fed by
         * another slice) are marked "(depended on)"/"(external)" but otherwise
         * treated like any other node — this slice doesn't care where they
         * originate, only that they're fully described.
         */
        function buildRelations(slice, deps) {
            var mermaid = ['flowchart LR'];
            var bullets = [];
            var counter = 0;
            var nodeIdFor = {};

            function ensureNode(key, label) {
                if (!nodeIdFor[key]) {
                    counter++;
                    nodeIdFor[key] = 'N' + counter;
                    mermaid.push('    ' + nodeIdFor[key] + '["' + String(label).replace(/"/g, '\'') + '"]');
                }
                return nodeIdFor[key];
            }

            var triggerKey = null, commandKey = null, viewKey = null;

            if (slice.trigger) {
                triggerKey = 'trigger';
                ensureNode(triggerKey, 'Trigger: ' + (slice.trigger.name || slice.trigger.id || '(unnamed)'));
            }
            if (slice.command) {
                commandKey = 'command';
                ensureNode(commandKey, 'Command: ' + (slice.command.name || slice.command.id));
                if (triggerKey) {
                    mermaid.push('    ' + nodeIdFor[triggerKey] + ' --> ' + nodeIdFor[commandKey]);
                    bullets.push('- Trigger **' + (slice.trigger.name || slice.trigger.id) + '** \u2192 Command **' + (slice.command.name || slice.command.id) + '**');
                }
            }
            (slice.events || []).forEach(function(ev) {
                var key = 'event:' + ev.id;
                ensureNode(key, 'Event: ' + (ev.name || ev.id));
                if (commandKey) {
                    mermaid.push('    ' + nodeIdFor[commandKey] + ' --> ' + nodeIdFor[key]);
                    bullets.push('- Command **' + (slice.command.name || slice.command.id) + '** \u2192 Event **' + (ev.name || ev.id) + '**');
                }
            });
            if (slice.view) {
                viewKey = 'view';
                ensureNode(viewKey, 'View: ' + (slice.view.name || slice.view.id));
            }
            deps.internalEvents.concat(deps.externalEvents).forEach(function(ev) {
                var key = 'depevent:' + ev.id;
                ensureNode(key, 'Event: ' + (ev.name || ev.id) + (ev.external ? ' (external)' : ''));
                if (viewKey) {
                    mermaid.push('    ' + nodeIdFor[key] + ' --> ' + nodeIdFor[viewKey]);
                    bullets.push('- Event **' + (ev.name || ev.id) + '**' + (ev.external ? ' _(external)_' : '') + ' \u2192 View **' + (slice.view.name || slice.view.id) + '** _(depended on)_');
                }
            });
            deps.dependencyViews.forEach(function(v) {
                var key = 'depview:' + v.id;
                ensureNode(key, 'View: ' + (v.name || v.id));
                if (triggerKey) {
                    mermaid.push('    ' + nodeIdFor[key] + ' --> ' + nodeIdFor[triggerKey]);
                    bullets.push('- View **' + (v.name || v.id) + '** \u2192 Trigger **' + (slice.trigger.name || slice.trigger.id) + '** _(depended on)_');
                }
            });

            if (bullets.length === 0) bullets.push('_No relations for this slice._');
            return { bullets: bullets, mermaid: mermaid.join('\n') };
        }

        function buildSliceMarkdown(orderStr, slice, pattern, deps) {
            var lines = [];
            lines.push('# ' + orderStr + '. ' + (slice.name || '(unnamed slice)'));
            lines.push('');
            lines.push('- **State:** ' + (slice.border || '_none_'));
            lines.push('- **Pattern:** ' + pattern);
            lines.push('');

            [renderHints(slice.hints), renderTriggerSection(slice.trigger), renderCommandSection(slice.command),
             renderEventsSection(slice.events), renderViewSection(slice.view),
             renderDependencySections(deps), renderTests(slice.tests)].forEach(function(section) {
                if (section) lines.push(section, '');
            });

            var relations = buildRelations(slice, deps);
            lines.push('## Relations', '');
            lines.push(relations.bullets.join('\n'));
            lines.push('', '```mermaid', relations.mermaid, '```', '');

            return lines.join('\n').trim() + '\n';
        }

        function buildIndexMarkdown(title, entries) {
            var lines = ['# ' + (title || 'Event Model') + ' \u2014 Task Index', '',
                '| Order | File | Slice | Pattern | State |', '| --- | --- | --- | --- | --- |'];
            entries.forEach(function(e) {
                lines.push('| ' + e.order + ' | [' + e.fileName + '](' + e.fileName + ') | ' + e.name + ' | ' + e.pattern + ' | ' + (e.state || '_none_') + ' |');
            });
            return lines.join('\n') + '\n';
        }

        function buildSliceJson(slice, pattern, deps) {
            var json = {
                schemaVersion: TASK_JSON_SCHEMA_VERSION,
                name: slice.name || '',
                state: slice.border || '',
                pattern: patternToCode(pattern),
                trigger: exportTrigger(slice.trigger),
                command: withoutId(slice.command),
                view: withDefaultId(slice.view),
                events: mergeEvents(slice.events, deps.internalEvents),
                externalEvents: withDefaultIds(deps.externalEvents),
                views: withDefaultIds(deps.dependencyViews),
                tests: slice.tests || []
            };
            if (!slice.trigger) delete json.trigger;
            if (Object.prototype.hasOwnProperty.call(slice, 'hints')) {
                json.hints = slice.hints.slice();
            }
            return json;
        }

        function buildIndexJson(title, entries) {
            return {
                schemaVersion: TASK_JSON_SCHEMA_VERSION,
                title: title || 'Event Model',
                slices: entries.map(function(e) {
                    return {
                        name: e.name,
                        pattern: patternToCode(e.pattern),
                        state: e.state || '',
                        files: { markdown: e.fileNameMd, json: e.fileNameJson }
                    };
                })
            };
        }

        /**
         * Main entry point: turns an enriched event model (from MODEL_CHANGED) into
         * the full list of files to write — index.md + index.json plus, per
         * deduplicated slice in order, a paired NNN-slicename.md (for humans/agents
         * to read) and NNN-slicename.json (same information, structured for a
         * code-gen tool to consume).
         */
        function generateExportFiles(model) {
            var dedupedSlices = deduplicateSlices(model.slices);
            var globalMaps = buildGlobalMaps(dedupedSlices);
            var width = Math.max(3, String(dedupedSlices.length).length);
            var files = [];
            var indexEntries = [];

            dedupedSlices.forEach(function(slice, i) {
                var order = i + 1;
                var orderStr = padOrder(order, width);
                var pattern = classifySlicePattern(slice);
                var deps = computeDependencies(slice, globalMaps);
                var baseName = orderStr + '-' + sanitizeSliceName(slice.name);
                var fileNameMd = baseName + '.md';
                var fileNameJson = baseName + '.json';

                files.push({ name: fileNameMd, content: buildSliceMarkdown(orderStr, slice, pattern, deps) });

                var json = buildSliceJson(slice, pattern, deps);
                files.push({ name: fileNameJson, content: JSON.stringify(json, null, 2) + '\n' });

                indexEntries.push({
                    order: order, orderStr: orderStr, id: slice.id, name: slice.name || '(unnamed)', pattern: pattern, state: slice.border,
                    fileNameMd: fileNameMd, fileNameJson: fileNameJson
                });
            });

            files.unshift({ name: 'index.json', content: JSON.stringify(buildIndexJson(model.title, indexEntries), null, 2) + '\n' });
            files.unshift({ name: 'index.md', content: buildIndexMarkdown(model.title, indexEntries.map(function(e) {
                return { order: e.orderStr, fileName: e.fileNameMd, name: e.name, pattern: e.pattern, state: e.state };
            })) });
            return files;
        }

        // ----- DOM / EventBus wiring -----

        var _currentModel = null;

        EventBus.on(Events.MODEL_CHANGED, function(payload) {
            _currentModel = payload ? payload.model : null;
        });

        function baseUrl() {
            return window.location.origin;
        }

        var exportTasksBtn = document.getElementById('exportTasksBtn');

        // The modal is appended directly to <body> (not left inside the toolbar),
        // because the toolbar uses `backdrop-filter`, which creates a new containing
        // block for `position: fixed` descendants and would confine the overlay to
        // the toolbar's own height instead of covering the viewport (same reasoning
        // as the root folder-browser modal in folder-browser-server.js).
        var exportOverlay = document.createElement('div');
        exportOverlay.className = 'export-folder-browser-overlay';
        exportOverlay.innerHTML = `
            <div class="export-folder-browser-modal">
                <h2>Export as Tasks — Select Destination Folder</h2>
                <div class="export-folder-browser-path" id="exportFolderBrowserPath"></div>
                <div class="export-folder-browser-list" id="exportFolderBrowserList"></div>
                <div class="export-folder-browser-error" id="exportFolderBrowserError"></div>
                <div class="export-folder-browser-actions">
                    <button id="exportFolderBrowserCancel">Cancel</button>
                    <button id="exportFolderBrowserSelect">Export Here</button>
                </div>
            </div>
        `;
        document.body.appendChild(exportOverlay);

        var exportPathEl = exportOverlay.querySelector('#exportFolderBrowserPath');
        var exportListEl = exportOverlay.querySelector('#exportFolderBrowserList');
        var exportErrorEl = exportOverlay.querySelector('#exportFolderBrowserError');
        var exportCancelBtn = exportOverlay.querySelector('#exportFolderBrowserCancel');
        var exportSelectBtn = exportOverlay.querySelector('#exportFolderBrowserSelect');

        var _exportBrowsePath = null; // folder currently shown in the browser ("" = drive list)
        var EXPORT_LAST_FOLDER_KEY = 'exportTasksLastFolder';

        function openExportFolderBrowser() {
            exportErrorEl.textContent = '';
            exportOverlay.classList.add('visible');
            var lastFolder = localStorage.getItem(EXPORT_LAST_FOLDER_KEY) || '';
            browseExportTo(lastFolder, /*fallbackToRootOnError*/ true);
        }

        function closeExportFolderBrowser() {
            exportOverlay.classList.remove('visible');
        }

        async function browseExportTo(browsePath, fallbackToRootOnError) {
            try {
                const res = await fetch(`${baseUrl()}/root/browse?path=${encodeURIComponent(browsePath)}`);
                if (!res.ok) {
                    // Remembered folder may no longer exist (moved/deleted/different
                    // machine) — fall back to the drive list instead of erroring out.
                    if (fallbackToRootOnError && browsePath !== '') {
                        browseExportTo('', false);
                        return;
                    }
                    exportErrorEl.textContent = 'Could not browse that folder.';
                    return;
                }
                const data = await res.json();
                renderExportFolderBrowser(data);
            } catch (e) {
                if (fallbackToRootOnError && browsePath !== '') {
                    browseExportTo('', false);
                    return;
                }
                exportErrorEl.textContent = 'Error browsing folder: ' + e.message;
            }
        }

        function renderExportFolderBrowser(data) {
            exportErrorEl.textContent = '';
            _exportBrowsePath = data.path;
            exportPathEl.textContent = data.path === '' ? 'This PC' : data.path;
            exportListEl.innerHTML = '';

            if (data.parent !== null) {
                const up = document.createElement('div');
                up.className = 'export-folder-browser-item export-folder-browser-up';
                up.textContent = '⬆ .. (Up)';
                up.addEventListener('click', () => browseExportTo(data.parent));
                exportListEl.appendChild(up);
            }

            data.folders.forEach(f => {
                const item = document.createElement('div');
                item.className = 'export-folder-browser-item';
                item.textContent = '📁 ' + f.name;
                item.addEventListener('click', () => browseExportTo(f.path));
                exportListEl.appendChild(item);
            });

            exportSelectBtn.disabled = data.path === '';
        }

        exportTasksBtn.addEventListener('click', () => {
            if (!_currentModel || !_currentModel.slices || _currentModel.slices.length === 0) {
                alert('No event model loaded to export.');
                return;
            }
            openExportFolderBrowser();
        });

        exportCancelBtn.addEventListener('click', closeExportFolderBrowser);

        exportSelectBtn.addEventListener('click', async () => {
            if (!_exportBrowsePath || !_currentModel) return;
            const files = generateExportFiles(_currentModel);
            try {
                const res = await fetch(`${baseUrl()}/export`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ path: _exportBrowsePath, files })
                });
                if (!res.ok) {
                    const msg = await res.text();
                    exportErrorEl.textContent = 'Export failed: ' + msg;
                    return;
                }
                const data = await res.json();
                closeExportFolderBrowser();
                localStorage.setItem(EXPORT_LAST_FOLDER_KEY, _exportBrowsePath);
                alert('Wrote ' + data.written.length + ' file(s) to ' + _exportBrowsePath);
            } catch (e) {
                exportErrorEl.textContent = 'Error exporting: ' + e.message;
            }
        });
