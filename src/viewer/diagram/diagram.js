        const diagramElement = document.getElementById('diagram');
        const diagramContainer = document.getElementById('diagramContainer');
        const diagramWrapper = document.getElementById('diagramWrapper');

        // Local state — updated via EventBus
        let _diagramJson = null;
        const _filters = { slices: true, tests: true, types: true, swimlanes: true };

        // Subscribe to events
        EventBus.on(Events.FILE_LOADED, ({ json }) => {
            _diagramJson = json;
            if (json) {
                renderDiagram(JSON.stringify(json));
            } else {
                diagramElement.innerHTML = '<div class="placeholder">Create or load an event model to visualize</div>';
            }
        });

        EventBus.on(Events.JSON_CHANGED, ({ json }) => {
            _diagramJson = json;
            renderDiagram(JSON.stringify(json));
        });

        EventBus.on(Events.FILTER_TOGGLED, ({ type, checked }) => {
            _filters[type] = checked;
            if (type === 'swimlanes') {
                // Swimlanes require full re-render
                if (_diagramJson) renderDiagram(JSON.stringify(_diagramJson));
            } else if (type === 'slices') {
                toggleSliceBorders(checked);
            } else if (type === 'tests') {
                toggleTests(checked);
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

        function renderDiagram(jsonString) {
            try {
                const data = JSON.parse(jsonString);
                const html = generateEventModelDiagram(data);
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

        // Helper function: Find event elements by ID or name
        function findEventElements(eventIdentifier) {
            // First try to find by ID (exact match)
            let elements = Array.from(document.querySelectorAll('.element.event[data-event-id]'))
                .filter(el => el.getAttribute('data-event-id') === eventIdentifier);

            // If not found by ID, try by name, but only if there is no event with the same name and a different id
            if (elements.length === 0) {
                // Find all events with this name
                let nameMatches = Array.from(document.querySelectorAll('.element.event[data-event-name]'))
                    .filter(el => el.getAttribute('data-event-name') === eventIdentifier);
                // If there are multiple, prefer those without a data-event-id (i.e., not an alias/external)
                if (nameMatches.length > 1) {
                    // Filter out those with a data-event-id attribute
                    let noIdMatches = nameMatches.filter(el => !el.hasAttribute('data-event-id'));
                    if (noIdMatches.length > 0) {
                        elements = noIdMatches;
                    } else {
                        elements = nameMatches;
                    }
                } else {
                    elements = nameMatches;
                }
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
                        // Command has explicit event list — match by ID first, name as fallback
                        const commandEventIds = commandEventsAttr.split(',').map(n => n.trim()).filter(Boolean);
                        commandEventIds.forEach(eventIdentifier => {
                            // Try ID match first
                            let matchingEvents = Array.from(events).filter(event =>
                                event.getAttribute('data-event-id') === eventIdentifier
                            );
                            // Fallback: match by name
                            if (matchingEvents.length === 0) {
                                matchingEvents = Array.from(events).filter(event =>
                                    event.getAttribute('data-event-name') === eventIdentifier
                                );
                            }

                            // Connect to all matching events — commands only reference events in the same slice
                            matchingEvents.forEach(event => {
                                drawArrow(svg, command, event, diagramDiv, 'bottom', 'top');
                            });
                        });
                    } else if (events.length > 0) {
                        // Backward compatibility: no explicit list, connect to all events
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

                    // First, check for events in the SAME slice (rare but possible)
                    const sameSliceEvents = eventMatches.filter(m => m.sliceIndex === viewSliceIndex);
                    if (sameSliceEvents.length > 0) {
                        // Use first same-slice event
                        selectedMatch = sameSliceEvents[0];
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
                        if (isDashed) {
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

            // Invisible wide hit-area path for easier mouse interaction
            const hitPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            hitPath.setAttribute('d', d);
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

        // ===== SWIMLANE DISCOVERY ALGORITHM =====
        
        /**
         * Discovers and organizes swimlanes from event model data
         * @param {Object} data - Event model JSON data
         * @param {boolean} showSwimlanes - If false, returns single-row structure
         * @returns {Object} { triggerLanes: [], eventLanes: [] }
         */
        function discoverSwimlanes(data, showSwimlanes) {
            if (!showSwimlanes) {
                // When swimlanes are hidden, treat everything as one row
                return {
                    triggerLanes: [{ type: 'all', label: 'All Triggers' }],
                    eventLanes: [{ type: 'all', label: 'All Events' }]
                };
            }

            const triggerLanes = [];
            const eventLanes = [];
            const seenRoles = new Set();
            
            const automationRoles = [];
            const otherRoles = [];
            let hasNoRoleTrigger = false;

            // First pass: collect trigger swimlanes
            if (data.slices && Array.isArray(data.slices)) {
                data.slices.forEach(slice => {
                    if (slice.trigger) {
                        const swimlane = slice.trigger.swimlane;
                        const type = slice.trigger.type;
                        
                        if (swimlane && swimlane.trim()) {
                            if (!seenRoles.has(swimlane)) {
                                seenRoles.add(swimlane);
                                if (type === 'automation') {
                                    automationRoles.push(swimlane);
                                } else {
                                    otherRoles.push(swimlane);
                                }
                            }
                        } else {
                            hasNoRoleTrigger = true;
                        }
                    }
                });

                // Build trigger lanes in order: automation -> others -> no-role
                automationRoles.forEach(swimlane => {
                    triggerLanes.push({ type: 'role', role: swimlane, label: swimlane });
                });
                otherRoles.forEach(swimlane => {
                    triggerLanes.push({ type: 'role', role: swimlane, label: swimlane });
                });
                if (hasNoRoleTrigger) {
                    triggerLanes.push({ type: 'no-role', label: '' });
                }

                // Second pass: collect event swimlanes
                let hasNoSystemEvent = false;
                let hasUnnamedExternal = false;
                const nonExternalSwimlanes = [];
                const externalSwimlanes = [];
                const seenNonExternal = new Set();
                const seenExternal = new Set();

                data.slices.forEach(slice => {
                    if (slice.events && Array.isArray(slice.events)) {
                        slice.events.forEach(event => {
                            if (event.external) {
                                if (event.swimlane && event.swimlane.trim()) {
                                    if (!seenExternal.has(event.swimlane)) {
                                        seenExternal.add(event.swimlane);
                                        externalSwimlanes.push(event.swimlane);
                                    }
                                } else {
                                    hasUnnamedExternal = true;
                                }
                            } else if (event.swimlane && event.swimlane.trim()) {
                                if (!seenNonExternal.has(event.swimlane)) {
                                    seenNonExternal.add(event.swimlane);
                                    nonExternalSwimlanes.push(event.swimlane);
                                }
                            } else {
                                hasNoSystemEvent = true;
                            }
                        });
                    }
                });

                // Build event lanes: no-swimlane → non-external named → external named → External default
                if (hasNoSystemEvent) {
                    eventLanes.push({ type: 'no-system', label: '' });
                }
                nonExternalSwimlanes.forEach(swimlane => {
                    eventLanes.push({ type: 'system', system: swimlane, label: swimlane });
                });
                externalSwimlanes.forEach(swimlane => {
                    eventLanes.push({ type: 'system', system: swimlane, label: swimlane });
                });
                if (hasUnnamedExternal) {
                    eventLanes.push({ type: 'external', label: 'External' });
                }
            }

            // Fallback: if no lanes discovered, create defaults
            if (triggerLanes.length === 0) {
                triggerLanes.push({ type: 'no-role', label: '' });
            }
            if (eventLanes.length === 0) {
                eventLanes.push({ type: 'no-system', label: '' });
            }

            return { triggerLanes, eventLanes };
        }

        /**
         * Builds a grid map with row indices for each lane
         * @param {Array} triggerLanes - Array of trigger lane objects
         * @param {Array} eventLanes - Array of event lane objects
         * @returns {Object} { triggerRowMap: Map, commandViewRow: number, eventRowMap: Map, testRow: number, totalRows: number }
         */
        function buildGridMap(triggerLanes, eventLanes) {
            const triggerRowMap = new Map();
            const eventRowMap = new Map();
            
            let currentRow = 2; // Row 1 is for slice headers, start lanes at row 2
            
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
            if (lane.type === 'external') return 'external';
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
            if (event.external) {
                if (event.swimlane && event.swimlane.trim()) {
                    return `system:${event.swimlane}`;
                }
                return 'external';
            }
            if (event.swimlane && event.swimlane.trim()) {
                return `system:${event.swimlane}`;
            }
            return 'no-system';
        }

        // ===== END SWIMLANE DISCOVERY =====

        function generateEventModelDiagram(data) {
            if (!data.slices || !Array.isArray(data.slices)) {
                return '<div class="info-message">Invalid event model: slices array is required</div>';
            }

            const showSwimlanes = _filters.swimlanes;
            
            // Discover swimlanes
            const { triggerLanes, eventLanes } = discoverSwimlanes(data, showSwimlanes);
            const gridMap = buildGridMap(triggerLanes, eventLanes);
            
            const numSlices = data.slices.length;
            const swimlanesClass = showSwimlanes ? '' : 'swimlanes-hidden';
            
            let html = '<div class="event-model-diagram">';
            
            if (data.title) {
                html += `<div class="diagram-title">${escapeHtml(data.title)}</div>`;
            }

            // Build CSS Grid
            const numCols = showSwimlanes ? numSlices + 1 : numSlices; // +1 for lane header column
            const gridTemplateColumns = showSwimlanes 
                ? `120px repeat(${numSlices}, minmax(240px, max-content))`
                : `repeat(${numSlices}, minmax(240px, max-content))`;
            
            html += `<div class="swimlane-grid ${swimlanesClass}" style="grid-template-columns: ${gridTemplateColumns};">`;
            
            data.slices.forEach((slice, sliceIndex) => {
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
            data.slices.forEach((slice, sliceIndex) => {
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
            
            data.slices.forEach((slice, sliceIndex) => {
                const colNum = showSwimlanes ? sliceIndex + 2 : sliceIndex + 1;
                
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
                    cmdViewItems.push(generateView(slice.view, sliceIndex, slice.view.events || []));
                }
                if (slice.command) {
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
            
            // Test name
            if (test.name) {
                html += `<div class="test-section-label" style="margin-bottom: 6px; font-size: 12px; color: #2c3e50;">${escapeHtml(test.name)}</div>`;
            }
            
            // Given section
            if (test.given && test.given.length > 0) {
                html += '<div class="test-section">';
                html += '<div class="test-section-label">Given:</div>';
                test.given.forEach(event => {
                    html += `<div class="test-event">`;
                    html += `${escapeHtml(event.name)}`;
                    if (event.properties && event.properties.length > 0) {
                        event.properties.forEach(prop => {
                            html += `<div class="test-property">${escapeHtml(prop.name)}: ${escapeHtml(prop.value)}</div>`;
                        });
                    }
                    html += '</div>';
                });
                html += '</div>';
            }
            
            // When section
            if (test.when) {
                html += '<div class="test-section">';
                html += '<div class="test-section-label">When:</div>';
                html += `<div class="test-command">${escapeHtml(test.when.name)}`;
                if (test.when.properties && test.when.properties.length > 0) {
                    test.when.properties.forEach(prop => {
                        html += `<div class="test-property">${escapeHtml(prop.name)}: ${escapeHtml(prop.value)}</div>`;
                    });
                }
                html += '</div>';
                html += '</div>';
            }
            
            // Then section
            if (test.then && test.then.length > 0) {
                html += '<div class="test-section">';
                html += '<div class="test-section-label">Then:</div>';
                test.then.forEach(result => {
                    if (result.error) {
                        html += `<div class="test-error">Error: ${escapeHtml(result.error)}</div>`;
                    } else {
                        html += `<div class="test-event">`;
                        html += `${escapeHtml(result.name)}`;
                        if (result.properties && result.properties.length > 0) {
                            result.properties.forEach(prop => {
                                html += `<div class="test-property">${escapeHtml(prop.name)}: ${escapeHtml(prop.value)}</div>`;
                            });
                        }
                        html += '</div>';
                    }
                });
                html += '</div>';
            }
            
            html += '</div>';
            return html;
        }

        function generateTrigger(trigger, sliceIndex) {
            const triggerViews = trigger.views ? trigger.views.join(',') : '';
            const triggerIdVal = trigger.id ? trigger.id : (trigger.name || '');
            let html = `<div class="element trigger" data-slice-index="${sliceIndex}" data-trigger-views="${escapeHtml(triggerViews)}" data-trigger-id="${escapeHtml(triggerIdVal)}">`;
            
            if (trigger.swimlane) {
                html += `<div class="element-role">${escapeHtml(trigger.swimlane)}</div>`;
            }
            
            if (trigger.name) {
                html += `<div class="element-subtitle">${escapeHtml(trigger.name)}</div>`;
            }
            
            html += `<div class="element-title">Trigger: ${escapeHtml(trigger.type)}</div>`;
            
            if (trigger.buttons && trigger.buttons.length > 0) {
                html += '<div class="element-properties">';
                html += `Buttons: ${trigger.buttons.map(b => escapeHtml(b)).join(', ')}`;
                html += '</div>';
            }
            
            if (trigger.properties && trigger.properties.length > 0) {
                html += '<div class="element-properties">';
                trigger.properties.forEach(prop => {
                    html += `<div class="element-property" data-trigger-property="true">${escapeHtml(prop.label)}: ${escapeHtml(prop.propertyName)}</div>`;
                });
                html += '</div>';
            }
            
            html += '</div>';
            return html;
        }

        function generateCommand(command, sliceIndex) {
            const commandEvents = command.events ? command.events.join(',') : '';
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

        function generateView(view, sliceIndex, eventNames) {
            const viewId = `view-${sliceIndex}`;
            const viewIdVal = view.id ? view.id : (view.name || '');
            const eventNamesAttr = eventNames ? eventNames.join(',') : '';
            let html = `<div class="element view" id="${viewId}" data-view-id="${escapeHtml(viewIdVal)}" data-view-name="${escapeHtml(view.name || '')}" data-view-events="${escapeHtml(eventNamesAttr)}">`;
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
