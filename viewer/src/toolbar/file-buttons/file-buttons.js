        const fileInput = document.getElementById('fileInput');
        const fileName = document.getElementById('fileName');

        // Local state (no longer shared globals)
        let _currentJson = null;
        let _currentFileName = null;
        // Encoding for the current document (Codec.JSON or Codec.YAML). Authoritative
        // once _currentFileName is set (derived from its extension); otherwise this is
        // whatever the user picked in the New-document format picker.
        let _currentFormat = Codec.JSON;

        // Subscribe to JSON_CHANGED to keep local state and auto-save
        EventBus.on(Events.JSON_CHANGED, ({ json }) => {
            _currentJson = json;
            _saveJsonToLocalStorage(json, _currentFileName, _currentFormat);
        });

        // Subscribe to FILE_LOADED to keep local filename state in sync
        EventBus.on(Events.FILE_LOADED, ({ json, fileName: name, format }) => {
            _currentJson = json;
            _currentFileName = name;
            _currentFormat = format || Codec.formatForFileName(name);
        });

        // Self-initialize when app is ready
        EventBus.on(Events.APP_INIT, () => {
            loadJsonFromLocalStorage();
        });

        // LocalStorage functions for JSON persistence
        function saveJsonToLocalStorage() {
            _saveJsonToLocalStorage(_currentJson, _currentFileName, _currentFormat);
        }

        function _saveJsonToLocalStorage(json, name, format) {
            if (!json) return;
            try {
                const jsonString = JSON.stringify(json);
                localStorage.setItem('eventModelJson', jsonString);
                if (name) {
                    localStorage.setItem('eventModelFileName', name);
                }
                localStorage.setItem('eventModelFormat', format || Codec.JSON);
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
                    const savedFormat = localStorage.getItem('eventModelFormat') || Codec.JSON;
                    const displayName = savedFileName || 'Restored from previous session';
                    fileName.textContent = displayName;

                    EventBus.emit(Events.FILE_LOADED, { json, fileName: savedFileName || null, format: savedFormat });
                    
                    console.log('JSON loaded from localStorage');
                    return true;
                }
            } catch (error) {
                console.warn('Failed to load JSON from localStorage:', error);
                // Clear corrupted data
                localStorage.removeItem('eventModelJson');
                localStorage.removeItem('eventModelFileName');
                localStorage.removeItem('eventModelFormat');
            }
            return false;
        }

        function clearLocalStorage() {
            try {
                localStorage.removeItem('eventModelJson');
                localStorage.removeItem('eventModelFileName');
                localStorage.removeItem('eventModelFormat');
                console.log('localStorage cleared');
            } catch (error) {
                console.warn('Failed to clear localStorage:', error);
            }
        }

        // New document function
        function createNew(format) {
            // Clear localStorage
            clearLocalStorage();

            _currentFormat = format || Codec.JSON;

            // Clear file input
            fileInput.value = '';
            fileName.textContent = 'No file selected';
            
            EventBus.emit(Events.FILE_LOADED, { json: null, fileName: null, format: _currentFormat });
            
            console.log('New document created (.' + Codec.extensionFor(_currentFormat) + ')');
        }

        // Save to file function
        function saveToFile() {
            if (!_currentJson) {
                alert('No content to save');
                return;
            }

            // Determine filename — preserves the format the document was opened/created
            // with (round-trip fidelity); see ADR 0003.
            const extension = Codec.extensionFor(_currentFormat);
            let fname = 'event-model.' + extension;

            if (_currentFileName) {
                fname = _currentFileName;
            } else if (_currentJson.title) {
                fname = sanitizeFilename(_currentJson.title) + '.' + extension;
            }

            // Create blob and download
            const content = Codec.stringify(_currentJson, _currentFormat);
            const mimeType = _currentFormat === Codec.YAML ? 'application/x-yaml' : 'application/json';
            const blob = new Blob([content], { type: mimeType });
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
                _currentFormat = Codec.formatForFileName(file.name);
                fileName.textContent = file.name;
                
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const fileContent = e.target.result;
                        console.log('File loaded, length:', fileContent.length);
                        const json = Codec.parse(fileContent, _currentFormat);
                        console.log('Content parsed successfully, keys:', Object.keys(json));
                        
                        EventBus.emit(Events.FILE_LOADED, { json, fileName: file.name, format: _currentFormat });
                        
                        console.log('File loaded via EventBus');
                    } catch (error) {
                        console.error('Error loading file:', error);
                        EventBus.emit(Events.FILE_LOADED, { json: null, fileName: null });
                        document.getElementById('diagram').innerHTML =
                            `<div class="error-message">Invalid event model file: ${error.message}</div>`;
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
        newBtn.addEventListener('click', async () => {
            if (_currentJson) {
                const confirmed = confirm('Create a new document? Any unsaved changes will be lost.');
                if (!confirmed) return;
            }
            const choice = await FormatPicker.prompt({ title: 'New Event Model' });
            if (!choice) return;
            createNew(choice.format);
        });

        // Save button handler
        const saveBtn = document.getElementById('saveBtn');
        saveBtn.addEventListener('click', () => {
            saveToFile();
        });
