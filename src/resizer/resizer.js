        const resizer = document.getElementById('resizer');

        // Resizer state
        let isResizing = false;
        let resizeStartX = 0;
        let startWidth = 0;

        // Panel state management with localStorage persistence
        const panelState = {
            editor: {
                collapsed: false,
                savedWidth: '25%'
            },
            viewer: {
                collapsed: false,
                savedWidth: '75%'
            }
        };

        // Load layout state from localStorage
        function loadLayoutState() {
            try {
                const saved = localStorage.getItem('eventModelViewerLayout');
                if (saved) {
                    const state = JSON.parse(saved);
                    panelState.editor = state.editor || { collapsed: false, savedWidth: '25%' };
                    panelState.viewer = state.viewer || { collapsed: false, savedWidth: '75%' };
                    console.log('Layout state loaded from localStorage');
                } else {
                    console.log('No saved layout, using defaults (25/75)');
                }
            } catch (error) {
                console.warn('Failed to load layout state:', error);
            }
        }

        // Save layout state to localStorage
        function saveLayoutState() {
            try {
                const state = {
                    editor: {
                        collapsed: panelState.editor.collapsed,
                        savedWidth: panelState.editor.savedWidth
                    },
                    viewer: {
                        collapsed: panelState.viewer.collapsed,
                        savedWidth: panelState.viewer.savedWidth
                    }
                };
                localStorage.setItem('eventModelViewerLayout', JSON.stringify(state));
                console.log('Layout state saved to localStorage:', state);
            } catch (error) {
                console.warn('Failed to save layout state:', error);
            }
        }

        // Update panel layout based on state
        function updatePanelLayout() {
            const editorCollapsed = panelState.editor.collapsed;
            const viewerCollapsed = panelState.viewer.collapsed;
            
            // Update collapse classes
            editorPanel.classList.toggle('collapsed', editorCollapsed);
            diagramPanel.classList.toggle('collapsed', viewerCollapsed);
            
            if (editorCollapsed && viewerCollapsed) {
                // Both collapsed - minimal view
                editorPanel.style.width = '40px';
                diagramPanel.style.width = 'calc(100% - 40px)';
                resizer.style.display = 'none';
            } else if (editorCollapsed) {
                // Editor collapsed - viewer full width
                editorPanel.style.width = '40px';
                diagramPanel.style.width = 'calc(100% - 40px)';
                resizer.style.display = 'none';
            } else if (viewerCollapsed) {
                // Viewer collapsed - editor full width
                editorPanel.style.width = 'calc(100% - 40px)';
                diagramPanel.style.width = '40px';
                resizer.style.display = 'none';
            } else {
                // Both expanded - restore saved widths
                editorPanel.style.width = panelState.editor.savedWidth;
                diagramPanel.style.width = panelState.viewer.savedWidth;
                resizer.style.display = 'block';
            }
            
            // Update button icons
            panelCollapseBtn.textContent = editorCollapsed ? '▶' : '◀';
            viewerCollapseBtn.textContent = viewerCollapsed ? '◀' : '▶';
            
            // Resize ACE editor if it exists
            if (codeMirrorView && codeMirrorView.resize) {
                setTimeout(() => codeMirrorView.resize(), 100);
            }
        }

        // Resizer functionality
        resizer.addEventListener('mousedown', (e) => {
            // Only allow resize if both panels are expanded
            if (panelState.editor.collapsed || panelState.viewer.collapsed) {
                return;
            }
            
            isResizing = true;
            resizeStartX = e.clientX;
            startWidth = editorPanel.offsetWidth;
            resizer.classList.add('resizing');
            
            // Disable transitions for immediate response
            editorPanel.classList.add('resizing');
            diagramPanel.classList.add('resizing');
            
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;
            
            const deltaX = e.clientX - resizeStartX;
            const newEditorWidth = startWidth + deltaX;
            const containerWidth = editorPanel.parentElement.offsetWidth;
            
            // Set minimum widths (10% each, max 90%)
            const minWidth = containerWidth * 0.1;
            const maxWidth = containerWidth * 0.9;
            
            if (newEditorWidth >= minWidth && newEditorWidth <= maxWidth) {
                const editorWidthPercent = (newEditorWidth / containerWidth) * 100;
                const viewerWidthPercent = 100 - editorWidthPercent;
                
                // Update both panel widths
                editorPanel.style.width = editorWidthPercent + '%';
                diagramPanel.style.width = viewerWidthPercent + '%';
                
                // Update state (will be saved on mouseup)
                panelState.editor.savedWidth = editorWidthPercent + '%';
                panelState.viewer.savedWidth = viewerWidthPercent + '%';
            }
        });

        document.addEventListener('mouseup', () => {
            if (isResizing) {
                isResizing = false;
                resizer.classList.remove('resizing');
                
                // Re-enable transitions
                editorPanel.classList.remove('resizing');
                diagramPanel.classList.remove('resizing');
                
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
                
                // Save the new widths to localStorage
                saveLayoutState();
                
                // Resize ACE editor if it exists
                if (codeMirrorView && codeMirrorView.resize) {
                    codeMirrorView.resize();
                }
            }
        });

        // Editor panel collapse/expand handler
        panelCollapseBtn.addEventListener('click', () => {
            // If trying to collapse editor while viewer is collapsed, expand viewer first
            if (!panelState.editor.collapsed && panelState.viewer.collapsed) {
                panelState.viewer.collapsed = false;
            }
            
            panelState.editor.collapsed = !panelState.editor.collapsed;
            updatePanelLayout();
            saveLayoutState();
        });

        // Viewer panel collapse/expand handler
        viewerCollapseBtn.addEventListener('click', () => {
            // If trying to collapse viewer while editor is collapsed, expand editor first
            if (!panelState.viewer.collapsed && panelState.editor.collapsed) {
                panelState.editor.collapsed = false;
            }
            
            panelState.viewer.collapsed = !panelState.viewer.collapsed;
            updatePanelLayout();
            saveLayoutState();
        });
