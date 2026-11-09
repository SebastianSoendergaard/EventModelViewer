        // Zoom and pan state
        let currentZoom = 1;
        let isDragging = false;
        let dragStartX = 0;
        let dragStartY = 0;
        let scrollLeft = 0;
        let scrollTop = 0;

        // The "fit" zoom — see computeFitZoom() — doubles as the hard zoom-out floor.
        // Starts at a low fallback so zoom still behaves sanely before any diagram has
        // ever been measured.
        let minZoomFloor = 0.1;
        let fitZoomFloor = 0.1;
        let restoredZoomBelowFitFloor = false;
        let pendingPresentationState = null;
        let fileLoadGeneration = 0;
        let _exportModel = null;

        // DOM references (defined here so this module is self-contained)
        const diagramWrapper = document.getElementById('diagramWrapper');
        const diagramContainer = document.getElementById('diagramContainer');
        const diagramElement = document.getElementById('diagram');

        // Measures the rendered event-model diagram's natural (unscaled) size. CSS
        // transforms never affect layout size, so offsetWidth/offsetHeight here are
        // always the pre-zoom dimensions regardless of the currently-applied scale.
        // Returns null when no diagram is rendered (placeholder/error state) — fit-zoom
        // is inert in that case, there's nothing to fit.
        function measureDiagramContentSize() {
            const diagramDiv = document.querySelector('.event-model-diagram');
            if (!diagramDiv) return null;
            const width = diagramDiv.offsetWidth;
            const height = diagramDiv.offsetHeight;
            if (!width || !height) return null;
            return { width, height };
        }

        // The largest zoom at which the diagram's natural size still fits entirely
        // inside the viewport in both directions (like CSS `background-size: contain`).
        // For a diagram naturally smaller than the viewport this can be above 100% —
        // that's intentional, it's simply how large the diagram can get before either
        // dimension would exceed the viewport. Zooming out further than this value
        // would only ever add blank canvas around the content, never reveal more of
        // it, so it doubles as the zoom-out floor. Returns null when there's nothing
        // to fit (see measureDiagramContentSize).
        function computeFitZoom() {
            const size = measureDiagramContentSize();
            const viewportWidth = diagramContainer.clientWidth;
            const viewportHeight = diagramContainer.clientHeight;
            if (!size || !viewportWidth || !viewportHeight) return null;
            return Math.min(viewportWidth / size.width, viewportHeight / size.height);
        }

        // Resizes diagram-wrapper to reserve exactly the diagram's current on-screen
        // (post-zoom) footprint. Without this, the wrapper would still occupy the
        // diagram's natural, unscaled size (transforms don't affect layout size),
        // leaving the container unable to center it or scroll exactly to its bounds.
        function sizeWrapperToContent() {
            const size = measureDiagramContentSize();
            if (!size) {
                // No real content (placeholder/error) — release any explicit sizing
                // and let the wrapper shrink-wrap the message, same as any other panel.
                diagramWrapper.style.width = '';
                diagramWrapper.style.height = '';
                diagramWrapper.style.minWidth = '';
                diagramWrapper.style.minHeight = '';
                return;
            }
            diagramWrapper.style.minWidth = '0';
            diagramWrapper.style.minHeight = '0';
            diagramWrapper.style.width = `${size.width * currentZoom}px`;
            diagramWrapper.style.height = `${size.height * currentZoom}px`;
        }

        // Zoom functions
        function emitPresentationStateChanged() {
            EventBus.emit(Events.PRESENTATION_STATE_CHANGED, {
                zoom: currentZoom,
                scrollLeft: diagramContainer.scrollLeft,
                scrollTop: diagramContainer.scrollTop
            });
        }

        function setZoom(zoom) {
            currentZoom = Math.min(Math.max(zoom, minZoomFloor), 5); // Clamp between the content-fit floor and 500%
            if (restoredZoomBelowFitFloor && currentZoom >= fitZoomFloor) {
                restoredZoomBelowFitFloor = false;
                minZoomFloor = fitZoomFloor;
            }
            diagramElement.style.transform = `scale(${currentZoom})`;
            zoomLevelDisplay.textContent = `${Math.round(currentZoom * 100)}%`;
            sizeWrapperToContent();
            emitPresentationStateChanged();
        }

        // Changes zoom while keeping a specific point of the diagram content fixed
        // under a specific point of the viewport — e.g. so the content under the
        // mouse cursor doesn't appear to slide away when scroll-zooming, or so
        // whatever's centered on screen stays centered when using the zoom buttons.
        // viewportX/viewportY are in diagramContainer's own coordinate space (i.e.
        // relative to its top-left corner, unaffected by its own scroll position).
        function zoomAroundViewportPoint(newZoom, viewportX, viewportY) {
            // The content point currently sitting under (viewportX, viewportY),
            // expressed in unscaled diagram coordinates (dividing out currentZoom).
            const contentX = (diagramContainer.scrollLeft + viewportX) / currentZoom;
            const contentY = (diagramContainer.scrollTop + viewportY) / currentZoom;
            setZoom(newZoom);
            // Re-place that same content point back under (viewportX, viewportY) at
            // the new scale. setZoom() already clamped currentZoom, so re-read it
            // rather than assuming newZoom was applied verbatim. The browser clamps
            // scrollLeft/scrollTop to the valid range on its own when the content is
            // smaller than the viewport in a dimension (e.g. at the fit-zoom floor).
            diagramContainer.scrollLeft = contentX * currentZoom - viewportX;
            diagramContainer.scrollTop = contentY * currentZoom - viewportY;
            emitPresentationStateChanged();
        }

        // Anchored on the center of the currently visible viewport area, so whatever
        // the user is currently looking at stays centered after zooming.
        function zoomAroundViewportCenter(newZoom) {
            zoomAroundViewportPoint(newZoom, diagramContainer.clientWidth / 2, diagramContainer.clientHeight / 2);
        }

        function zoomIn() {
            zoomAroundViewportCenter(currentZoom + 0.1);
        }

        function zoomOut() {
            zoomAroundViewportCenter(currentZoom - 0.1);
        }

        function resetZoom() {
            const fit = computeFitZoom();
            restoredZoomBelowFitFloor = false;
            if (fit !== null) {
                fitZoomFloor = Math.min(fit, 5);
                minZoomFloor = fitZoomFloor;
            }
            setZoom(fit !== null ? fit : 1);
        }

        // Recomputes the fit-zoom floor after content or viewport size changes. Only
        // forces the current zoom up to the new floor when it's now invalid (would
        // leave blank canvas showing) or when explicitly requested (fresh file load) —
        // a routine edit shouldn't yank the user's current pan/zoom around.
        function refreshFitZoom(forceReset) {
            const fit = computeFitZoom();
            if (fit === null) {
                sizeWrapperToContent(); // placeholder/error — release explicit sizing
                return;
            }
            fitZoomFloor = Math.min(fit, 5);
            if (forceReset) {
                restoredZoomBelowFitFloor = false;
                minZoomFloor = fitZoomFloor;
                setZoom(fitZoomFloor);
            } else if (restoredZoomBelowFitFloor && currentZoom < fitZoomFloor) {
                minZoomFloor = currentZoom;
                sizeWrapperToContent();
            } else {
                restoredZoomBelowFitFloor = false;
                minZoomFloor = fitZoomFloor;
                if (currentZoom < minZoomFloor) {
                    setZoom(minZoomFloor);
                } else {
                    sizeWrapperToContent(); // zoom unchanged, but content size may have — re-measure
                }
            }
        }

        // Zoom button handlers
        const zoomInBtn = document.getElementById('zoomInBtn');
        const zoomOutBtn = document.getElementById('zoomOutBtn');
        const zoomResetBtn = document.getElementById('zoomResetBtn');
        const zoomLevelDisplay = document.getElementById('zoomLevel');

        zoomInBtn.addEventListener('click', zoomIn);
        zoomOutBtn.addEventListener('click', zoomOut);
        zoomResetBtn.addEventListener('click', resetZoom);

        // Re-fit whenever what's drawn can change size...
        EventBus.on(Events.MODEL_CHANGED, ({ model }) => {
            _exportModel = model;
            if (!model) return; // cleared document — nothing to fit
            refreshFitZoom(false);
        });
        EventBus.on(Events.FILTER_TOGGLED, () => refreshFitZoom(false));
        EventBus.on(Events.EDITOR_RESIZED, () => refreshFitZoom(false));
        EventBus.on(Events.PRESENTATION_STATE_LOADED, ({ state }) => {
            pendingPresentationState = state;
        });
        // ...or a fresh file is loaded, which should always reset the view to fit —
        // deferred to a fresh task so it runs after the MODEL_CHANGED render this
        // triggers (which may fire synchronously within the same FILE_LOADED emit)
        // has updated the diagram DOM, regardless of module registration order.
        EventBus.on(Events.FILE_LOADED, () => {
            restoredZoomBelowFitFloor = false;
            const generation = ++fileLoadGeneration;
            const presentationState = pendingPresentationState;
            pendingPresentationState = null;
            setTimeout(() => {
                if (generation !== fileLoadGeneration) return;
                refreshFitZoom(true);
                if (presentationState) {
                    if (Number.isFinite(presentationState.zoom) && presentationState.zoom > 0 && presentationState.zoom <= 5) {
                        minZoomFloor = Math.min(fitZoomFloor, presentationState.zoom);
                        restoredZoomBelowFitFloor = presentationState.zoom < fitZoomFloor;
                        setZoom(presentationState.zoom);
                    }
                    diagramContainer.scrollLeft = presentationState.scrollLeft;
                    diagramContainer.scrollTop = presentationState.scrollTop;
                    emitPresentationStateChanged();
                }
            }, 0);
        });
        // ...or the viewport itself resizes (debounced to avoid thrashing mid-drag).
        let _fitZoomResizeDebounce = null;
        window.addEventListener('resize', () => {
            clearTimeout(_fitZoomResizeDebounce);
            _fitZoomResizeDebounce = setTimeout(() => refreshFitZoom(false), 150);
        });

        diagramContainer.addEventListener('scroll', emitPresentationStateChanged);

        // Temporarily resets the diagram zoom to 100% so exports are always generated
        // from the unscaled layout, regardless of the on-screen viewing zoom. Bypasses
        // setZoom (and its content-fit floor) since exports always want the literal
        // 1:1 layout, even when fit-zoom is currently above 100%. Returns a restore
        // function that puts the previous zoom back.
        function withResetZoomForExport() {
            const previousZoom = currentZoom;
            if (previousZoom !== 1) {
                diagramElement.style.transform = 'scale(1)';
                zoomLevelDisplay.textContent = '100%';
            }
            return () => {
                if (previousZoom !== 1) {
                    diagramElement.style.transform = `scale(${previousZoom})`;
                    zoomLevelDisplay.textContent = `${Math.round(previousZoom * 100)}%`;
                }
            };
        }

        // Export functions
        function removeFilteredDiagramElements(diagramElement) {
            diagramElement.querySelectorAll('.tests-container.hidden').forEach(element => element.remove());

            if (diagramElement.classList.contains('swimlanes-hidden')) {
                diagramElement.querySelectorAll('.lane-header').forEach(element => element.remove());
            }

            diagramElement.querySelectorAll('.slice-border, .slice-background').forEach(element => {
                if (element.style.display === 'none') {
                    element.remove();
                }
            });
        }

        async function exportToPNG() {
            const restoreZoom = withResetZoomForExport();
            try {
                const diagramDiv = document.querySelector('.event-model-diagram');
                if (!diagramDiv) {
                    alert('No diagram to export. Please load an emj file first.');
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

                const inputStates = Array.from(
                    diagramDiv.querySelectorAll('.trigger-input-field'),
                    input => ({ value: input.value, scrollLeft: input.scrollLeft })
                );

                // Capture the diagram as canvas.
                // Two html2canvas quirks are worked around in the cloned document it renders from
                // (this does not touch the live page):
                // 1. The arrows overlay contains invisible wide "hit-area" paths (stroke="transparent")
                //    used only for mouse hover/click interaction. html2canvas doesn't render
                //    stroke="transparent" as invisible — it paints it as an opaque blob — so they're
                //    removed before capture.
                // 2. html2canvas's box-shadow renderer misplaces blurred shadows on rounded elements,
                //    producing stray gray "shadow" rectangles unrelated to any visible element.
                //    Disabling box-shadow for the capture avoids these artifacts; the shadows are a
                //    minor decorative touch so losing them in the exported image is not noticeable.
                const canvas = await html2canvas(diagramDiv, {
                    backgroundColor: '#ffffff',
                    scale: 2, // Higher quality
                    logging: false,
                    onclone: (clonedDoc) => {
                        const clonedInputs = clonedDoc.querySelectorAll('.trigger-input-field');
                        if (clonedInputs.length !== inputStates.length) {
                            throw new Error('Unable to prepare Diagram Image Export: input fields changed during capture.');
                        }

                        const inputStyleProperties = [
                            'box-sizing',
                            'padding-top',
                            'padding-right',
                            'padding-bottom',
                            'padding-left',
                            'margin-top',
                            'margin-right',
                            'margin-bottom',
                            'margin-left',
                            'border-top-width',
                            'border-top-style',
                            'border-top-color',
                            'border-right-width',
                            'border-right-style',
                            'border-right-color',
                            'border-bottom-width',
                            'border-bottom-style',
                            'border-bottom-color',
                            'border-left-width',
                            'border-left-style',
                            'border-left-color',
                            'border-top-left-radius',
                            'border-top-right-radius',
                            'border-bottom-right-radius',
                            'border-bottom-left-radius',
                            'background-color',
                            'color',
                            'font-family',
                            'font-size',
                            'font-style',
                            'font-weight',
                            'line-height',
                            'letter-spacing',
                            'text-align',
                            'text-indent',
                            'text-transform',
                            'direction'
                        ];

                        clonedInputs.forEach((input, index) => {
                            const inputState = inputStates[index];
                            const computedStyle = clonedDoc.defaultView.getComputedStyle(input);
                            const staticField = clonedDoc.createElement('div');
                            staticField.className = 'trigger-input-field diagram-image-export-static-input';

                            inputStyleProperties.forEach(property => {
                                const value = computedStyle.getPropertyValue(property);
                                if (value) staticField.style.setProperty(property, value);
                            });

                            const bounds = input.getBoundingClientRect();
                            staticField.style.width = `${bounds.width}px`;
                            staticField.style.height = `${bounds.height}px`;
                            staticField.style.display = 'flex';
                            staticField.style.alignItems = 'center';
                            staticField.style.overflow = 'hidden';
                            staticField.style.whiteSpace = 'nowrap';

                            const viewport = clonedDoc.createElement('span');
                            viewport.className = 'diagram-image-export-static-input__viewport';
                            viewport.style.display = 'flex';
                            viewport.style.alignItems = 'center';
                            viewport.style.flex = '1 1 auto';
                            viewport.style.minWidth = '0';
                            viewport.style.overflow = 'hidden';
                            viewport.style.whiteSpace = 'nowrap';

                            const text = clonedDoc.createElement('span');
                            text.className = 'diagram-image-export-static-input__text';
                            text.textContent = inputState.value;
                            text.style.display = 'block';
                            text.style.flex = '0 0 auto';
                            text.style.whiteSpace = 'pre';
                            text.style.transform = `translateX(${-inputState.scrollLeft}px)`;

                            viewport.appendChild(text);
                            staticField.appendChild(viewport);
                            input.replaceWith(staticField);
                        });

                        removeFilteredDiagramElements(clonedDoc.querySelector('.event-model-diagram'));
                        clonedDoc.querySelectorAll('.arrow-hitarea').forEach(el => el.remove());
                        const style = clonedDoc.createElement('style');
                        style.textContent = '* { box-shadow: none !important; }';
                        clonedDoc.head.appendChild(style);
                    }
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
            } finally {
                restoreZoom();
            }
        }

        function escapeDrawioXml(value) {
            return String(value ?? '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&apos;');
        }

        function drawioLabel(value) {
            return escapeDrawioXml(String(value ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n/g, '<br>'));
        }

        function isVisibleForDrawioExport(element) {
            const style = window.getComputedStyle(element);
            return style.display !== 'none' && style.visibility !== 'hidden' && element.getClientRects().length > 0;
        }

        function drawioBounds(element, diagramDiv) {
            const elementRect = element.getBoundingClientRect();
            const diagramRect = diagramDiv.getBoundingClientRect();
            return {
                x: Math.max(0, elementRect.left - diagramRect.left),
                y: Math.max(0, elementRect.top - diagramRect.top),
                width: Math.max(40, elementRect.width),
                height: Math.max(24, elementRect.height)
            };
        }

        function drawioElementLabel(element, kindOverride) {
            const kind = kindOverride || element.getAttribute('data-inline-edit-kind');
            if (kind === 'trigger') {
                return element.closest('.trigger-slot')?.innerText.trim() || 'Trigger';
            }
            if (kind === 'slice') {
                return element.textContent.trim();
            }
            if (kind === 'test-case') {
                return element.querySelector('[data-inline-edit-kind="test-name"]')?.textContent.trim() || 'Test case';
            }
            if (kind === 'test-item' || kind === 'test-error' || kind === 'test-name' || kind === 'test-section') {
                return element.innerText.trim();
            }
            if (kind === 'slice-background' || kind === 'slice-border') {
                return '';
            }
            const title = element.querySelector('.element-title')?.textContent.trim() || '';
            const text = element.querySelector('.element-text')?.textContent.trim() || '';
            const properties = Array.from(element.querySelectorAll('.element-property'))
                .map(property => property.textContent.trim())
                .filter(Boolean);
            return [title, text, ...properties].filter(Boolean).join('\n');
        }

        function drawioStyleForElement(element, kindOverride) {
            const kind = kindOverride || element.getAttribute('data-inline-edit-kind');
            if (kind === 'title') {
                return 'text;html=1;align=center;verticalAlign=middle;fontStyle=1;fontSize=18;';
            }
            if (kind === 'lane-header' || kind === 'test-section') {
                return 'text;html=1;align=left;verticalAlign=middle;fontStyle=1;fontSize=12;';
            }
            if (kind === 'slice') {
                return 'text;html=1;align=center;verticalAlign=middle;fontStyle=1;fontSize=14;';
            }
            if (kind === 'slice-background') {
                const color = element.style.backgroundColor || '#ffffff';
                return `rounded=1;html=1;fillColor=${color};opacity=18;strokeColor=none;connectable=0;`;
            }
            if (kind === 'slice-border') {
                const color = element.style.borderColor || '#000000';
                return `rounded=1;html=1;fillColor=none;strokeColor=${color};strokeWidth=3;connectable=0;`;
            }
            if (kind === 'test-case') {
                return 'swimlane;html=1;whiteSpace=wrap;rounded=1;startSize=24;horizontal=1;fillColor=#ffffff;strokeColor=#34495e;fontColor=#2c3e50;container=1;';
            }
            if (kind === 'trigger') {
                return 'ellipse;whiteSpace=wrap;html=1;fillColor=#ecf0f1;strokeColor=#95a5a6;fontColor=#2c3e50;';
            }
            if (kind === 'command') {
                return 'rounded=1;whiteSpace=wrap;html=1;fillColor=#3498db;strokeColor=#21618c;fontColor=#ffffff;';
            }
            if (kind === 'view') {
                return 'rounded=1;whiteSpace=wrap;html=1;fillColor=#2ecc71;strokeColor=#1e8449;fontColor=#ffffff;';
            }
            if (kind === 'event') {
                const isExternal = element.classList.contains('external');
                return isExternal
                    ? 'rounded=1;whiteSpace=wrap;html=1;fillColor=#f1c40f;strokeColor=#f39c12;fontColor=#333333;'
                    : 'rounded=1;whiteSpace=wrap;html=1;fillColor=#e67e22;strokeColor=#ba4a00;fontColor=#ffffff;';
            }
            if (kind === 'note') {
                return 'shape=note;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#000000;fontColor=#000000;';
            }
            if (kind === 'hotspot') {
                return 'rounded=1;whiteSpace=wrap;html=1;fillColor=#ff0000;strokeColor=#c0392b;fontColor=#ffffff;';
            }
            if (kind === 'test-item') {
                if (element.classList.contains('test-event')) {
                    return 'rounded=1;whiteSpace=wrap;html=1;fillColor=#e67e22;strokeColor=#ba4a00;fontColor=#ffffff;';
                }
                if (element.classList.contains('test-view')) {
                    return 'rounded=1;whiteSpace=wrap;html=1;fillColor=#2ecc71;strokeColor=#1e8449;fontColor=#ffffff;';
                }
                if (element.classList.contains('test-command')) {
                    return 'rounded=1;whiteSpace=wrap;html=1;fillColor=#3498db;strokeColor=#21618c;fontColor=#ffffff;';
                }
            }
            if (kind === 'test-error') {
                return 'rounded=1;whiteSpace=wrap;html=1;fillColor=#e74c3c;strokeColor=#a93226;fontColor=#ffffff;';
            }
            return 'rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#999999;';
        }

        function exportToDrawio() {
            const restoreZoom = withResetZoomForExport();
            try {
                const diagramDiv = document.querySelector('.event-model-diagram');
                if (!diagramDiv || !_exportModel) {
                    alert('No diagram to export. Please load an emj or emy file first.');
                    return;
                }

                const nodes = [];
                const nodeByElement = new Map();
                const testCaseNodes = new Map();
                let nextId = 2;

                const addNode = (element, label, kindOverride, parentNode) => {
                    if (!element || !isVisibleForDrawioExport(element) || nodeByElement.has(element)) return null;
                    const kind = kindOverride || element.getAttribute('data-inline-edit-kind') || '';
                    const id = `node-${nextId++}`;
                    const absoluteBounds = drawioBounds(element, diagramDiv);
                    const bounds = parentNode
                        ? {
                            ...absoluteBounds,
                            x: absoluteBounds.x - parentNode.absoluteBounds.x,
                            y: absoluteBounds.y - parentNode.absoluteBounds.y
                        }
                        : absoluteBounds;
                    const node = {
                        id,
                        element,
                        kind,
                        label: label !== undefined ? label : drawioElementLabel(element, kind),
                        sliceIndex: Number.parseInt(element.getAttribute('data-slice-index'), 10),
                        bounds,
                        absoluteBounds,
                        parent: parentNode ? parentNode.id : '1'
                    };
                    nodes.push(node);
                    nodeByElement.set(element, node);
                    return node;
                };

                diagramDiv.querySelectorAll('.slice-background').forEach(element => {
                    addNode(element, '', 'slice-background');
                });
                diagramDiv.querySelectorAll('.slice-border').forEach(element => {
                    addNode(element, '', 'slice-border');
                });

                const title = diagramDiv.querySelector('.diagram-title');
                addNode(title, title?.textContent.trim() || 'Event Model', 'title');

                diagramDiv.querySelectorAll('.lane-header').forEach(element => {
                    if (element.textContent.trim()) {
                        addNode(element, element.textContent.trim(), 'lane-header');
                    }
                });

                diagramDiv.querySelectorAll('.grid-cell.slice-header[data-slice-index]').forEach(element => {
                    addNode(element, element.textContent.trim(), 'slice');
                });

                diagramDiv.querySelectorAll('.test-case[data-inline-edit-kind]').forEach(element => {
                    const node = addNode(element, undefined, 'test-case');
                    if (node) testCaseNodes.set(element, node);
                });

                diagramDiv.querySelectorAll(
                    '.element[data-inline-edit-kind], ' +
                    '[data-inline-edit-kind="test-item"], ' +
                    '[data-inline-edit-kind="test-error"], ' +
                    '.test-section-label[data-context-menu-test-section]'
                ).forEach(element => {
                    if (element.classList.contains('test-case')) return;
                    const testCase = element.closest('.test-case');
                    const parentNode = testCase ? testCaseNodes.get(testCase) : null;
                    const kind = element.matches('.test-section-label') ? 'test-section' : undefined;
                    addNode(element, undefined, kind, parentNode);
                });

                const nodesForKind = kind => nodes.filter(node => node.kind === kind);
                const addEdge = (edges, source, target, dashed = false) => {
                    if (!source || !target || source === target) return;
                    const key = `${source.id}->${target.id}`;
                    if (edges.some(edge => edge.key === key)) return;
                    edges.push({ key, source, target, dashed });
                };

                const edges = [];
                const triggers = nodesForKind('trigger');
                const commands = nodesForKind('command');
                const events = nodesForKind('event');
                const views = nodesForKind('view');

                const bySlice = (collection, sliceIndex) =>
                    collection.filter(node => node.sliceIndex === sliceIndex);
                const findByAttribute = (collection, attribute, value) =>
                    collection.filter(node => node.element.getAttribute(attribute) === value);
                const precedingOrFollowing = (collection, sliceIndex, preferPreceding) => {
                    const sameSlice = bySlice(collection, sliceIndex);
                    if (sameSlice.length > 0) return { node: sameSlice[0], dashed: false };

                    const candidates = collection
                        .filter(node => Number.isFinite(node.sliceIndex))
                        .sort((left, right) => left.sliceIndex - right.sliceIndex);
                    const preceding = candidates.filter(node => node.sliceIndex < sliceIndex);
                    if (preferPreceding && preceding.length > 0) {
                        return { node: preceding[preceding.length - 1], dashed: false };
                    }
                    const following = candidates.filter(node => node.sliceIndex > sliceIndex);
                    return following.length > 0
                        ? { node: following[0], dashed: true }
                        : null;
                };

                commands.forEach(command => {
                    const trigger = bySlice(triggers, command.sliceIndex)[0];
                    addEdge(edges, trigger, command);

                    const eventIds = (command.element.getAttribute('data-command-events') || '')
                        .split(',')
                        .map(value => value.trim())
                        .filter(Boolean);
                    const commandEvents = eventIds.length > 0
                        ? eventIds.flatMap(eventId => findByAttribute(events, 'data-event-id', eventId))
                        : bySlice(events, command.sliceIndex);
                    commandEvents.forEach(event => addEdge(edges, command, event));
                });

                views.forEach(view => {
                    const eventIds = (view.element.getAttribute('data-view-events') || '')
                        .split(',')
                        .map(value => value.trim())
                        .filter(Boolean);
                    eventIds.forEach(eventId => {
                        const matches = findByAttribute(events, 'data-event-id', eventId);
                        const selected = precedingOrFollowing(matches, view.sliceIndex, true);
                        if (selected) addEdge(edges, selected.node, view, selected.dashed);
                    });
                });

                triggers.forEach(trigger => {
                    const viewIds = (trigger.element.getAttribute('data-trigger-views') || '')
                        .split(',')
                        .map(value => value.trim())
                        .filter(Boolean);
                    viewIds.forEach(viewId => {
                        const matches = findByAttribute(views, 'data-view-id', viewId);
                        const selected = precedingOrFollowing(matches, trigger.sliceIndex, true);
                        if (selected) addEdge(edges, trigger, selected.node, selected.dashed);
                    });
                });

                const cellXml = nodes.map(node => {
                    const { x, y, width, height } = node.bounds;
                    const style = drawioStyleForElement(node.element, node.kind);
                    return `<mxCell id="${node.id}" value="${drawioLabel(node.label)}" style="${escapeDrawioXml(style)}" vertex="1" parent="${node.parent}"><mxGeometry x="${Math.round(x)}" y="${Math.round(y)}" width="${Math.round(width)}" height="${Math.round(height)}" as="geometry"/></mxCell>`;
                }).join('');

                const edgeXml = edges.map((edge, index) => {
                    const dashed = edge.dashed ? 'dashed=1;' : '';
                    return `<mxCell id="edge-${index + 1}" style="edgeStyle=orthogonalEdgeStyle;rounded=1;curved=1;orthogonalLoop=1;jettySize=auto;html=1;endArrow=block;${dashed}" edge="1" parent="1" source="${edge.source.id}" target="${edge.target.id}"><mxGeometry relative="1" as="geometry"/></mxCell>`;
                }).join('');

                const diagramName = _exportModel.title || 'Event Model';
                const xml = `<?xml version="1.0" encoding="UTF-8"?>
<mxfile host="app.diagrams.net">
  <diagram id="event-model" name="${escapeDrawioXml(diagramName)}">
    <mxGraphModel dx="0" dy="0" grid="0" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="850" pageHeight="1100" background="#ffffff" math="0" shadow="0">
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
        ${cellXml}
        ${edgeXml}
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>`;

                const blob = new Blob([xml], { type: 'application/xml' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = 'event-model-diagram.drawio';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
            } catch (error) {
                console.error('Export to Draw.io failed:', error);
                alert('Failed to export Draw.io diagram: ' + error.message);
            } finally {
                restoreZoom();
            }
        }

        function exportToSVG() {
            const restoreZoom = withResetZoomForExport();
            try {
                const diagramDiv = document.querySelector('.event-model-diagram');
                if (!diagramDiv) {
                    alert('No diagram to export. Please load an emj file first.');
                    return;
                }

                // Clone the diagram div
                const clone = diagramDiv.cloneNode(true);

                removeFilteredDiagramElements(clone);

                // Remove invisible arrow hit-area paths — they exist only for mouse
                // interaction and serve no purpose in a static export.
                clone.querySelectorAll('.arrow-hitarea').forEach(el => el.remove());
                
                // Get computed styles
                const styles = window.getComputedStyle(diagramDiv);
                const width = diagramDiv.offsetWidth;
                const height = diagramDiv.offsetHeight;

                // The app's base typography (font-family, color, etc.) is set on <body> and
                // inherited from there. A standalone SVG document has no <body> element (its
                // root is <svg>), so that rule never matches and text silently falls back to
                // the browser's default serif font. Copy the live computed values onto the
                // clone directly so the export is self-contained and typography matches
                // what's shown on screen.
                clone.style.fontFamily = styles.fontFamily;
                clone.style.color = styles.color;
                clone.style.fontSize = styles.fontSize;
                clone.style.lineHeight = styles.lineHeight;

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
            } finally {
                restoreZoom();
            }
        }

        // Export button handlers
        const exportPngBtn = document.getElementById('exportPngBtn');
        const exportSvgBtn = document.getElementById('exportSvgBtn');
        const exportDrawioBtn = document.getElementById('exportDrawioBtn');
        
        exportPngBtn.addEventListener('click', exportToPNG);
        exportSvgBtn.addEventListener('click', exportToSVG);
        exportDrawioBtn.addEventListener('click', exportToDrawio);

        // Ctrl + scroll to zoom, anchored on the mouse cursor position so the content
        // under the cursor stays put rather than sliding away.
        diagramContainer.addEventListener('wheel', (e) => {
            if (e.ctrlKey) {
                e.preventDefault();
                const delta = e.deltaY > 0 ? -0.1 : 0.1;
                const rect = diagramContainer.getBoundingClientRect();
                zoomAroundViewportPoint(currentZoom + delta, e.clientX - rect.left, e.clientY - rect.top);
            }
        }, { passive: false });

        // Mouse drag to pan the diagram
        diagramContainer.addEventListener('mousedown', (e) => {
            // Ignore controls and the modal diagram editor so form controls can receive focus.
            const resizerEl = document.getElementById('resizer');
            if (e.target.closest('.zoom-controls, .inline-edit-editor, .inline-edit-rename-choice, input, textarea, select, button') ||
                (resizerEl && resizerEl.classList.contains('resizing'))) return;
            
            isDragging = true;
            diagramContainer.classList.add('dragging');
            dragStartX = e.pageX - diagramContainer.offsetLeft;
            dragStartY = e.pageY - diagramContainer.offsetTop;
            scrollLeft = diagramContainer.scrollLeft;
            scrollTop = diagramContainer.scrollTop;
            e.preventDefault();
        });

        diagramContainer.addEventListener('mouseleave', () => {
            if (isDragging) {
                isDragging = false;
                diagramContainer.classList.remove('dragging');
            }
        });

        diagramContainer.addEventListener('mouseup', () => {
            isDragging = false;
            diagramContainer.classList.remove('dragging');
        });

        diagramContainer.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            e.preventDefault();
            const x = e.pageX - diagramContainer.offsetLeft;
            const y = e.pageY - diagramContainer.offsetTop;
            const walkX = (x - dragStartX) * 1.5;
            const walkY = (y - dragStartY) * 1.5;
            diagramContainer.scrollLeft = scrollLeft - walkX;
            diagramContainer.scrollTop = scrollTop - walkY;
        });
