        // Zoom and pan state
        let currentZoom = 1;
        let isDragging = false;
        let dragStartX = 0;
        let dragStartY = 0;
        let scrollLeft = 0;
        let scrollTop = 0;

        // Zoom functions
        function setZoom(zoom) {
            currentZoom = Math.min(Math.max(zoom, 0.1), 5); // Clamp between 10% and 500%
            diagramWrapper.style.transform = `scale(${currentZoom})`;
            zoomLevelDisplay.textContent = `${Math.round(currentZoom * 100)}%`;
        }

        function zoomIn() {
            setZoom(currentZoom + 0.1);
        }

        function zoomOut() {
            setZoom(currentZoom - 0.1);
        }

        function resetZoom() {
            setZoom(1);
        }

        // Zoom button handlers
        zoomInBtn.addEventListener('click', zoomIn);
        zoomOutBtn.addEventListener('click', zoomOut);
        zoomResetBtn.addEventListener('click', resetZoom);

        // Export functions
        async function exportToPNG() {
            try {
                const diagramDiv = document.querySelector('.event-model-diagram');
                if (!diagramDiv) {
                    alert('No diagram to export. Please load a JSON file first.');
                    return;
                }

                // Import html2canvas dynamically
                if (!window.html2canvas) {
                    const script = document.createElement('script');
                    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
                    document.head.appendChild(script);
                    await new Promise((resolve, reject) => {
                        script.onload = resolve;
                        script.onerror = reject;
                    });
                }

                // Capture the diagram as canvas
                const canvas = await html2canvas(diagramDiv, {
                    backgroundColor: '#ffffff',
                    scale: 2, // Higher quality
                    logging: false
                });

                // Convert to blob and download
                canvas.toBlob((blob) => {
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'event-model-diagram.png';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                });
            } catch (error) {
                console.error('Export to PNG failed:', error);
                alert('Failed to export PNG: ' + error.message);
            }
        }

        function exportToSVG() {
            try {
                const diagramDiv = document.querySelector('.event-model-diagram');
                if (!diagramDiv) {
                    alert('No diagram to export. Please load a JSON file first.');
                    return;
                }

                // Clone the diagram div
                const clone = diagramDiv.cloneNode(true);
                
                // Get computed styles
                const styles = window.getComputedStyle(diagramDiv);
                const width = diagramDiv.offsetWidth;
                const height = diagramDiv.offsetHeight;

                // Create SVG wrapper
                const svgNS = 'http://www.w3.org/2000/svg';
                const svg = document.createElementNS(svgNS, 'svg');
                svg.setAttribute('xmlns', svgNS);
                svg.setAttribute('width', width);
                svg.setAttribute('height', height);
                svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

                // Create foreignObject to embed HTML
                const foreignObject = document.createElementNS(svgNS, 'foreignObject');
                foreignObject.setAttribute('width', '100%');
                foreignObject.setAttribute('height', '100%');

                // Add styles inline
                const styleElement = document.createElement('style');
                const allStyles = Array.from(document.styleSheets)
                    .map(sheet => {
                        try {
                            return Array.from(sheet.cssRules)
                                .map(rule => rule.cssText)
                                .join('\n');
                        } catch (e) {
                            return '';
                        }
                    })
                    .join('\n');
                styleElement.textContent = allStyles;
                clone.insertBefore(styleElement, clone.firstChild);

                foreignObject.appendChild(clone);
                svg.appendChild(foreignObject);

                // Serialize SVG
                const serializer = new XMLSerializer();
                const svgString = serializer.serializeToString(svg);
                const blob = new Blob([svgString], { type: 'image/svg+xml' });
                const url = URL.createObjectURL(blob);

                // Download
                const a = document.createElement('a');
                a.href = url;
                a.download = 'event-model-diagram.svg';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            } catch (error) {
                console.error('Export to SVG failed:', error);
                alert('Failed to export SVG: ' + error.message);
            }
        }

        // Export button handlers
        const exportPngBtn = document.getElementById('exportPngBtn');
        const exportSvgBtn = document.getElementById('exportSvgBtn');
        
        exportPngBtn.addEventListener('click', exportToPNG);
        exportSvgBtn.addEventListener('click', exportToSVG);

        // Ctrl + scroll to zoom
        diagramContainer.addEventListener('wheel', (e) => {
            if (e.ctrlKey) {
                e.preventDefault();
                const delta = e.deltaY > 0 ? -0.1 : 0.1;
                setZoom(currentZoom + delta);
            }
        }, { passive: false });

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
                
                // Apply current checkbox states
                toggleSliceBorders(showSlicesCheckbox.checked);
                toggleTests(showTestsCheckbox.checked);
                toggleTypes(showTypesCheckbox.checked);
            } catch (error) {
                showError('Error rendering diagram: ' + error.message);
            }
        }

        // Helper function: Find event elements by ID or name
        function findEventElements(eventIdentifier) {
            // First try to find by ID
            let elements = Array.from(document.querySelectorAll('.element.event[data-event-id]'))
                .filter(el => el.getAttribute('data-event-id') === eventIdentifier);
            
            // If not found by ID, try by name
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

        function drawAllArrows() {
            // Remove existing SVG if any
            const existingSvg = document.getElementById('arrow-svg');
            if (existingSvg) {
                existingSvg.remove();
            }

            const diagramDiv = document.querySelector('.event-model-diagram');
            if (!diagramDiv) return;

            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('id', 'arrow-svg');
            svg.style.position = 'absolute';
            svg.style.top = '0';
            svg.style.left = '0';
            svg.style.width = '100%';
            svg.style.height = '100%';
            svg.style.pointerEvents = 'none';
            svg.style.zIndex = '1';

            diagramDiv.style.position = 'relative';
            diagramDiv.appendChild(svg);

            // Create arrow marker
            const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
            const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
            marker.setAttribute('id', 'arrowhead');
            marker.setAttribute('markerWidth', '10');
            marker.setAttribute('markerHeight', '10');
            marker.setAttribute('refX', '9');
            marker.setAttribute('refY', '3');
            marker.setAttribute('orient', 'auto');

            const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
            polygon.setAttribute('points', '0 0, 10 3, 0 6');
            polygon.setAttribute('fill', 'black');

            marker.appendChild(polygon);
            defs.appendChild(marker);
            
            // Create dashed arrow marker
            const markerDashed = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
            markerDashed.setAttribute('id', 'arrowhead-dashed');
            markerDashed.setAttribute('markerWidth', '10');
            markerDashed.setAttribute('markerHeight', '10');
            markerDashed.setAttribute('refX', '9');
            markerDashed.setAttribute('refY', '3');
            markerDashed.setAttribute('orient', 'auto');

            const polygonDashed = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
            polygonDashed.setAttribute('points', '0 0, 10 3, 0 6');
            polygonDashed.setAttribute('fill', 'black');

            markerDashed.appendChild(polygonDashed);
            defs.appendChild(markerDashed);
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
                        // Command has explicit event list
                        const commandEventNames = commandEventsAttr.split(',').filter(n => n.trim());
                        commandEventNames.forEach(eventName => {
                            // Find matching events in this slice BY NAME ONLY
                            const matchingEvents = Array.from(events).filter(event => {
                                const eventNameAttr = event.getAttribute('data-event-name');
                                return eventNameAttr === eventName;
                            });
                            
                            // If multiple events with same name, prefer ones WITHOUT id (internal events)
                            let eventsToConnect = matchingEvents;
                            if (matchingEvents.length > 1) {
                                const eventsWithoutId = matchingEvents.filter(e => !e.getAttribute('data-event-id'));
                                if (eventsWithoutId.length > 0) {
                                    eventsToConnect = eventsWithoutId;
                                }
                            }
                            
                            // Draw arrows to selected events
                            eventsToConnect.forEach(event => {
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

                // Trigger -> View
                if (trigger && view && !command) {
                    drawArrow(svg, trigger, view, diagramDiv, 'bottom', 'top');
                }

                // Event -> Trigger (automation triggers)
                if (trigger) {
                    const triggerEventsAttr = trigger.getAttribute('data-trigger-events');
                    if (triggerEventsAttr && triggerEventsAttr.trim()) {
                        const triggerEventNames = triggerEventsAttr.split(',').filter(n => n.trim());
                        triggerEventNames.forEach(eventIdentifier => {
                            const eventMatches = findEventElements(eventIdentifier);
                            if (eventMatches.length === 0) {
                                console.warn(`Trigger references event "${eventIdentifier}" but no matching event found`);
                                return;
                            }

                            let selectedMatch = null;
                            let isDashed = false;

                            // First, check for events in the SAME slice
                            const sameSliceEvents = eventMatches.filter(m => m.sliceIndex === sliceIndex);
                            if (sameSliceEvents.length > 0) {
                                // Use first same-slice event (should typically be only one)
                                selectedMatch = sameSliceEvents[0];
                            } else {
                                // Try to find nearest preceding event
                                selectedMatch = selectNearestPrecedingEvent(eventMatches, sliceIndex);

                                // If no preceding, use nearest subsequent with dashed arrow
                                if (!selectedMatch) {
                                    selectedMatch = selectNearestSubsequentEvent(eventMatches, sliceIndex);
                                    isDashed = true;
                                }
                            }

                            if (selectedMatch) {
                                // Determine arrow direction based on same-slice vs cross-slice
                                const isSameSlice = selectedMatch.sliceIndex === sliceIndex;
                                if (isSameSlice) {
                                    // Same slice: event above, trigger below
                                    drawArrow(svg, selectedMatch.element, trigger, diagramDiv, 'top', 'bottom', isDashed);
                                } else {
                                    // Different slice: horizontal connection
                                    drawArrow(svg, selectedMatch.element, trigger, diagramDiv, 'right', 'left', isDashed);
                                }
                            }
                        });
                    }
                }
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
                        drawArrow(svg, selectedMatch.element, view, diagramDiv, 'top', 'bottom', isDashed);
                    }
                });
            });

            // View -> Trigger (find triggers that reference view events)
            views.forEach(view => {
                const viewCell = view.closest('.grid-cell');
                const viewSliceIndex = parseInt(viewCell.getAttribute('data-slice-index'));
                
                // Find next slice
                const nextSliceCells = Array.from(document.querySelectorAll('.grid-cell[data-slice-index]'))
                    .filter(cell => parseInt(cell.getAttribute('data-slice-index')) === viewSliceIndex + 1);
                
                if (nextSliceCells.length > 0) {
                    let nextTrigger = null;
                    nextSliceCells.forEach(cell => {
                        const trigger = cell.querySelector('.element.trigger');
                        if (trigger) nextTrigger = trigger;
                    });
                    
                    if (nextTrigger) {
                        drawArrow(svg, view, nextTrigger, diagramDiv, 'top', 'left');
                    }
                }
            });
        }

        function drawArrow(svg, fromElement, toElement, container, fromSide = 'bottom', toSide = 'top', isDashed = false) {
            const fromRect = fromElement.getBoundingClientRect();
            const toRect = toElement.getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();
            const wrapperRect = diagramWrapper.getBoundingClientRect();

            // Account for zoom and scroll offset
            const scale = currentZoom;
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

            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            
            // Choose curve based on direction
            let d;
            if ((fromSide === 'bottom' && toSide === 'top') || (fromSide === 'top' && toSide === 'bottom')) {
                // Vertical connection
                const midY = (startY + endY) / 2;
                d = `M ${startX} ${startY} C ${startX} ${midY}, ${endX} ${midY}, ${endX} ${endY}`;
            } else if ((fromSide === 'right' && toSide === 'left') || (fromSide === 'left' && toSide === 'right')) {
                // Horizontal connection
                const midX = (startX + endX) / 2;
                d = `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`;
            } else {
                // Mixed connection - use both control points
                const midX = (startX + endX) / 2;
                const midY = (startY + endY) / 2;
                d = `M ${startX} ${startY} Q ${midX} ${midY}, ${endX} ${endY}`;
            }
            
            path.setAttribute('d', d);
            path.setAttribute('stroke', 'black');
            path.setAttribute('stroke-width', '2');
            path.setAttribute('fill', 'none');
            if (isDashed) {
                path.setAttribute('stroke-dasharray', '5,5');
                path.setAttribute('marker-end', 'url(#arrowhead-dashed)');
            } else {
                path.setAttribute('marker-end', 'url(#arrowhead)');
            }

            svg.appendChild(path);
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
            const seenSystems = new Set();
            
            const automationRoles = [];
            const otherRoles = [];
            let hasNoRoleTrigger = false;

            // First pass: collect trigger roles
            if (data.slices && Array.isArray(data.slices)) {
                data.slices.forEach(slice => {
                    if (slice.trigger) {
                        const role = slice.trigger.role;
                        const type = slice.trigger.type;
                        
                        if (role && role.trim()) {
                            if (!seenRoles.has(role)) {
                                seenRoles.add(role);
                                if (type === 'automation') {
                                    automationRoles.push(role);
                                } else {
                                    otherRoles.push(role);
                                }
                            }
                        } else {
                            hasNoRoleTrigger = true;
                        }
                    }
                });

                // Build trigger lanes in order: automation -> others -> no-role
                automationRoles.forEach(role => {
                    triggerLanes.push({ type: 'role', role: role, label: role });
                });
                otherRoles.forEach(role => {
                    triggerLanes.push({ type: 'role', role: role, label: role });
                });
                if (hasNoRoleTrigger) {
                    triggerLanes.push({ type: 'no-role', label: '(no role)' });
                }

                // Second pass: collect event systems
                let hasNoSystemEvent = false;
                let hasExternalEvent = false;
                const systemsList = [];

                data.slices.forEach(slice => {
                    if (slice.events && Array.isArray(slice.events)) {
                        slice.events.forEach(event => {
                            if (event.external) {
                                hasExternalEvent = true;
                            } else if (event.system && event.system.trim()) {
                                if (!seenSystems.has(event.system)) {
                                    seenSystems.add(event.system);
                                    systemsList.push(event.system);
                                }
                            } else {
                                hasNoSystemEvent = true;
                            }
                        });
                    }
                });

                // Build event lanes in order: no-system -> systems -> external
                if (hasNoSystemEvent) {
                    eventLanes.push({ type: 'no-system', label: '' });
                }
                systemsList.forEach(system => {
                    eventLanes.push({ type: 'system', system: system, label: system });
                });
                if (hasExternalEvent) {
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
            if (trigger.role && trigger.role.trim()) {
                return `role:${trigger.role}`;
            }
            return 'no-role';
        }

        /**
         * Determines which event lane an event belongs to
         */
        function getEventLaneKey(event, showSwimlanes) {
            if (!showSwimlanes) return 'all';
            if (!event) return 'no-system';
            if (event.external) return 'external';
            if (event.system && event.system.trim()) {
                return `system:${event.system}`;
            }
            return 'no-system';
        }

        // ===== END SWIMLANE DISCOVERY =====

        function generateEventModelDiagram(data) {
            if (!data.slices || !Array.isArray(data.slices)) {
                return '<div class="info-message">Invalid event model: slices array is required</div>';
            }

            const showSwimlanes = showSwimlanesCheckbox ? showSwimlanesCheckbox.checked : true;
            
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
                
                if (slice.command) {
                    cellContents.get(cellKey).push(generateCommand(slice.command, sliceIndex));
                } else if (slice.view) {
                    cellContents.get(cellKey).push(generateView(slice.view, sliceIndex, slice.view.events || []));
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
                
                // Test header
                html += `<div class="lane-header" style="grid-column: 1; grid-row: ${currentRow};">Tests</div>`;
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
            const triggerEvents = trigger.events ? trigger.events.join(',') : '';
            let html = `<div class="element trigger" data-trigger-events="${escapeHtml(triggerEvents)}" data-slice-index="${sliceIndex}">`;
            
            if (trigger.role) {
                html += `<div class="element-role">${escapeHtml(trigger.role)}</div>`;
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
            const eventNamesAttr = eventNames ? eventNames.join(',') : '';
            let html = `<div class="element view" id="${viewId}" data-view-events="${escapeHtml(eventNamesAttr)}">`;
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
