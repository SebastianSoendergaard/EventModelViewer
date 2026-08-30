        const diagramElement = document.getElementById('diagram');
        const diagramContainer = document.getElementById('diagramContainer');
        const diagramWrapper = document.getElementById('diagramWrapper');

        // Local state — updated via EventBus
        // diagram.js consumes the enriched model emitted by event-model.js via MODEL_CHANGED.
        // It no longer subscribes to FILE_LOADED / JSON_CHANGED directly.
        let _model = null;
        const _filters = { slices: true, tests: true, types: true, swimlanes: true };

        // Subscribe to events
        EventBus.on(Events.MODEL_CHANGED, ({ model }) => {
            _model = model;
            if (model) {
                renderDiagram(model);
            } else {
                diagramElement.innerHTML = '<div class="placeholder">Create or load an event model to visualize</div>';
            }
        });

        EventBus.on(Events.FILTER_TOGGLED, ({ type, checked }) => {
            _filters[type] = checked;
            if (type === 'swimlanes') {
                // Swimlanes require full re-render
                if (_model) renderDiagram(_model);
            } else if (type === 'slices') {
                toggleSliceBorders(checked);
            } else if (type === 'tests') {
                // Always re-render diagram when toggling tests to ensure arrows and layout are correct
                if (_model) renderDiagram(_model);
            } else if (type === 'types') {
                toggleTypes(checked);
            }
        });

        // Mouse drag to pan — remove from here, handled in zoom-export.js
        function toggleSliceBorders(show) {
            const borders = document.querySelectorAll('.slice-border');
            borders.forEach(border => {
                border.style.display = show ? 'block' : 'none';
            });
        }

        function toggleTests(show) {
            const testsContainers = document.querySelectorAll('.tests-container');
            testsContainers.forEach(container => {
                if (show) {
                    container.classList.remove('hidden');
                } else {
                    container.classList.add('hidden');
                }
            });
        }

        function toggleTypes(show) {
            const propertyElements = document.querySelectorAll('.element-property');
            propertyElements.forEach(prop => {
                // Skip trigger properties - they don't have types
                if (prop.hasAttribute('data-trigger-property')) {
                    return;
                }
                
                // Store original content if not already stored
                if (!prop.hasAttribute('data-original-content')) {
                    prop.setAttribute('data-original-content', prop.textContent);
                }
                
                const originalContent = prop.getAttribute('data-original-content');
                const colonIndex = originalContent.indexOf(':');
                
                if (colonIndex !== -1) {
                    if (show) {
                        prop.textContent = originalContent;
                    } else {
                        const name = originalContent.substring(0, colonIndex);
                        prop.textContent = name;
                    }
                }
            });
        }

        function renderDiagram(model) {
            try {
                const html = generateEventModelDiagram(model);
                diagramElement.innerHTML = html;
                drawAllArrows();
                
                // Apply current filter states
                toggleSliceBorders(_filters.slices);
                toggleTests(_filters.tests);
                toggleTypes(_filters.types);
            } catch (error) {
                showError('Error rendering diagram: ' + error.message);
            }
        }

        // Helper function: Find event elements by ID or name.
        // All events from the enriched model have a data-event-id when they have a name,
        // so ID matching is reliable. Name fallback handles references that use raw names.
        function findEventElements(eventIdentifier) {
            // First try to find by ID (exact match)
            let elements = Array.from(document.querySelectorAll('.element.event[data-event-id]'))
                .filter(el => el.getAttribute('data-event-id') === eventIdentifier);

            // If not found by ID, fall back to name match
            if (elements.length === 0) {
                elements = Array.from(document.querySelectorAll('.element.event[data-event-name]'))
                    .filter(el => el.getAttribute('data-event-name') === eventIdentifier);
            }

            // Return elements with their slice indices
            return elements.map(el => ({
                element: el,
                sliceIndex: parseInt(el.getAttribute('data-slice-index'))
            }));
        }

        // Helper function: Select nearest preceding event
        function selectNearestPrecedingEvent(eventMatches, referenceSliceIndex) {
            const preceding = eventMatches.filter(m => m.sliceIndex < referenceSliceIndex);
            if (preceding.length === 0) return null;
            // Return the last one (highest slice index before reference)
            return preceding.reduce((max, current) => 
                current.sliceIndex > max.sliceIndex ? current : max
            );
        }

        // Helper function: Select nearest subsequent event
        function selectNearestSubsequentEvent(eventMatches, referenceSliceIndex) {
            const subsequent = eventMatches.filter(m => m.sliceIndex > referenceSliceIndex);
            if (subsequent.length === 0) return null;
            // Return the first one (lowest slice index after reference)
            return subsequent.reduce((min, current) => 
                current.sliceIndex < min.sliceIndex ? current : min
            );
        }

        // Helper function: Find view elements by ID or name
        function findViewElements(viewIdentifier) {
            // First try to find by data-view-id
            let elements = Array.from(document.querySelectorAll('.element.view[data-view-id]'))
                .filter(el => el.getAttribute('data-view-id') === viewIdentifier);
            
            // If not found by id, try by name
            if (elements.length === 0) {
                elements = Array.from(document.querySelectorAll('.element.view[data-view-name]'))
                    .filter(el => el.getAttribute('data-view-name') === viewIdentifier);
            }
            
            return elements.map(el => {
                const cell = el.closest('.grid-cell[data-slice-index]');
                return {
                    element: el,
                    sliceIndex: cell ? parseInt(cell.getAttribute('data-slice-index')) : -1
                };
            });
        }

        // Helper function: Select nearest preceding view
        function selectNearestPrecedingView(viewMatches, referenceSliceIndex) {
            // Same-slice view takes priority over any preceding view
            const sameSlice = viewMatches.find(m => m.sliceIndex === referenceSliceIndex);
            if (sameSlice) return sameSlice;
            // Otherwise pick the nearest preceding (highest sliceIndex < reference)
            const preceding = viewMatches.filter(m => m.sliceIndex < referenceSliceIndex);
            if (preceding.length === 0) return null;
            return preceding.reduce((max, current) =>
                current.sliceIndex > max.sliceIndex ? current : max
            );
        }

        function drawAllArrows() {
            // Remove existing SVG if any
            const existingSvg = document.getElementById('arrow-svg');
            if (existingSvg) {
                existingSvg.remove();
            }

            // Reset per-arrow marker counter
            _arrowCounter = 0;

            const diagramDiv = document.querySelector('.event-model-diagram');
            if (!diagramDiv) return;

            // If tests are hidden, temporarily hide test rows for arrow calculations
            const testsHidden = !_filters.tests;
            let hiddenTestCells = [];
            if (testsHidden) {
                hiddenTestCells = Array.from(document.querySelectorAll('.grid-cell.test-cell'));
                hiddenTestCells.forEach(cell => cell.style.display = 'none');
            }

            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('id', 'arrow-svg');
            svg.style.position = 'absolute';
            svg.style.top = '0';
            svg.style.left = '0';
            svg.style.width = '100%';
            svg.style.height = '100%';
            // Allow pointer events on child paths (hit areas) while background is transparent
            svg.style.pointerEvents = 'none';
            svg.style.zIndex = '1';

            diagramDiv.style.position = 'relative';
            diagramDiv.appendChild(svg);

            // Defs — per-arrow markers will be added dynamically in drawArrow()
            const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
            svg.appendChild(defs);

            // Draw all connections
            const sliceElements = document.querySelectorAll('.grid-cell[data-slice-index]');

            // Restore test cell display after drawing arrows
            if (testsHidden) {
                setTimeout(() => {
                    hiddenTestCells.forEach(cell => cell.style.display = '');
                }, 0);
            }
            const slicesByIndex = new Map();
            
            // Group cells by slice index
            sliceElements.forEach(cell => {
                const sliceIndex = parseInt(cell.getAttribute('data-slice-index'));
                if (!slicesByIndex.has(sliceIndex)) {
                    slicesByIndex.set(sliceIndex, []);
                }
                slicesByIndex.get(sliceIndex).push(cell);
            });
            
            // Process each slice
            slicesByIndex.forEach((cells, sliceIndex) => {
                // Find elements within this slice's cells
                let trigger = null;
                let command = null;
                let view = null;
                const events = [];
                
                cells.forEach(cell => {
                    const triggerEl = cell.querySelector('.element.trigger');
                    const commandEl = cell.querySelector('.element.command');
                    const viewEl = cell.querySelector('.element.view');
                    const eventEls = cell.querySelectorAll('.element.event');
                    
                    if (triggerEl) trigger = triggerEl;
                    if (commandEl) command = commandEl;
                    if (viewEl) view = viewEl;
                    eventEls.forEach(e => events.push(e));
                });

                // Trigger -> Command
                if (trigger && command) {
                    drawArrow(svg, trigger, command, diagramDiv, 'bottom', 'top');
                }

                // Command -> Events (only events listed in command.events array)
                if (command) {
                    const commandEventsAttr = command.getAttribute('data-command-events');
                    if (commandEventsAttr && commandEventsAttr.trim()) {
                        // All entries are canonical ids (pre-resolved by event-model.js)
                        const commandEventIds = commandEventsAttr.split(',').map(n => n.trim()).filter(Boolean);
                        commandEventIds.forEach(eventId => {
                            const matchingEvents = Array.from(events).filter(event =>
                                event.getAttribute('data-event-id') === eventId
                            );
                            matchingEvents.forEach(event => {
                                drawArrow(svg, command, event, diagramDiv, 'bottom', 'top');
                            });
                        });
                    } else if (events.length > 0) {
                        // No explicit event list — connect to all events in slice
                        events.forEach(event => {
                            drawArrow(svg, command, event, diagramDiv, 'bottom', 'top');
                        });
                    }
                }

                // Event -> Trigger arrow drawing removed (trigger.events no longer in spec)
            });

            // Event -> View (across slices)
            const views = document.querySelectorAll('.element.view[data-view-events]');
            views.forEach(view => {
                const viewCell = view.closest('.grid-cell');
                if (!viewCell) return;
                const viewSliceIndex = parseInt(viewCell.getAttribute('data-slice-index'));
                const eventNames = view.getAttribute('data-view-events');
                if (!eventNames) return;

                const eventNameList = eventNames.split(',').filter(n => n.trim());
                
                eventNameList.forEach(eventIdentifier => {
                    const eventMatches = findEventElements(eventIdentifier);
                    if (eventMatches.length === 0) {
                        console.warn(`View references event "${eventIdentifier}" but no matching event found`);
                        return;
                    }

                    let selectedMatch = null;
                    let isDashed = false;

                    // First, check for events in the SAME slice
                    const sameSliceEvents = eventMatches.filter(m => m.sliceIndex === viewSliceIndex);
                    if (sameSliceEvents.length > 0) {
                        // Use first same-slice event
                        selectedMatch = sameSliceEvents[0];
                        isDashed = false; // Same-slice event->view should be solid (not past)
                    } else {
                        // Try to find nearest preceding event
                        selectedMatch = selectNearestPrecedingEvent(eventMatches, viewSliceIndex);

                        // If no preceding, use nearest subsequent with dashed arrow
                        if (!selectedMatch) {
                            selectedMatch = selectNearestSubsequentEvent(eventMatches, viewSliceIndex);
                            isDashed = true;
                        }
                    }


                    if (selectedMatch) {
                        // For same-slice, always exit from top
                        if (sameSliceEvents.length > 0) {
                            drawArrow(svg, selectedMatch.element, view, diagramDiv, 'top', 'bottom', isDashed);
                        } else if (isDashed) {
                            // Event is after the view — exit from the side closest to the view
                            const eventRect = selectedMatch.element.getBoundingClientRect();
                            const viewRect = view.getBoundingClientRect();
                            const fromSide = eventRect.left > viewRect.right ? 'left' : 'right';
                            drawArrow(svg, selectedMatch.element, view, diagramDiv, fromSide, 'bottom', isDashed);
                        } else {
                            drawArrow(svg, selectedMatch.element, view, diagramDiv, 'top', 'bottom', isDashed);
                        }
                    }
                });
            });

            // View -> Trigger (driven by trigger.views references)
            const triggers = document.querySelectorAll('.element.trigger[data-trigger-views]');
            triggers.forEach(trigger => {
                const triggerViewsAttr = trigger.getAttribute('data-trigger-views');
                if (!triggerViewsAttr || !triggerViewsAttr.trim()) return;

                const triggerCell = trigger.closest('.grid-cell[data-slice-index]');
                if (!triggerCell) return;
                const triggerSliceIndex = parseInt(triggerCell.getAttribute('data-slice-index'));

                const viewIdList = triggerViewsAttr.split(',').map(s => s.trim()).filter(Boolean);
                viewIdList.forEach(viewIdentifier => {
                    const viewMatches = findViewElements(viewIdentifier);
                    if (viewMatches.length === 0) {
                        console.warn(`Trigger references view "${viewIdentifier}" but no matching view found`);
                        return;
                    }

                    // Use nearest preceding view
                    const selectedMatch = selectNearestPrecedingView(viewMatches, triggerSliceIndex);
                    if (!selectedMatch) return;

                    const viewEl = selectedMatch.element;
                    const viewRect = viewEl.getBoundingClientRect();
                    const triggerRect = trigger.getBoundingClientRect();
                    // If view and trigger are in the same slice, exit view from top and enter trigger from bottom
                    let fromSide = 'top', toSide = viewRect.left < triggerRect.left ? 'left' : 'right';
                    if (selectedMatch.sliceIndex === triggerSliceIndex) {
                        fromSide = 'top';
                        toSide = 'bottom';
                    }
                    drawArrow(svg, viewEl, trigger, diagramDiv, fromSide, toSide);
                });
            });
        }

        // Counter for unique per-arrow marker IDs
        let _arrowCounter = 0;

        function drawArrow(svg, fromElement, toElement, container, fromSide = 'bottom', toSide = 'top', isDashed = false) {
            const fromRect = fromElement.getBoundingClientRect();
            const toRect = toElement.getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();
            const wrapperRect = diagramWrapper.getBoundingClientRect();

            // Account for zoom and scroll offset — read scale from the wrapper's CSS transform
            const transformVal = diagramWrapper.style.transform;
            const scale = transformVal ? parseFloat(transformVal.replace('scale(', '')) || 1 : 1;
            const offsetX = (wrapperRect.left - containerRect.left) / scale;
            const offsetY = (wrapperRect.top - containerRect.top) / scale;

            // Calculate start point based on fromSide (in unscaled coordinates)
            let startX, startY;
            switch (fromSide) {
                case 'top':
                    startX = (fromRect.left - wrapperRect.left) / scale + (fromRect.width / scale) / 2 + offsetX;
                    startY = (fromRect.top - wrapperRect.top) / scale + offsetY;
                    break;
                case 'bottom':
                    startX = (fromRect.left - wrapperRect.left) / scale + (fromRect.width / scale) / 2 + offsetX;
                    startY = (fromRect.bottom - wrapperRect.top) / scale + offsetY;
                    break;
                case 'left':
                    startX = (fromRect.left - wrapperRect.left) / scale + offsetX;
                    startY = (fromRect.top - wrapperRect.top) / scale + (fromRect.height / scale) / 2 + offsetY;
                    break;
                case 'right':
                    startX = (fromRect.right - wrapperRect.left) / scale + offsetX;
                    startY = (fromRect.top - wrapperRect.top) / scale + (fromRect.height / scale) / 2 + offsetY;
                    break;
            }

            // Calculate end point based on toSide (in unscaled coordinates)
            let endX, endY;
            switch (toSide) {
                case 'top':
                    endX = (toRect.left - wrapperRect.left) / scale + (toRect.width / scale) / 2 + offsetX;
                    endY = (toRect.top - wrapperRect.top) / scale + offsetY;
                    break;
                case 'bottom':
                    endX = (toRect.left - wrapperRect.left) / scale + (toRect.width / scale) / 2 + offsetX;
                    endY = (toRect.bottom - wrapperRect.top) / scale + offsetY;
                    break;
                case 'left':
                    endX = (toRect.left - wrapperRect.left) / scale + offsetX;
                    endY = (toRect.top - wrapperRect.top) / scale + (toRect.height / scale) / 2 + offsetY;
                    break;
                case 'right':
                    endX = (toRect.right - wrapperRect.left) / scale + offsetX;
                    endY = (toRect.top - wrapperRect.top) / scale + (toRect.height / scale) / 2 + offsetY;
                    break;
            }

            // Straight-line threshold: if start and end are within 1px on an axis, draw straight
            const STRAIGHT_THRESHOLD = 1;
            const isVerticallyAligned = Math.abs(startX - endX) < STRAIGHT_THRESHOLD;
            const isHorizontallyAligned = Math.abs(startY - endY) < STRAIGHT_THRESHOLD;

            // Choose curve based on direction
            let d;
            if (isVerticallyAligned || isHorizontallyAligned) {
                // Straight line — elements are aligned on the same axis
                d = `M ${startX} ${startY} L ${endX} ${endY}`;
            } else if ((fromSide === 'bottom' && toSide === 'top') || (fromSide === 'top' && toSide === 'bottom')) {
                // Vertical connection — cubic Bezier
                const midY = (startY + endY) / 2;
                d = `M ${startX} ${startY} C ${startX} ${midY}, ${endX} ${midY}, ${endX} ${endY}`;
            } else if ((fromSide === 'right' && toSide === 'left') || (fromSide === 'left' && toSide === 'right')) {
                // Horizontal connection — cubic Bezier
                const midX = (startX + endX) / 2;
                d = `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`;
            } else {
                // Mixed connection — quadratic Bezier with a non-collinear control point
                const fromIsHorizontal = fromSide === 'left' || fromSide === 'right';
                const toIsHorizontal = toSide === 'left' || toSide === 'right';
                const controlX = fromIsHorizontal && !toIsHorizontal ? endX : startX;
                const controlY = fromIsHorizontal && !toIsHorizontal ? startY : endY;
                d = `M ${startX} ${startY} Q ${controlX} ${controlY}, ${endX} ${endY}`;
            }

            // Create per-arrow arrowhead marker using context-stroke so it follows stroke color
            // Arrowhead size: normal or highlighted
            let arrowheadSize = 20;
            let arrowheadRefX = 18;
            let arrowheadRefY = 6;
            let arrowheadPoints = '0 0, 20 6, 0 12';
            // If highlighted, double the size
            let isHighlighted = false;
            // We'll update this later if the arrow is selected
            const markerId = `arrowhead-${_arrowCounter++}`;
            const defs = svg.querySelector('defs');
            const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
            marker.setAttribute('id', markerId);
            marker.setAttribute('markerWidth', String(arrowheadSize));
            marker.setAttribute('markerHeight', String(arrowheadSize));
            marker.setAttribute('refX', String(arrowheadRefX));
            marker.setAttribute('refY', String(arrowheadRefY));
            marker.setAttribute('orient', 'auto');
            marker.setAttribute('markerUnits', 'userSpaceOnUse');
            const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
            polygon.setAttribute('points', arrowheadPoints);
            polygon.setAttribute('fill', 'context-stroke');
            marker.appendChild(polygon);
            defs.appendChild(marker);

            // Visible arrow path
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', d);
            path.setAttribute('stroke', 'black');
            path.setAttribute('stroke-width', '2');
            path.setAttribute('fill', 'none');
            if (isDashed) {
                path.setAttribute('stroke-dasharray', '5,5');
            }
            path.setAttribute('marker-end', `url(#${markerId})`);

            // Invisible wide hit-area path for easier mouse interaction.
            // Marked with "arrow-hitarea" so PNG/SVG export can strip it — html2canvas
            // (and some static SVG viewers) mis-render stroke="transparent" as an opaque
            // gray blob instead of invisible, which showed up as phantom "shadow" boxes
            // behind command/event elements with many overlapping outgoing arrows.
            const hitPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            hitPath.setAttribute('d', d);
            hitPath.setAttribute('class', 'arrow-hitarea');
            hitPath.setAttribute('stroke', 'transparent');
            hitPath.setAttribute('stroke-width', '12');
            hitPath.setAttribute('fill', 'none');
            hitPath.style.cursor = 'pointer';
            hitPath.style.pointerEvents = 'stroke';

            // Highlight helpers
            function highlight() {
                path.setAttribute('stroke', '#0066cc');
                path.setAttribute('stroke-width', '6');
                // Double the arrowhead size when highlighted
                const marker = svg.querySelector(`#${markerId}`);
                if (marker) {
                    marker.setAttribute('markerWidth', '40');
                    marker.setAttribute('markerHeight', '40');
                    marker.setAttribute('refX', '36');
                    marker.setAttribute('refY', '12');
                    const polygon = marker.querySelector('polygon');
                    if (polygon) polygon.setAttribute('points', '0 0, 40 12, 0 24');
                }
            }
            function unhighlight() {
                const isSelected = hitPath.getAttribute('data-selected') === 'true';
                if (!isSelected) {
                    path.setAttribute('stroke', 'black');
                    path.setAttribute('stroke-width', '2');
                    // Restore normal arrowhead size
                    const marker = svg.querySelector(`#${markerId}`);
                    if (marker) {
                        marker.setAttribute('markerWidth', '20');
                        marker.setAttribute('markerHeight', '20');
                        marker.setAttribute('refX', '18');
                        marker.setAttribute('refY', '6');
                        const polygon = marker.querySelector('polygon');
                        if (polygon) polygon.setAttribute('points', '0 0, 20 6, 0 12');
                    }
                }
            }

            hitPath.addEventListener('mouseover', () => {
                highlight();
            });
            hitPath.addEventListener('mouseout', () => {
                unhighlight();
            });
            hitPath.addEventListener('click', (e) => {
                e.stopPropagation();
                const isSelected = hitPath.getAttribute('data-selected') === 'true';
                if (isSelected) {
                    // Deselect
                    hitPath.setAttribute('data-selected', 'false');
                    path.setAttribute('stroke', 'black');
                    path.setAttribute('stroke-width', '2');
                } else {
                    // Deselect previously selected arrow
                    const prevSelected = svg.querySelector('path[data-selected="true"]');
                    if (prevSelected) {
                        prevSelected.setAttribute('data-selected', 'false');
                        const prevPath = prevSelected.previousElementSibling;
                        if (prevPath) {
                            prevPath.setAttribute('stroke', 'black');
                            prevPath.setAttribute('stroke-width', '2');
                        }
                    }
                    // Select this arrow
                    hitPath.setAttribute('data-selected', 'true');
                    highlight();
                }
            });

            svg.appendChild(path);
            svg.appendChild(hitPath);
        }

        // Redraw arrows on window resize
        window.addEventListener('resize', () => {
            if (document.querySelector('.event-model-diagram')) {
                drawAllArrows();
            }
        });

        // ===== GRID LAYOUT HELPERS =====
        // Swimlane discovery has moved to src/event-model/event-model.js.
        // These helpers convert the pre-computed model.swimlanes arrays into
        // CSS grid row mappings used during rendering.
        
        /**
         * Builds a grid map with row indices for each lane
         * @param {Array} triggerLanes - Array of trigger lane objects
         * @param {Array} eventLanes - Array of event lane objects
         * @returns {Object} { sliceHotspotsRow: number|null, triggerRowMap: Map, commandViewRow: number, eventRowMap: Map, testRow: number, totalRows: number }
         */
        function buildGridMap(triggerLanes, eventLanes, hasSliceHotspots) {
            const triggerRowMap = new Map();
            const eventRowMap = new Map();
            
            let currentRow = 2; // Row 1 is for slice headers, start lanes at row 2
            const sliceHotspotsRow = hasSliceHotspots ? currentRow++ : null;
            
            // Map trigger lanes to rows
            triggerLanes.forEach((lane, index) => {
                const key = getLaneKey(lane);
                triggerRowMap.set(key, currentRow);
                currentRow++;
            });
            
            // Command/View row
            const commandViewRow = currentRow;
            currentRow++;
            
            // Map event lanes to rows
            eventLanes.forEach((lane, index) => {
                const key = getLaneKey(lane);
                eventRowMap.set(key, currentRow);
                currentRow++;
            });
            
            // Test row
            const testRow = currentRow;
            currentRow++;
            
            return {
                triggerRowMap,
                sliceHotspotsRow,
                commandViewRow,
                eventRowMap,
                testRow,
                totalRows: currentRow
            };
        }

        /**
         * Gets a unique key for a lane object
         */
        function getLaneKey(lane) {
            if (lane.type === 'role') return `role:${lane.role}`;
            if (lane.type === 'system') return `system:${lane.system}`;
            if (lane.type === 'no-role') return 'no-role';
            if (lane.type === 'no-system') return 'no-system';
            if (lane.type === 'all') return 'all';
            return 'unknown';
        }

        /**
         * Determines which trigger lane a trigger belongs to
         */
        function getTriggerLaneKey(trigger, showSwimlanes) {
            if (!showSwimlanes) return 'all';
            if (!trigger) return 'no-role';
            if (trigger.swimlane && trigger.swimlane.trim()) {
                return `role:${trigger.swimlane}`;
            }
            return 'no-role';
        }

        /**
         * Determines which event lane an event belongs to
         */
        function getEventLaneKey(event, showSwimlanes) {
            if (!showSwimlanes) return 'all';
            if (!event) return 'no-system';
            // enrichEvent() guarantees all external events have a swimlane name.
            // Lane placement is driven by swimlane name alone — not the external flag.
            if (event.swimlane && event.swimlane.trim()) {
                return `system:${event.swimlane}`;
            }
            return 'no-system';
        }

        // ===== END GRID LAYOUT HELPERS =====

        function generateHotspot(hotspot) {
            return `<div class="element hotspot"><div class="element-title">${escapeHtml(hotspot)}</div></div>`;
        }

        function generateHotspotGroup(hotspots, className) {
            return `<div class="${className}">${hotspots.map(generateHotspot).join('')}</div>`;
        }

        function generateEventModelDiagram(model) {
            if (!model.slices || !Array.isArray(model.slices)) {
                return '<div class="info-message">Invalid event model: slices array is required</div>';
            }

            const showSwimlanes = _filters.swimlanes;
            
            // Use pre-computed swimlanes from enriched model; fall back to single-lane when hidden
            const triggerLanes = showSwimlanes ? model.swimlanes.trigger : [{ type: 'all', label: 'All Triggers' }];
            const eventLanes   = showSwimlanes ? model.swimlanes.event   : [{ type: 'all', label: 'All Events' }];
            const hasSliceHotspots = model.slices.some(slice => Array.isArray(slice.hotspots) && slice.hotspots.length > 0);
            const gridMap = buildGridMap(triggerLanes, eventLanes, hasSliceHotspots);
            
            const numSlices = model.slices.length;
            const swimlanesClass = showSwimlanes ? '' : 'swimlanes-hidden';
            
            let html = '<div class="event-model-diagram">';
            
            if (model.title) {
                html += `<div class="diagram-title">${escapeHtml(model.title)}</div>`;
            }

            if (Array.isArray(model.hotspots) && model.hotspots.length > 0) {
                const alignmentClass = showSwimlanes ? ' model-hotspots--swimlane-aligned' : '';
                html += generateHotspotGroup(model.hotspots, `model-hotspots${alignmentClass}`);
            }

            // Build CSS Grid
            const numCols = showSwimlanes ? numSlices + 1 : numSlices; // +1 for lane header column
            const gridTemplateColumns = showSwimlanes 
                ? `var(--swimlane-label-width) repeat(${numSlices}, minmax(240px, max-content))`
                : `repeat(${numSlices}, minmax(240px, max-content))`;
            
            html += `<div class="swimlane-grid ${swimlanesClass}" style="grid-template-columns: ${gridTemplateColumns};">`;
            
            model.slices.forEach((slice, sliceIndex) => {
                const colNum = showSwimlanes ? sliceIndex + 2 : sliceIndex + 1;
                const hasBorder = slice.border ? 'with-border' : '';
                const borderColor = slice.border || '';
                const borderStyle = slice.border ? `border-color: ${slice.border};` : '';
                html += `<div class="grid-cell slice-header ${hasBorder}" style="grid-column: ${colNum}; grid-row: 1; ${borderStyle}" data-slice-border-color="${borderColor}">`;
                if (slice.name) {
                    html += escapeHtml(slice.name);
                }
                html += `</div>`;
            });
            
            // Slice border overlays (span full column including tests)
            model.slices.forEach((slice, sliceIndex) => {
                if (!slice.border) return;
                const colNum = showSwimlanes ? sliceIndex + 2 : sliceIndex + 1;
                const rowEnd = gridMap.testRow + 1; // end is exclusive
                html += `<div class="slice-border" style="grid-column: ${colNum}; grid-row: 1 / ${rowEnd}; border-color: ${slice.border};"></div>`;
            });
            
            // Organize elements by lane
            const cellContents = new Map(); // key: "colNum-rowNum", value: array of HTML strings
            const cellMeta = new Map(); // key: "colNum-rowNum", value: { hasTests: boolean }

            function ensureCellMeta(key) {
                if (!cellMeta.has(key)) {
                    cellMeta.set(key, { hasTests: false });
                }
                return cellMeta.get(key);
            }
            
            model.slices.forEach((slice, sliceIndex) => {
                const colNum = showSwimlanes ? sliceIndex + 2 : sliceIndex + 1;
                
                // Slice hotspots share one aligned row across all slice columns.
                if (gridMap.sliceHotspotsRow) {
                    const sliceHotspots = Array.isArray(slice.hotspots) ? slice.hotspots : [];
                    if (sliceHotspots.length > 0) {
                        const hotspotCellKey = `${colNum}-${gridMap.sliceHotspotsRow}`;
                        if (!cellContents.has(hotspotCellKey)) cellContents.set(hotspotCellKey, []);
                        cellContents.get(hotspotCellKey).push(generateHotspotGroup(sliceHotspots, 'slice-hotspots-group'));
                    }
                }

                // Trigger
                if (slice.trigger) {
                    const laneKey = getTriggerLaneKey(slice.trigger, showSwimlanes);
                    const rowNum = gridMap.triggerRowMap.get(laneKey);
                    if (rowNum) {
                        const cellKey = `${colNum}-${rowNum}`;
                        if (!cellContents.has(cellKey)) cellContents.set(cellKey, []);
                        cellContents.get(cellKey).push(generateTrigger(slice.trigger, sliceIndex));
                    }
                }
                
                // Command/View
                const cmdViewRow = gridMap.commandViewRow;
                const cellKey = `${colNum}-${cmdViewRow}`;
                if (!cellContents.has(cellKey)) cellContents.set(cellKey, []);
                
                // Collect command/view elements; view always appears before command
                const cmdViewItems = [];
                if (slice.view) {
                    cmdViewItems.push(generateView(slice.view, sliceIndex));
                }
                if (slice.command) {
                    // command.events are pre-resolved canonical ids (no eventsInSlice needed)
                    cmdViewItems.push(generateCommand(slice.command, sliceIndex));
                }
                if (cmdViewItems.length > 1) {
                    cellContents.get(cellKey).push(`<div class="cmdview-group">${cmdViewItems.join('')}</div>`);
                } else if (cmdViewItems.length === 1) {
                    cellContents.get(cellKey).push(cmdViewItems[0]);
                }
                
                // Events - Group by lane but keep them together in event cells
                if (slice.events && Array.isArray(slice.events)) {
                    const totalEventsInSlice = slice.events.length;
                    // Group events by their lane
                    const eventsByLane = new Map();
                    slice.events.forEach((event, eventIndex) => {
                        const laneKey = getEventLaneKey(event, showSwimlanes);
                        if (!eventsByLane.has(laneKey)) {
                            eventsByLane.set(laneKey, []);
                        }
                        eventsByLane.get(laneKey).push({ event, eventIndex });
                    });
                    
                    // Add grouped events to their respective lane cells
                    eventsByLane.forEach((eventList, laneKey) => {
                        const rowNum = gridMap.eventRowMap.get(laneKey);
                        if (rowNum) {
                            const eventCellKey = `${colNum}-${rowNum}`;
                            if (!cellContents.has(eventCellKey)) cellContents.set(eventCellKey, []);
                            
                            // Wrap events in a horizontal group with fixed columns
                            let eventsHtml = `<div class="events-group" style="grid-template-columns: repeat(${totalEventsInSlice}, minmax(240px, max-content));">`;
                            eventList.forEach(({ event, eventIndex }) => {
                                eventsHtml += generateEvent(event, sliceIndex, eventIndex, eventIndex + 1);
                            });
                            eventsHtml += '</div>';
                            
                            cellContents.get(eventCellKey).push(eventsHtml);
                        }
                    });
                }
                
                // Tests
                if (slice.tests && Array.isArray(slice.tests) && slice.tests.length > 0) {
                    const testCellKey = `${colNum}-${gridMap.testRow}`;
                    if (!cellContents.has(testCellKey)) cellContents.set(testCellKey, []);
                    cellContents.get(testCellKey).push(generateTests(slice.tests));
                    const meta = ensureCellMeta(testCellKey);
                    meta.hasTests = true;
                }
            });
            
            // Render lane headers (rows)
            if (showSwimlanes) {
                let currentRow = 2;

                // The slice-hotspot row is intentionally unlabeled; the red squares identify it.
                if (gridMap.sliceHotspotsRow) {
                    html += `<div class="lane-header hotspot-lane-header" style="grid-column: 1; grid-row: ${currentRow};"></div>`;
                    currentRow++;
                }
                
                // Trigger lane headers
                triggerLanes.forEach(lane => {
                    html += `<div class="lane-header" style="grid-column: 1; grid-row: ${currentRow};">${escapeHtml(lane.label)}</div>`;
                    currentRow++;
                });
                
                // Command/View header
                html += `<div class="lane-header" style="grid-column: 1; grid-row: ${currentRow};"></div>`;
                currentRow++;
                
                // Event lane headers
                eventLanes.forEach(lane => {
                    html += `<div class="lane-header" style="grid-column: 1; grid-row: ${currentRow};">${escapeHtml(lane.label)}</div>`;
                    currentRow++;
                });
            }
            
            // Render all grid cells with content
            cellContents.forEach((contents, cellKey) => {
                const [colNum, rowNum] = cellKey.split('-').map(Number);
                const sliceIndex = colNum - (showSwimlanes ? 2 : 1);
                const meta = cellMeta.get(cellKey);
                const cellClass = meta && meta.hasTests ? 'grid-cell test-cell' : 'grid-cell';
                
                html += `<div class="${cellClass}" style="grid-column: ${colNum}; grid-row: ${rowNum};" data-slice-index="${sliceIndex}">`;
                html += contents.join('');
                html += `</div>`;
            });
            
            // Render empty cells for proper grid structure
            for (let row = 2; row <= gridMap.testRow; row++) {
                for (let sliceIndex = 0; sliceIndex < numSlices; sliceIndex++) {
                    const colNum = showSwimlanes ? sliceIndex + 2 : sliceIndex + 1;
                    const cellKey = `${colNum}-${row}`;
                    if (!cellContents.has(cellKey)) {
                        html += `<div class="grid-cell" style="grid-column: ${colNum}; grid-row: ${row};" data-slice-index="${sliceIndex}"></div>`;
                    }
                }
            }
            
            html += '</div>'; // Close swimlane-grid
            html += '</div>'; // Close event-model-diagram
            return html;
        }

        // ===== LEGACY SLICE GENERATION (now replaced by grid) =====
        // Keeping old functions for reference, but they're no longer used by main rendering
        
        function generateSliceOld(slice, index, allSlices) {
            const hasBorder = slice.border ? 'with-border' : '';
            const borderStyle = slice.border ? `border-color: ${slice.border};` : '';
            
            let html = `<div class="slice ${hasBorder}" style="${borderStyle}" data-slice-index="${index}">`;
            
            if (slice.name) {
                html += `<div class="slice-name">${escapeHtml(slice.name)}</div>`;
            }

            html += '<div class="pattern-flow">';

            // Command Pattern: trigger -> command -> events
            if (slice.command) {
                if (slice.trigger) {
                    html += generateTrigger(slice.trigger);
                }
                
                html += generateCommand(slice.command);
                
                // Events are now at slice level
                if (slice.events && slice.events.length > 0) {
                    html += '<div class="events-container">';
                    slice.events.forEach((event, eventIndex) => {
                        html += generateEvent(event, index, eventIndex);
                    });
                    html += '</div>';
                }
            }
            // View Pattern: trigger -> view (events connected via arrows)
            else if (slice.view) {
                if (slice.trigger) {
                    html += generateTrigger(slice.trigger);
                }
                
                html += generateView(slice.view, index, slice.view.events || []);
            }
            // Automation Pattern: events -> command (future support)
            else if (slice.automation) {
                if (slice.automation.events && slice.automation.events.length > 0) {
                    html += '<div class="events-container">';
                    slice.automation.events.forEach(eventName => {
                        html += generateEventReference(eventName);
                    });
                    html += '</div>';
                }
                
                html += generateCommand(slice.automation.command);
                
                // Events are now at slice level for automation too
                if (slice.events && slice.events.length > 0) {
                    html += '<div class="events-container">';
                    slice.events.forEach((event, eventIndex) => {
                        html += generateEvent(event, index, eventIndex);
                    });
                    html += '</div>';
                }
            }
            // Policy Pattern: event -> event (future support)
            else if (slice.policy) {
                html += generateEventReference(slice.policy.triggerEvent);
                html += generateEvent(slice.policy.resultEvent);
            }

            // Add test cases if present
            if (slice.tests && slice.tests.length > 0) {
                html += '<div class="tests-container">';
                slice.tests.forEach(test => {
                    html += generateTestCase(test);
                });
                html += '</div>';
            }

            html += '</div></div>';
            return html;
        }

        function generateTestCase(test) {
            let html = '<div class="test-case">';

            const renderTestItem = (item, className) => {
                let itemHtml = `<div class="${className}">`;
                const itemName = item && item.name ? item.name : '(unnamed)';
                itemHtml += `${escapeHtml(itemName)}`;
                if (item.properties && item.properties.length > 0) {
                    item.properties.forEach(prop => {
                        const propLabel = prop && prop.name ? prop.name : '(property)';
                        const propData = prop && prop.value !== undefined
                            ? prop.value
                            : (prop && prop.type !== undefined ? prop.type : '');
                        itemHtml += `<div class="test-property">${escapeHtml(String(propLabel))}: ${escapeHtml(String(propData))}</div>`;
                    });
                }
                itemHtml += '</div>';
                return itemHtml;
            };
            
            // Test name
            if (test.name) {
                html += `<div class="test-section-label" style="margin-bottom: 6px; font-size: 12px; color: #2c3e50;">${escapeHtml(test.name)}</div>`;
            }
            
            // Given section
            const givenEvents = test.given && Array.isArray(test.given.events) ? test.given.events : [];
            const givenViews = test.given && Array.isArray(test.given.views) ? test.given.views : [];

            if (givenEvents.length > 0 || givenViews.length > 0) {
                html += '<div class="test-section">';
                html += '<div class="test-section-label">Given:</div>';
                givenEvents.forEach(event => {
                    html += renderTestItem(event, 'test-event');
                });
                givenViews.forEach(view => {
                    html += renderTestItem(view, 'test-view');
                });
                html += '</div>';
            }
            
            // When section
            const whenCommand = test.when && test.when.command ? test.when.command : null;
            if (whenCommand) {
                html += '<div class="test-section">';
                html += '<div class="test-section-label">When:</div>';
                const commandName = whenCommand.name ? whenCommand.name : '(unnamed command)';
                html += `<div class="test-command">${escapeHtml(commandName)}`;
                if (whenCommand.properties && whenCommand.properties.length > 0) {
                    whenCommand.properties.forEach(prop => {
                        const propLabel = prop && prop.name ? prop.name : '(property)';
                        const propData = prop && prop.value !== undefined
                            ? prop.value
                            : (prop && prop.type !== undefined ? prop.type : '');
                        html += `<div class="test-property">${escapeHtml(String(propLabel))}: ${escapeHtml(String(propData))}</div>`;
                    });
                }
                html += '</div>';
                html += '</div>';
            }
            
            // Then section
            const thenEvents = test.then && Array.isArray(test.then.events) ? test.then.events : [];
            const thenViews = test.then && Array.isArray(test.then.views) ? test.then.views : [];
            const thenError = test.then && typeof test.then.error === 'string' ? test.then.error : null;

            if (thenEvents.length > 0 || thenViews.length > 0 || thenError) {
                html += '<div class="test-section">';
                html += '<div class="test-section-label">Then:</div>';
                thenEvents.forEach(event => {
                    html += renderTestItem(event, 'test-event');
                });
                thenViews.forEach(view => {
                    html += renderTestItem(view, 'test-view');
                });
                if (thenError) {
                    html += `<div class="test-error">Error: ${escapeHtml(thenError)}</div>`;
                }
                html += '</div>';
            }
            
            html += '</div>';
            return html;
        }

        /**
         * Normalises trigger.type to a canonical string.
         * Unknown or missing types default to the generic "ui" fallback.
         */
        function normalizeTriggerType(rawType) {
            if (!rawType || typeof rawType !== 'string' || !rawType.trim()) return 'ui';
            const t = rawType.trim().toLowerCase();
            const known = ['automation', 'translation', 'ui-input', 'ui-input-disabled',
                           'ui-table', 'ui-chart-line', 'ui-chart-column', 'ui-chart-pie'];
            if (known.includes(t)) return t;
            // Any other type starting with "ui" → generic UI fallback
            // Completely unknown types → UI fallback (documented behaviour)
            return 'ui';
        }

        /** Read property name from both new (name) and legacy (label) key shapes. */
        function getTriggerPropName(prop) {
            return prop.name !== undefined ? prop.name : (prop.label !== undefined ? prop.label : '');
        }

        /** Read property value from both new (value) and legacy (propertyName) key shapes. */
        function getTriggerPropValue(prop) {
            return prop.value !== undefined ? prop.value : (prop.propertyName !== undefined ? prop.propertyName : '');
        }

        /** Render label/input pairs for ui-input and ui-input-disabled. */
        function generateTriggerInputBody(trigger, isDisabled) {
            let html = '<div class="trigger-body">';
            if (trigger.properties && trigger.properties.length > 0) {
                trigger.properties.forEach(prop => {
                    const name = escapeHtml(String(getTriggerPropName(prop)));
                    const value = escapeHtml(String(getTriggerPropValue(prop)));
                    const dis = isDisabled ? ' disabled' : '';
                    html += `<div class="trigger-input-row">`;
                    html += `<label class="trigger-input-label">${name}</label>`;
                    html += `<input class="trigger-input-field" type="text" value="${value}"${dis}>`;
                    html += '</div>';
                });
            }
            html += '</div>';
            return html;
        }

        /** Render property names as table column headers for ui-table. */
        function generateTriggerTableBody(trigger) {
            let html = '<div class="trigger-body">';
            if (trigger.properties && trigger.properties.length > 0) {
                html += '<table class="trigger-table"><thead><tr>';
                trigger.properties.forEach(prop => {
                    html += `<th class="trigger-table-header">${escapeHtml(String(getTriggerPropName(prop)))}</th>`;
                });
                html += '</tr></thead><tbody><tr>';
                trigger.properties.forEach(() => {
                    html += '<td class="trigger-table-cell">&nbsp;</td>';
                });
                html += '</tr></tbody></table>';
            }
            html += '</div>';
            return html;
        }

        /** Render a minimal inline SVG chart (line, column, or pie) with hardcoded sample data. */
        function generateTriggerChartBody(chartType) {
            let svgContent = '';
            const axes = '<line x1="20" y1="5" x2="20" y2="85" stroke="#aaa" stroke-width="1"/>' +
                          '<line x1="20" y1="85" x2="195" y2="85" stroke="#aaa" stroke-width="1"/>';

            if (chartType === 'ui-chart-line') {
                svgContent = axes +
                    '<polyline points="20,70 65,45 110,60 155,25 195,40" fill="none" stroke="#27ae60" stroke-width="2"/>' +
                    '<circle cx="20" cy="70" r="3" fill="#27ae60"/>' +
                    '<circle cx="65" cy="45" r="3" fill="#27ae60"/>' +
                    '<circle cx="110" cy="60" r="3" fill="#27ae60"/>' +
                    '<circle cx="155" cy="25" r="3" fill="#27ae60"/>' +
                    '<circle cx="195" cy="40" r="3" fill="#27ae60"/>';
            } else if (chartType === 'ui-chart-column') {
                svgContent = axes +
                    '<rect x="30" y="45" width="30" height="40" fill="#27ae60" opacity="0.85"/>' +
                    '<rect x="75" y="25" width="30" height="60" fill="#27ae60" opacity="0.85"/>' +
                    '<rect x="120" y="55" width="30" height="30" fill="#27ae60" opacity="0.85"/>' +
                    '<rect x="165" y="35" width="30" height="50" fill="#27ae60" opacity="0.85"/>';
            } else if (chartType === 'ui-chart-pie') {
                // 3 slices: 40% (144°), 35% (126°), 25% (90°), center (100,50), radius 40
                svgContent =
                    '<path d="M100,50 L100,10 A40,40 0 0,1 123.5,82.4 Z" fill="#2ecc71"/>' +
                    '<path d="M100,50 L123.5,82.4 A40,40 0 0,1 60,50 Z" fill="#27ae60"/>' +
                    '<path d="M100,50 L60,50 A40,40 0 0,1 100,10 Z" fill="#1e8449"/>';
            }

            return `<div class="trigger-body trigger-chart-body">` +
                   `<svg class="trigger-chart" viewBox="0 0 200 100" xmlns="http://www.w3.org/2000/svg" aria-label="${chartType} sample">${svgContent}</svg>` +
                   `</div>`;
        }

        /** Render a simple property list as a UI fallback. */
        function generateTriggerFallbackBody(trigger) {
            let html = '<div class="trigger-body">';
            if (trigger.properties && trigger.properties.length > 0) {
                trigger.properties.forEach(prop => {
                    const name = escapeHtml(String(getTriggerPropName(prop)));
                    const value = escapeHtml(String(getTriggerPropValue(prop)));
                    html += `<div class="trigger-prop-row">${name}: ${value}</div>`;
                });
            }
            html += '</div>';
            return html;
        }

        /** Render the buttons footer section for UI triggers. */
        function generateTriggerFooter(trigger) {
            if (!trigger.buttons || trigger.buttons.length === 0) return '';
            let html = '<div class="trigger-footer">';
            trigger.buttons.forEach(btn => {
                html += `<button class="trigger-button" type="button" disabled>${escapeHtml(String(btn))}</button>`;
            });
            html += '</div>';
            return html;
        }

        /** Inline SVG gear icon used for automation and translation triggers. */
        function getGearSvg(ariaLabel) {
            return `<svg class="trigger-gear" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${escapeHtml(ariaLabel)}">` +
                '<path fill="#444" d="M12 15.5A3.5 3.5 0 0 1 8.5 12 3.5 3.5 0 0 1 12 8.5a3.5 3.5 0 0 1 3.5 3.5' +
                ' 3.5 3.5 0 0 1-3.5 3.5m7.43-2.92c.04-.34.07-.67.07-1.08s-.03-.74-.07-1.08l2.11-1.65' +
                'c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98' +
                'l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.58-1.69.98' +
                'l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.34-.07.67-.07 1.08' +
                's.03.74.07 1.08L2.46 13.57c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1' +
                'c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65' +
                'c.61-.25 1.17-.58 1.69-.98l2.49 1c.23.09.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64z"/>' +
                '</svg>';
        }

        function generateTrigger(trigger, sliceIndex) {
            const triggerViews = (trigger.views || []).join(',');
            // trigger.id is guaranteed by enrichment; trigger.views are pre-resolved canonical ids
            const triggerType = normalizeTriggerType(trigger.type);
            const isGear = triggerType === 'automation' || triggerType === 'translation';
            const variantClass = isGear ? `trigger-${triggerType}` : 'trigger-ui';
            const displayName = trigger.name || '';

            // Outer layout wrapper — NOT the arrow anchor
            let html = '<div class="trigger-slot">';

            // Name label sits above the visual trigger
            if (displayName) {
                html += `<div class="trigger-name">${escapeHtml(displayName)}</div>`;
            }

            // .element.trigger is the stable arrow anchor — all data-* attributes live here
            html += `<div class="element trigger ${variantClass}" data-slice-index="${sliceIndex}" data-trigger-views="${escapeHtml(triggerViews)}" data-trigger-id="${escapeHtml(trigger.id || '')}">`;

            if (isGear) {
                // Automation / translation: gear icon only, no dialog chrome
                html += getGearSvg(`${triggerType} trigger`);
            } else {
                // UI trigger: dialog/window visual
                html += '<div class="trigger-dialog">';
                html += `<div class="trigger-titlebar"></div>`;

                if (triggerType === 'ui-input') {
                    html += generateTriggerInputBody(trigger, false);
                } else if (triggerType === 'ui-input-disabled') {
                    html += generateTriggerInputBody(trigger, true);
                } else if (triggerType === 'ui-table') {
                    html += generateTriggerTableBody(trigger);
                } else if (triggerType === 'ui-chart-line' || triggerType === 'ui-chart-column' || triggerType === 'ui-chart-pie') {
                    html += generateTriggerChartBody(triggerType);
                } else {
                    html += generateTriggerFallbackBody(trigger);
                }

                html += generateTriggerFooter(trigger);
                html += '</div>'; // .trigger-dialog
            }

            html += '</div>'; // .element.trigger
            html += '</div>'; // .trigger-slot
            return html;
        }

        function generateCommand(command, sliceIndex) {
    // command.events is pre-resolved to canonical ids by event-model.js
    const commandEvents = (command.events || []).join(',');
    let html = `<div class="element command" data-command-events="${escapeHtml(commandEvents)}" data-slice-index="${sliceIndex}">`;
    html += `<div class="element-title">${escapeHtml(command.name)}</div>`;
    
    if (command.properties && command.properties.length > 0) {
        html += '<div class="element-properties">';
        command.properties.forEach(prop => {
            html += `<div class="element-property">${escapeHtml(prop.name)}: ${escapeHtml(prop.type)}</div>`;
        });
        html += '</div>';
    }
    
    html += '</div>';
    return html;
}

        function generateEvent(event, sliceIndex, eventIndex, gridColumn) {
            const eventId = `event-${sliceIndex}-${eventIndex}-${event.name.replace(/\s+/g, '-')}`;
            const externalClass = event.external === true ? ' external' : '';
            // Always emit data-event-id — enriched model guarantees every event has a calculated id
            const eventIdAttr = event.id ? ` data-event-id="${escapeHtml(event.id)}"` : '';
            const gridColumnStyle = gridColumn ? ` style="grid-column: ${gridColumn};"` : '';
            let html = `<div class="element event${externalClass}" id="${eventId}" data-event-name="${escapeHtml(event.name)}" data-slice-index="${sliceIndex}"${eventIdAttr}${gridColumnStyle}>`;
            html += `<div class="element-title">${escapeHtml(event.name)}</div>`;
            
            if (event.properties && event.properties.length > 0) {
                html += '<div class="element-properties">';
                event.properties.forEach(prop => {
                    html += `<div class="element-property">${escapeHtml(prop.name)}: ${escapeHtml(prop.type)}</div>`;
                });
                html += '</div>';
            }
            
            html += '</div>';
            return html;
        }

        function generateEventReference(eventName) {
            let html = '<div class="element event">';
            html += `<div class="element-title">${escapeHtml(eventName)}</div>`;
            html += '</div>';
            return html;
        }

        function generateView(view, sliceIndex) {
            const viewId = `view-${sliceIndex}`;
            // view.id is guaranteed by enrichment; view.events are pre-resolved canonical ids
            const eventNamesAttr = (view.events || []).join(',');
            let html = `<div class="element view" id="${viewId}" data-view-id="${escapeHtml(view.id)}" data-view-name="${escapeHtml(view.name || '')}" data-view-events="${escapeHtml(eventNamesAttr)}">`;
            html += `<div class="element-title">${escapeHtml(view.name)}</div>`;
            
            if (view.properties && view.properties.length > 0) {
                html += '<div class="element-properties">';
                view.properties.forEach(prop => {
                    html += `<div class="element-property">${escapeHtml(prop.name)}: ${escapeHtml(prop.type)}</div>`;
                });
                html += '</div>';
            }
            
            html += '</div>';
            return html;
        }

        function generateTests(tests) {
            let html = '<div class="tests-container">';
            tests.forEach(test => {
                html += generateTestCase(test);
            });
            html += '</div>';
            return html;
        }

        function escapeHtml(text) {
            if (typeof text !== 'string') return text;
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        function showError(message) {
            diagramElement.innerHTML = `<div class="error-message">${escapeHtml(message)}</div>`;
        }
