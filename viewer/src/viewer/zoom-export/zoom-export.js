        // Zoom and pan state
        let currentZoom = 1;
        let isDragging = false;
        let dragStartX = 0;
        let dragStartY = 0;
        let scrollLeft = 0;
        let scrollTop = 0;

        // DOM references (defined here so this module is self-contained)
        const diagramWrapper = document.getElementById('diagramWrapper');
        const diagramContainer = document.getElementById('diagramContainer');

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
        const zoomInBtn = document.getElementById('zoomInBtn');
        const zoomOutBtn = document.getElementById('zoomOutBtn');
        const zoomResetBtn = document.getElementById('zoomResetBtn');
        const zoomLevelDisplay = document.getElementById('zoomLevel');

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
