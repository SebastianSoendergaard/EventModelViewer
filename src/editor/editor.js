        const editorTabs = document.querySelectorAll('.editor-tab');
        const codeView = document.getElementById('codeView');
        const treeView = document.getElementById('treeView');

        // History Manager for Undo/Redo
        const historyManager = {
            states: [],
            currentIndex: -1,
            maxStates: 50,
            isRestoring: false,

            pushState(json) {
                if (this.isRestoring) return; // Don't push during undo/redo
                if (!json) return;

                // Check if JSON actually changed
                const jsonString = JSON.stringify(json);
                if (this.states.length > 0 && this.currentIndex >= 0) {
                    const lastState = this.states[this.currentIndex];
                    if (JSON.stringify(lastState) === jsonString) {
                        return; // No change, don't push
                    }
                }

                // Remove any states after current position (if we're in middle of history)
                if (this.currentIndex < this.states.length - 1) {
                    this.states = this.states.slice(0, this.currentIndex + 1);
                }

                // Deep clone the JSON to avoid reference issues
                const clonedJson = JSON.parse(jsonString);
                this.states.push(clonedJson);

                // Limit to maxStates (remove oldest if exceeded)
                if (this.states.length > this.maxStates) {
                    this.states.shift();
                } else {
                    this.currentIndex++;
                }

                this.updateButtons();
            },

            undo() {
                if (!this.canUndo()) return;

                this.currentIndex--;
                this.restoreState(this.states[this.currentIndex]);
                this.updateButtons();
            },

            redo() {
                if (!this.canRedo()) return;

                this.currentIndex++;
                this.restoreState(this.states[this.currentIndex]);
                this.updateButtons();
            },

            restoreState(json) {
                this.isRestoring = true;
                
                // Deep clone to avoid reference issues
                currentJson = JSON.parse(JSON.stringify(json));
                
                // Update ACE Editor if exists
                if (codeMirrorView && codeMirrorView.setValue) {
                    codeMirrorView.setValue(JSON.stringify(currentJson, null, 2), -1);
                }
                
                // Update tree view only
                renderTreeView();
                updateDiagram();
                
                this.isRestoring = false;
            },

            canUndo() {
                return this.currentIndex > 0;
            },

            canRedo() {
                return this.currentIndex < this.states.length - 1;
            },

            clear() {
                this.states = [];
                this.currentIndex = -1;
                this.updateButtons();
            },

            updateButtons() {
                const canUndo = this.canUndo();
                const canRedo = this.canRedo();

                // Update code toolbar buttons
                const codeUndoBtn = document.getElementById('codeUndoBtn');
                const codeRedoBtn = document.getElementById('codeRedoBtn');
                if (codeUndoBtn) codeUndoBtn.disabled = !canUndo;
                if (codeRedoBtn) codeRedoBtn.disabled = !canRedo;

                // Update tree toolbar buttons
                const treeUndoBtn = document.getElementById('treeUndoBtn');
                const treeRedoBtn = document.getElementById('treeRedoBtn');
                if (treeUndoBtn) treeUndoBtn.disabled = !canUndo;
                if (treeRedoBtn) treeRedoBtn.disabled = !canRedo;
            }
        };

        // Tab switching
        editorTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = tab.getAttribute('data-tab');
                
                // Update active tab
                editorTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                
                // Update active view
                if (tabName === 'code') {
                    codeView.classList.add('active');
                    treeView.classList.remove('active');
                    
                    // Refresh ACE Editor content if currentJson changed in Tree view
                    if (codeMirrorView && currentJson) {
                        const currentContent = codeMirrorView.getValue();
                        const expectedContent = JSON.stringify(currentJson, null, 2);
                        if (currentContent !== expectedContent) {
                            codeMirrorView.setValue(expectedContent, -1);
                        }
                    }
                } else {
                    treeView.classList.add('active');
                    codeView.classList.remove('active');
                    renderTreeView();
                }
            });
        });


        // Undo/Redo button handlers
        const codeUndoBtn = document.getElementById('codeUndoBtn');
        const codeRedoBtn = document.getElementById('codeRedoBtn');
        const treeUndoBtn = document.getElementById('treeUndoBtn');
        const treeRedoBtn = document.getElementById('treeRedoBtn');

        codeUndoBtn.addEventListener('click', () => historyManager.undo());
        codeRedoBtn.addEventListener('click', () => historyManager.redo());
        treeUndoBtn.addEventListener('click', () => historyManager.undo());
        treeRedoBtn.addEventListener('click', () => historyManager.redo());

        // Add Slice button handlers
        const codeAddSliceBtn = document.getElementById('codeAddSliceBtn');
        const treeAddSliceBtn = document.getElementById('treeAddSliceBtn');
        const addSliceContextMenu = document.getElementById('addSliceContextMenu');

        // Function to create a full slice template
        function createFullSliceTemplate() {
            return {
                "name": "New Slice",
                "border": "#000000",
                "trigger": {
                    "role": "User",
                    "type": "input-ui",
                    "buttons": ["Action"]
                },
                "command": {
                    "name": "New Command",
                    "properties": [
                        {
                            "name": "Property",
                            "type": "string"
                        }
                    ],
                    "events": ["New Event"]
                },
                "view": {
                    "name": "New View",
                    "properties": [
                        {
                            "name": "Property",
                            "type": "string"
                        }
                    ],
                    "events": ["New Event"]
                },
                "events": [
                    {
                        "name": "New Event",
                        "properties": [
                            {
                                "name": "Property",
                                "type": "string"
                            }
                        ]
                    }
                ],
                "tests": [
                    {
                        "name": "New Test",
                        "given": [],
                        "when": {
                            "name": "New Command"
                        },
                        "then": [
                            {
                                "name": "New Event"
                            }
                        ]
                    }
                ]
            };
        }

        // Function to create an event-only slice template
        function createEventOnlySliceTemplate() {
            return {
                "name": "New Slice",
                "events": [
                    {
                        "name": "New Event",
                        "properties": [
                            {
                                "name": "Property",
                                "type": "string"
                            }
                        ]
                    }
                ]
            };
        }

        // Function to add a slice to the model
        function addSliceToModel(sliceTemplate) {
            if (!currentJson || !currentJson.slices) {
                alert('No event model loaded. Please load a JSON file first.');
                return;
            }

            // Add the new slice to the end of the slices array
            currentJson.slices.push(sliceTemplate);

            // Update code editor
            if (codeMirrorView && codeMirrorView.setValue) {
                codeMirrorView.setValue(JSON.stringify(currentJson, null, 2), -1);
            }

            // Update tree view
            renderTreeView();

            // Update diagram
            renderDiagram(JSON.stringify(currentJson));

            // Save to history
            historyManager.pushState(currentJson);

            // Save to localStorage
            saveJsonToLocalStorage();
        }

        // Show add slice context menu
        function showAddSliceMenu(buttonElement) {
            const rect = buttonElement.getBoundingClientRect();
            addSliceContextMenu.style.display = 'block';
            addSliceContextMenu.style.left = rect.left + 'px';
            addSliceContextMenu.style.top = (rect.bottom + 4) + 'px';
        }

        // Hide add slice context menu
        function hideAddSliceMenu() {
            addSliceContextMenu.style.display = 'none';
        }

        // Add slice button click handlers
        codeAddSliceBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            showAddSliceMenu(codeAddSliceBtn);
        });

        treeAddSliceBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            showAddSliceMenu(treeAddSliceBtn);
        });

        // Context menu item click handlers
        addSliceContextMenu.addEventListener('click', (e) => {
            e.stopPropagation();
            
            const menuItem = e.target.closest('.add-slice-menu-item');
            if (!menuItem) return;
            
            const action = menuItem.getAttribute('data-action');
            
            if (action === 'full-slice') {
                addSliceToModel(createFullSliceTemplate());
            } else if (action === 'event-slice') {
                addSliceToModel(createEventOnlySliceTemplate());
            }
            
            hideAddSliceMenu();
        });

        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.add-slice-context-menu') && 
                !e.target.closest('#codeAddSliceBtn') && 
                !e.target.closest('#treeAddSliceBtn')) {
                hideAddSliceMenu();
            }
        });

        // Close menu on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                hideAddSliceMenu();
            }
        });

        // Keyboard shortcuts for undo/redo
        document.addEventListener('keydown', (e) => {
            // Check if we're in an input field (contenteditable code editor)
            const target = e.target;
            const isInEditor = target.closest('#codeEditor') !== null;
            
            // Ctrl+Z for undo
            if (e.ctrlKey && e.key === 'z' && !e.shiftKey && !isInEditor) {
                e.preventDefault();
                historyManager.undo();
            }
            
            // Ctrl+Y for redo
            if (e.ctrlKey && e.key === 'y' && !isInEditor) {
                e.preventDefault();
                historyManager.redo();
            }
        });

        // Checkbox handlers
        showSlicesCheckbox.addEventListener('change', () => {
            toggleSliceBorders(showSlicesCheckbox.checked);
        });

        showTestsCheckbox.addEventListener('change', () => {
            toggleTests(showTestsCheckbox.checked);
        });

        showTypesCheckbox.addEventListener('change', () => {
            toggleTypes(showTypesCheckbox.checked);
        });

        showSwimlanesCheckbox.addEventListener('change', () => {
            // Re-render the entire diagram when swimlanes toggle changes
            if (currentJson) {
                renderDiagram(JSON.stringify(currentJson, null, 2));
            }
        });
