        const fileInput = document.getElementById('fileInput');
        const fileName = document.getElementById('fileName');

        // LocalStorage functions for JSON persistence
        function saveJsonToLocalStorage() {
            try {
                const jsonString = JSON.stringify(currentJson);
                localStorage.setItem('eventModelJson', jsonString);
                if (currentFileName) {
                    localStorage.setItem('eventModelFileName', currentFileName);
                }
                console.log('JSON auto-saved to localStorage');
            } catch (error) {
                if (error.name === 'QuotaExceededError') {
                    console.warn('localStorage quota exceeded, could not save JSON');
                } else {
                    console.warn('Failed to save JSON to localStorage:', error);
                }
            }
        }

        function loadJsonFromLocalStorage() {
            try {
                const saved = localStorage.getItem('eventModelJson');
                if (saved) {
                    const json = JSON.parse(saved);
                    currentJson = json;
                    
                    // Restore filename if available
                    const savedFileName = localStorage.getItem('eventModelFileName');
                    if (savedFileName) {
                        currentFileName = savedFileName;
                        fileName.textContent = savedFileName;
                    } else {
                        fileName.textContent = 'Restored from previous session';
                    }
                    
                    // Initialize history
                    historyManager.clear();
                    historyManager.pushState(currentJson);
                    
                    // Update editor
                    if (codeMirrorView && codeMirrorView.setValue) {
                        codeMirrorView.setValue(JSON.stringify(currentJson, null, 2), -1);
                    }
                    
                    // Update tree view
                    renderTreeView();
                    
                    // Render diagram
                    renderDiagram(JSON.stringify(currentJson));
                    
                    console.log('JSON loaded from localStorage');
                    return true;
                }
            } catch (error) {
                console.warn('Failed to load JSON from localStorage:', error);
                // Clear corrupted data
                localStorage.removeItem('eventModelJson');
                localStorage.removeItem('eventModelFileName');
            }
            return false;
        }

        function clearLocalStorage() {
            try {
                localStorage.removeItem('eventModelJson');
                localStorage.removeItem('eventModelFileName');
                console.log('localStorage cleared');
            } catch (error) {
                console.warn('Failed to clear localStorage:', error);
            }
        }

        // New document function
        function createNew() {
            // Clear current data
            currentJson = null;
            currentFileName = null;
            
            // Clear localStorage
            clearLocalStorage();
            
            // Clear file input
            fileInput.value = '';
            fileName.textContent = 'No file selected';
            
            // Clear history
            historyManager.clear();
            
            // Clear editors
            if (codeMirrorView && codeMirrorView.setValue) {
                codeMirrorView.setValue('', -1);
            }
            
            // Clear tree view
            renderTreeView();
            
            // Clear diagram
            const diagramEl = document.getElementById('diagram');
            diagramEl.innerHTML = '<div class="placeholder">Create or load an event model to visualize</div>';
            
            console.log('New document created');
        }

        // Save to file function
        function saveToFile() {
            if (!currentJson) {
                alert('No content to save');
                return;
            }
            
            // Determine filename
            let filename = 'event-model.json';
            
            if (currentFileName) {
                // Use original filename if available
                filename = currentFileName;
            } else if (currentJson.title) {
                // Derive from title field
                filename = sanitizeFilename(currentJson.title) + '.json';
            }
            
            // Create blob and download
            const jsonString = JSON.stringify(currentJson, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            console.log('File saved as:', filename);
        }

        // Sanitize filename helper
        function sanitizeFilename(title) {
            return title
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-+|-+$/g, '')
                .substring(0, 50) || 'event-model';
        }

        // File upload handler
        fileInput.addEventListener('change', (event) => {
            console.log('File input changed');
            const file = event.target.files[0];
            console.log('File:', file);
            if (file) {
                currentFileName = file.name;
                fileName.textContent = file.name;
                
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const jsonContent = e.target.result;
                        console.log('File loaded, length:', jsonContent.length);
                        currentJson = JSON.parse(jsonContent);
                        console.log('JSON parsed successfully, keys:', Object.keys(currentJson));
                        collapsedLines.clear();
                        
                        // Clear history and push initial state
                        historyManager.clear();
                        historyManager.pushState(currentJson);
                        
                        // Update ACE Editor content
                        if (codeMirrorView && codeMirrorView.setValue) {
                            codeMirrorView.setValue(JSON.stringify(currentJson, null, 2), -1);
                        }
                        
                        // Update Tree view (renderCodeEditor is now a no-op when editor is active)
                        renderTreeView();
                        console.log('Editors updated');
                        renderDiagram(jsonContent);
                        console.log('Diagram rendered');
                        
                        // Save to localStorage
                        saveJsonToLocalStorage();
                    } catch (error) {
                        console.error('Error loading file:', error);
                        showError('Invalid JSON file: ' + error.message);
                    }
                };
                reader.onerror = (e) => {
                    console.error('FileReader error:', e);
                    showError('Error reading file');
                };
                reader.readAsText(file);
            }
        });

        // New button handler
        const newBtn = document.getElementById('newBtn');
        newBtn.addEventListener('click', () => {
            if (currentJson) {
                const confirmed = confirm('Create a new document? Any unsaved changes will be lost.');
                if (!confirmed) return;
            }
            createNew();
        });

        // Save button handler
        const saveBtn = document.getElementById('saveBtn');
        saveBtn.addEventListener('click', () => {
            saveToFile();
        });
