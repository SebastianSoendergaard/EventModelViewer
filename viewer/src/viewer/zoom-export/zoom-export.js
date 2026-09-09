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
        function setZoom(zoom) {
            currentZoom = Math.min(Math.max(zoom, minZoomFloor), 5); // Clamp between the content-fit floor and 500%
            diagramElement.style.transform = `scale(${currentZoom})`;
            zoomLevelDisplay.textContent = `${Math.round(currentZoom * 100)}%`;
            sizeWrapperToContent();
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
            if (fit !== null) minZoomFloor = Math.min(fit, 5);
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
            minZoomFloor = Math.min(fit, 5);
            if (forceReset || currentZoom < minZoomFloor) {
                setZoom(minZoomFloor);
            } else {
                sizeWrapperToContent(); // zoom unchanged, but content size may have — re-measure
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
            if (!model) return; // cleared document — nothing to fit
            refreshFitZoom(false);
        });
        EventBus.on(Events.FILTER_TOGGLED, () => refreshFitZoom(false));
        EventBus.on(Events.EDITOR_RESIZED, () => refreshFitZoom(false));
        // ...or a fresh file is loaded, which should always reset the view to fit —
        // deferred to a fresh task so it runs after the MODEL_CHANGED render this
        // triggers (which may fire synchronously within the same FILE_LOADED emit)
        // has updated the diagram DOM, regardless of module registration order.
        EventBus.on(Events.FILE_LOADED, () => {
            setTimeout(() => refreshFitZoom(true), 0);
        });
        // ...or the viewport itself resizes (debounced to avoid thrashing mid-drag).
        let _fitZoomResizeDebounce = null;
        window.addEventListener('resize', () => {
            clearTimeout(_fitZoomResizeDebounce);
            _fitZoomResizeDebounce = setTimeout(() => refreshFitZoom(false), 150);
        });

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
        
        exportPngBtn.addEventListener('click', exportToPNG);
        exportSvgBtn.addEventListener('click', exportToSVG);

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
            // Ignore if clicking on zoom controls or if resizer is currently being dragged
            const resizerEl = document.getElementById('resizer');
            if (e.target.closest('.zoom-controls') || (resizerEl && resizerEl.classList.contains('resizing'))) return;
            
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
