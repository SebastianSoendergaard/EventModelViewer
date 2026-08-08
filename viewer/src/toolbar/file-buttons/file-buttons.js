        const fileInput = document.getElementById('fileInput');
        const fileName = document.getElementById('fileName');

        // Local state (no longer shared globals)
        let _currentJson = null;
        let _currentFileName = null;

        // Subscribe to JSON_CHANGED to keep local state and auto-save
        EventBus.on(Events.JSON_CHANGED, ({ json }) => {
            _currentJson = json;
            _saveJsonToLocalStorage(json, _currentFileName);
        });

        // Subscribe to FILE_LOADED to keep local filename state in sync
        EventBus.on(Events.FILE_LOADED, ({ json, fileName: name }) => {
            _currentJson = json;
            _currentFileName = name;
        });

        // Self-initialize when app is ready
        EventBus.on(Events.APP_INIT, () => {
            loadJsonFromLocalStorage();
        });

        // LocalStorage functions for JSON persistence
        function saveJsonToLocalStorage() {
            _saveJsonToLocalStorage(_currentJson, _currentFileName);
        }

        function _saveJsonToLocalStorage(json, name) {
            if (!json) return;
            try {
                const jsonString = JSON.stringify(json);
                localStorage.setItem('eventModelJson', jsonString);
                if (name) {
                    localStorage.setItem('eventModelFileName', name);
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
                    
                    // Restore filename if available
                    const savedFileName = localStorage.getItem('eventModelFileName');
                    const displayName = savedFileName || 'Restored from previous session';
                    fileName.textContent = displayName;

                    EventBus.emit(Events.FILE_LOADED, { json, fileName: savedFileName || null });
                    
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
            // Clear localStorage
            clearLocalStorage();
            
            // Clear file input
            fileInput.value = '';
            fileName.textContent = 'No file selected';
            
            EventBus.emit(Events.FILE_LOADED, { json: null, fileName: null });
            
            console.log('New document created');
        }

        // Save to file function
        function saveToFile() {
            if (!_currentJson) {
                alert('No content to save');
                return;
            }
            
            // Determine filename
            let fname = 'event-model.json';
            
            if (_currentFileName) {
                fname = _currentFileName;
            } else if (_currentJson.title) {
                fname = sanitizeFilename(_currentJson.title) + '.json';
            }
            
            // Create blob and download
            const jsonString = JSON.stringify(_currentJson, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = fname;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            console.log('File saved as:', fname);
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
                _currentFileName = file.name;
                fileName.textContent = file.name;
                
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const jsonContent = e.target.result;
                        console.log('File loaded, length:', jsonContent.length);
                        const json = JSON.parse(jsonContent);
                        console.log('JSON parsed successfully, keys:', Object.keys(json));
                        
                        EventBus.emit(Events.FILE_LOADED, { json, fileName: file.name });
                        
                        console.log('File loaded via EventBus');
                    } catch (error) {
                        console.error('Error loading file:', error);
                        EventBus.emit(Events.FILE_LOADED, { json: null, fileName: null });
                        document.getElementById('diagram').innerHTML =
                            `<div class="error-message">Invalid JSON file: ${error.message}</div>`;
                    }
                };
                reader.onerror = (e) => {
                    console.error('FileReader error:', e);
                    document.getElementById('diagram').innerHTML =
                        '<div class="error-message">Error reading file</div>';
                };
                reader.readAsText(file);
            }
        });

        // New button handler
        const newBtn = document.getElementById('newBtn');
        newBtn.addEventListener('click', () => {
            if (_currentJson) {
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
