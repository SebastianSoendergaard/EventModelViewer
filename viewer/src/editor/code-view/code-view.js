        const codeEditor = document.getElementById('codeEditor');
        const codeCollapseBtn = document.getElementById('codeCollapseBtn');
        const codeExpandBtn = document.getElementById('codeExpandBtn');

        let collapsedLines = new Set();
        let jsonLines = [];
        let debounceTimer;
        // CodeMirror editor instance
        let codeEditorView = null;
        let previousFolds = new Set();
        let isProcessingFolds = false;

        // Local JSON state
        let _codeViewJson = null;

        // Which encoding the currently-loaded file uses (Codec.JSON or Codec.YAML).
        // Derived from the file's extension on FILE_LOADED; JSON_CHANGED/CODE_SYNC
        // don't carry a filename, so they keep using whatever was last resolved here.
        let _currentFormat = Codec.JSON;

        function updateFormatConversionOptions() {
            const hasDocument = _codeViewJson !== null;
            const jsonToYaml = document.getElementById('convertJsonToYamlBtn');
            const yamlToJson = document.getElementById('convertYamlToJsonBtn');
            if (!jsonToYaml || !yamlToJson) return;

            jsonToYaml.disabled = !hasDocument || _currentFormat !== Codec.JSON;
            yamlToJson.disabled = !hasDocument || _currentFormat !== Codec.YAML;
        }

        function showFormatConversionError(message) {
            const status = document.getElementById('formatConversionStatus');
            if (!status) return;
            status.textContent = message;
            status.hidden = false;
        }

        function clearFormatConversionError() {
            const status = document.getElementById('formatConversionStatus');
            if (!status) return;
            status.textContent = '';
            status.hidden = true;
        }

        // Subscribe to events
        EventBus.on(Events.FILE_LOADED, ({ json, fileName, format }) => {
            _codeViewJson = json;
            // A brand-new, not-yet-named document (fileName is null) still carries an
            // explicit `format` chosen via the New-document format picker.
            _currentFormat = format || Codec.formatForFileName(fileName);
            collapsedLines.clear();
            updateFormatConversionOptions();
            clearFormatConversionError();
            if (codeEditorView && codeEditorView.setValue) {
                codeEditorView.session.setMode(Codec.aceMode(_currentFormat));
                codeEditorView.setValue(json ? Codec.stringify(json, _currentFormat) : '', -1);
            }
        });

        EventBus.on(Events.JSON_CHANGED, ({ json, source }) => {
            if (source === 'code') return; // Don't update from our own edits
            _codeViewJson = json;
            updateFormatConversionOptions();
            if (codeEditorView && codeEditorView.setValue) {
                codeEditorView.setValue(Codec.stringify(json, _currentFormat), -1);
            }
        });

        EventBus.on(Events.FORMAT_CONVERSION_REQUESTED, ({ targetFormat }) => {
            const expectedTarget = _currentFormat === Codec.JSON ? Codec.YAML : Codec.JSON;
            if (!_codeViewJson || !codeEditorView || targetFormat !== expectedTarget) {
                showFormatConversionError('No active document is available to convert.');
                return;
            }

            try {
                const json = Codec.parse(codeEditorView.getValue(), _currentFormat);
                EventBus.emit(Events.FORMAT_CONVERSION_READY, {
                    json,
                    sourceFormat: _currentFormat,
                    targetFormat
                });
            } catch (error) {
                showFormatConversionError(`Could not convert document: ${error.message}`);
            }
        });

        EventBus.on(Events.FORMAT_CONVERSION_FAILED, ({ message }) => {
            showFormatConversionError(message);
        });

        EventBus.on(Events.EDITOR_RESIZED, () => {
            if (codeEditorView && codeEditorView.resize) {
                codeEditorView.resize();
            }
        });

        EventBus.on(Events.APP_INIT, () => {
            initCodeMirror();
        });

        EventBus.on(Events.CODE_SYNC, ({ json }) => {
            if (!codeEditorView) return;
            if (json === undefined) return;
            const expected = Codec.stringify(json, _currentFormat);
            if (codeEditorView.getValue() !== expected) {
                codeEditorView.setValue(expected, -1);
            }
        });

        function parseJsonToLines(json) {
            const lines = [];
            const text = JSON.stringify(json, null, 2);
            const textLines = text.split('\n');
            
            textLines.forEach((line, index) => {
                const trimmed = line.trimStart();
                const indent = line.length - trimmed.length;
                
                // Check if line starts with { or [
                const isObjectStart = trimmed.startsWith('{');
                const isArrayStart = trimmed.startsWith('[');
                const isObjectEnd = trimmed.startsWith('}');
                const isArrayEnd = trimmed.startsWith(']');
                
                // Also check if line contains a property with object/array value
                // Examples: "trigger": {, "properties": [, "events": [
                const hasObjectValue = /["']\s*:\s*\{/.test(trimmed);
                const hasArrayValue = /["']\s*:\s*\[/.test(trimmed);
                
                const isCollapsible = ((isObjectStart || isArrayStart || hasObjectValue || hasArrayValue) && 
                                      index < textLines.length - 1);
                
                lines.push({
                    index,
                    text: line,
                    indent,
                    isObjectStart,
                    isArrayStart,
                    isObjectEnd,
                    isArrayEnd,
                    hasObjectValue,
                    hasArrayValue,
                    isCollapsible
                });
            });
            
            return lines;
        }

        function findMatchingBracket(lines, startIndex) {
            const startLine = lines[startIndex];
            const trimmed = startLine.text.trimStart();
            
            // Determine if we're looking for object or array brackets
            let isObject = false;
            if (trimmed.startsWith('{') || trimmed.includes(': {')) {
                isObject = true;
            }
            
            const openChar = isObject ? '{' : '[';
            const closeChar = isObject ? '}' : ']';
            
            let depth = 0;
            for (let i = startIndex; i < lines.length; i++) {
                const line = lines[i].text;
                // Count opening brackets
                for (let char of line) {
                    if (char === openChar) depth++;
                    if (char === closeChar) depth--;
                    if (depth === 0 && i > startIndex) return i;
                }
            }
            return startIndex;
        }

        function getCollapsedLabel(lines, startIndex, endIndex) {
            // Try to find a meaningful property value to display
            const startLine = lines[startIndex];
            const startText = startLine.text.trim();
            
            // First, check if the start line itself has a property name
            // e.g., "trigger": { or "properties": [
            const propertyMatch = startText.match(/["']([^"']+)["']\s*:\s*[\{\[]/);
            let propertyName = null;
            
            if (propertyMatch) {
                propertyName = propertyMatch[1];
            }
            
            // Look for common identifying properties in the next few lines
            const searchDepth = Math.min(endIndex, startIndex + 10);
            let foundName = null;
            let foundId = null;
            let foundTitle = null;
            let foundType = null;
            let foundRole = null;
            let foundError = null;
            
            for (let i = startIndex + 1; i < searchDepth; i++) {
                const line = lines[i].text.trim();
                
                // Match "name": "value" or 'name': 'value'
                const nameMatch = line.match(/["']name["']\s*:\s*["']([^"']+)["']/i);
                if (nameMatch && !foundName) {
                    foundName = nameMatch[1];
                }
                
                // Match "id": "value"
                const idMatch = line.match(/["']id["']\s*:\s*["']([^"']+)["']/i);
                if (idMatch && !foundId) {
                    foundId = idMatch[1];
                }
                
                // Match "title": "value"
                const titleMatch = line.match(/["']title["']\s*:\s*["']([^"']+)["']/i);
                if (titleMatch && !foundTitle) {
                    foundTitle = titleMatch[1];
                }
                
                // Match "type": "value"
                const typeMatch = line.match(/["']type["']\s*:\s*["']([^"']+)["']/i);
                if (typeMatch && !foundType) {
                    foundType = typeMatch[1];
                }
                
                // Match "role": "value"
                const roleMatch = line.match(/["']role["']\s*:\s*["']([^"']+)["']/i);
                if (roleMatch && !foundRole) {
                    foundRole = roleMatch[1];
                }
                
                // Match "error": "value"
                const errorMatch = line.match(/["']error["']\s*:\s*["']([^"']+)["']/i);
                if (errorMatch && !foundError) {
                    foundError = errorMatch[1];
                }
            }
            
            // Priority: name > title > role > type > error > id
            let identifierValue = foundName || foundTitle || foundRole || foundType || foundError || foundId;
            
            // Handle arrays with item counts
            if (propertyName && startText.includes('[')) {
                let itemCount = 0;
                let itemNames = [];
                
                for (let i = startIndex + 1; i < endIndex; i++) {
                    const line = lines[i].text.trim();
                    // Count items (lines that start with { or are simple values)
                    if (line === '{' || (line.startsWith('{') && !line.endsWith('{},'))) {
                        itemCount++;
                        
                        // Try to get name of this item for arrays like "events"
                        const itemEnd = findMatchingBracket(lines, i);
                        if (itemEnd > i) {
                            for (let j = i + 1; j < Math.min(itemEnd, i + 5); j++) {
                                const itemLine = lines[j].text.trim();
                                const itemNameMatch = itemLine.match(/["']name["']\s*:\s*["']([^"']+)["']/i);
                                if (itemNameMatch) {
                                    itemNames.push(itemNameMatch[1]);
                                    break;
                                }
                            }
                        }
                    } else if (line.startsWith('"') || line.startsWith("'")) {
                        // Simple string values in array
                        itemCount++;
                        const strMatch = line.match(/["']([^"']+)["']/);
                        if (strMatch) {
                            itemNames.push(strMatch[1]);
                        }
                    }
                }
                
                if (itemCount > 0) {
                    let label = `${propertyName} (${itemCount} ${itemCount === 1 ? 'item' : 'items'})`;
                    // Add names if we found some and there aren't too many
                    if (itemNames.length > 0 && itemNames.length <= 3) {
                        label += ': ' + itemNames.join(', ');
                    }
                    
                    // Truncate if too long
                    if (label.length > 60) {
                        label = label.substring(0, 57) + '...';
                    }
                    return label;
                }
            }
            
            // Combine property name with identifier value
            if (propertyName && identifierValue) {
                let label = `${propertyName}: ${identifierValue}`;
                
                // Truncate if too long
                if (label.length > 60) {
                    label = label.substring(0, 57) + '...';
                }
                return label;
            }
            
            // Just property name (for objects without clear identifiers)
            if (propertyName) {
                return propertyName;
            }
            
            // Just identifier value (for top-level objects in arrays like slices)
            if (identifierValue) {
                // Try to determine context from surrounding structure
                let context = 'object';
                
                // Check if we're in the slices array
                if (startIndex > 10) {
                    for (let i = startIndex - 1; i >= Math.max(0, startIndex - 10); i--) {
                        const prevLine = lines[i].text.trim();
                        if (prevLine.includes('"slices"') || prevLine.includes("'slices'")) {
                            context = 'slice';
                            break;
                        }
                    }
                }
                
                let label = identifierValue;
                if (context !== 'object') {
                    label = `${context}: ${identifierValue}`;
                }
                
                // Truncate if too long
                if (label.length > 60) {
                    label = label.substring(0, 57) + '...';
                }
                return label;
            }
            
            // Fallback to line count
            const lineCount = endIndex - startIndex;
            return `${lineCount} lines`;
        }

        // Initialize ACE Editor (simpler alternative to CodeMirror)
        function initCodeMirror() {
            // Wait for ACE to be available
            if (!window.ace) {
                console.log('Waiting for ACE editor to load...');
                window.addEventListener('codemirror-ready', initCodeMirror, { once: true });
                return;
            }
            
            console.log('ACE editor available, initializing...');
            
            try {
                // Clear loading message
                codeEditor.innerHTML = '';
                
                // Initialize ACE editor
                const editor = ace.edit(codeEditor, {
                    mode: Codec.aceMode(_currentFormat),
                    theme: "ace/theme/chrome",
                    fontSize: "14px",
                    showPrintMargin: false,
                    wrap: true
                });
                
                // Set initial content
                const initialContent = _codeViewJson ? Codec.stringify(_codeViewJson, _currentFormat) : '// No event model loaded. Upload a file to start.';
                editor.setValue(initialContent, -1); // -1 moves cursor to start
                
                // Enable code folding
                editor.session.setFoldStyle('markbegin');
                editor.setOption('foldStyle', 'markbegin');
                
                // Track previous fold state for detecting expansions
                previousFolds = new Set();
                isProcessingFolds = false;
                
                // Update fold placeholders after they're created
                editor.session.on('changeFold', function() {
                    console.log('Fold changed, updating placeholders...');
                    
                    // Prevent recursive fold processing
                    if (isProcessingFolds) {
                        console.log('Already processing folds, skipping...');
                        return;
                    }
                    
                    const folds = editor.session.getAllFolds();
                    console.log('Found', folds.length, 'folds');
                    
                    // Build current fold set (row numbers that are folded)
                    const currentFolds = new Set();
                    folds.forEach(fold => currentFolds.add(fold.start.row));
                    
                    // Detect which folds were removed (expanded)
                    const expandedRows = [];
                    previousFolds.forEach(row => {
                        if (!currentFolds.has(row)) {
                            expandedRows.push(row);
                        }
                    });
                    
                    // Reopening a section shows its direct children but keeps their contents folded.
                    if (expandedRows.length > 0) {
                        isProcessingFolds = true; // Set flag before folding
                        try {
                            expandedRows.forEach(row => {
                                const parentLine = editor.session.getLine(row);
                                const parentIndent = parentLine.length - parentLine.trimStart().length;
                                const parentRange = editor.session.getFoldWidgetRange(row);
                                if (!parentRange) return;

                                const childFolds = [];
                                for (let i = row + 1; i <= parentRange.end.row; i++) {
                                    const line = editor.session.getLine(i);
                                    const indent = line.length - line.trimStart().length;
                                    const range = editor.session.getFoldWidgetRange(i);
                                    if (range && indent > parentIndent) {
                                        childFolds.push({ row: i, indent, range });
                                    }
                                }

                                const directChildIndent = childFolds.reduce(
                                    (minimum, fold) => Math.min(minimum, fold.indent),
                                    Infinity
                                );
                                childFolds
                                    .filter(fold => fold.indent === directChildIndent)
                                    .forEach(fold => {
                                        if (!editor.session.getFoldAt(fold.row)) {
                                            editor.session.addFold('...', fold.range);
                                        }
                                    });
                            });
                        } finally {
                            isProcessingFolds = false;
                        }

                        previousFolds = new Set(
                            editor.session.getAllFolds().map(fold => fold.start.row)
                        );
                    } else {
                        // No expansions, just update previous state
                        previousFolds = currentFolds;
                    }
                    
                    // Update placeholders for all current folds
                    const allFolds = editor.session.getAllFolds();
                    allFolds.forEach((fold, idx) => {
                        try {
                            const startRow = fold.start.row;
                            const endRow = fold.end.row;
                            
                            // Get the folded lines
                            const lines = [];
                            for (let i = startRow; i <= endRow; i++) {
                                const lineText = editor.session.getLine(i);
                                lines.push({ text: lineText, isCollapsible: true });
                            }
                            
                            // Generate custom label
                            const label = getCollapsedLabel(lines, 0, lines.length - 1);
                            const newPlaceholder = `...${label}`;
                            
                            console.log(`Fold ${idx}: Old placeholder="${fold.placeholder}", New="${newPlaceholder}"`);
                            fold.placeholder = newPlaceholder;
                        } catch (e) {
                            console.error('Could not set fold label:', e);
                        }
                    });
                    
                    // Force re-render
                    editor.renderer.updateFull();
                    updateCollapseExpandButtonState();
                });
                
                // Store editor instance globally
                codeEditorView = editor;
                
                // Add change listener with debouncing
                editor.session.on('change', function() {
                    clearTimeout(debounceTimer);
                    debounceTimer = setTimeout(() => {
                        updateJsonFromCodeMirror();
                    }, 1000);
                });
                
                console.log('✓ ACE Editor initialized successfully!');
            } catch (error) {
                console.error('Error initializing ACE Editor:', error);
                codeEditor.innerHTML = '<div style="color: #c33; padding: 1rem;">Error loading code editor: ' + error.message + '</div>';
            }
        }
        
        // Update JSON from ACE Editor content
        function updateJsonFromCodeMirror() {
            if (!codeEditorView) return;
            
            try {
                // ACE uses getValue() instead of state.doc.toString()
                const content = codeEditorView.getValue();
                const parsed = Codec.parse(content, _currentFormat);
                _codeViewJson = parsed;
                
                EventBus.emit(Events.JSON_CHANGED, { json: parsed, source: 'code' });
                
                // Clear any error messages
                const errorMsg = document.querySelector('.json-error-message');
                if (errorMsg) errorMsg.remove();
            } catch (error) {
                // Invalid content - show error inline (non-intrusive)
                console.log('Invalid content while typing:', error.message);
                
                // Optionally show a subtle error indicator
                let errorMsg = document.querySelector('.json-error-message');
                if (!errorMsg) {
                    errorMsg = document.createElement('div');
                    errorMsg.className = 'json-error-message';
                    errorMsg.style.cssText = 'position: absolute; bottom: 10px; right: 10px; background: #fee; color: #c33; padding: 0.5rem 1rem; border-radius: 4px; font-size: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); z-index: 1000;';
                    codeEditor.style.position = 'relative';
                    codeEditor.appendChild(errorMsg);
                }
                const formatLabel = _currentFormat === Codec.YAML ? 'YAML' : 'JSON';
                errorMsg.textContent = '⚠️ ' + formatLabel + ' Syntax Error: ' + error.message;
            }
        }

        function renderCodeEditor() {
            // This function is now deprecated for the Code tab (CodeMirror is used instead)
            // It's only kept for backward compatibility if needed elsewhere
            // Do not render to codeEditor div if CodeMirror is active
            if (codeEditorView) {
                return; // CodeMirror handles the Code tab now
            }
            
            if (!_codeViewJson) {
                codeEditor.innerHTML = '<div style="color: #999; padding: 1rem;">No JSON loaded. Upload a file to start.</div>';
                return;
            }

            jsonLines = parseJsonToLines(_codeViewJson);
            const html = [];
            let skipUntil = -1;

            jsonLines.forEach((line, index) => {
                if (index <= skipUntil) return;

                const isCollapsed = collapsedLines.has(index);
                const canCollapse = line.isCollapsible;

                html.push('<div class="code-line">');
                
                if (canCollapse) {
                    const icon = isCollapsed ? '▶' : '▼';
                    html.push(`<span class="line-toggle" data-line="${index}">${icon}</span>`);
                    
                    if (isCollapsed) {
                        const endIndex = findMatchingBracket(jsonLines, index);
                        const collapsedLabel = getCollapsedLabel(jsonLines, index, endIndex);
                        html.push(`<span class="line-content">${escapeHtml(line.text.trimEnd())} <span class="code-collapsed">... ${escapeHtml(collapsedLabel)}</span> ${jsonLines[endIndex].text.trim()}</span>`);
                        skipUntil = endIndex;
                    } else {
                        html.push(`<span class="line-content editable" contenteditable="true" data-line="${index}">${escapeHtml(line.text)}</span>`);
                    }
                } else {
                    html.push('<span class="line-toggle empty"></span>');
                    html.push(`<span class="line-content editable" contenteditable="true" data-line="${index}">${escapeHtml(line.text)}</span>`);
                }
                
                html.push('</div>');
            });

            codeEditor.innerHTML = html.join('');
            attachCodeEditorListeners();
            updateCollapseExpandButtonState();
        }

        function attachCodeEditorListeners() {
            // Toggle collapse/expand
            codeEditor.querySelectorAll('.line-toggle:not(.empty)').forEach(toggle => {
                toggle.addEventListener('click', (e) => {
                    const lineIndex = parseInt(e.target.getAttribute('data-line'));
                    if (collapsedLines.has(lineIndex)) {
                        // Reopening resets descendants so only direct children are shown.
                        collapsedLines.delete(lineIndex);
                        
                        // Find all collapsible children and collapse them
                        const endIndex = findMatchingBracket(jsonLines, lineIndex);
                        for (let i = lineIndex + 1; i < endIndex; i++) {
                            if (jsonLines[i].isCollapsible) {
                                collapsedLines.add(i);
                            }
                        }
                    } else {
                        collapsedLines.add(lineIndex);
                    }
                    renderCodeEditor();
                    updateCollapseExpandButtonState();
                });
            });

            // Handle content editing
            codeEditor.querySelectorAll('.line-content.editable').forEach(content => {
                // Listen for input events to track changes as user types
                content.addEventListener('input', () => {
                    console.log('Code editor: input event fired');
                    updateJsonFromEditor();
                });
                
                content.addEventListener('blur', () => {
                    console.log('Code editor: blur event fired');
                    updateJsonFromEditor();
                });

                content.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        // Could add line break logic here
                    }
                });
            });
        }

        // Collapse/Expand All functionality
        function isAceRootContainerRow(session, row) {
            if (_currentFormat === 'yaml' || row !== 0) return false;
            const line = session.getLine(row).trimStart();
            return line.startsWith('{') || line.startsWith('[');
        }

        function collapseToTopLevel() {
            // Check which tab is active
            const codeTabActive = codeView.classList.contains('active');
            
            if (codeTabActive && codeEditorView) {
                // Use ACE folding API
                const session = codeEditorView.session;
                isProcessingFolds = true;
                try {
                    session.unfold();
                } finally {
                    isProcessingFolds = false;
                }
                previousFolds = new Set();

                const foldableRanges = [];
                let topLevelIndent = Infinity;
                for (let row = 0; row < session.getLength(); row++) {
                    const range = session.getFoldWidgetRange(row);
                    if (range && !isAceRootContainerRow(session, row)) {
                        const line = session.getLine(row);
                        const indent = line.length - line.trimStart().length;
                        foldableRanges.push({ row, indent, range });
                        topLevelIndent = Math.min(topLevelIndent, indent);
                    }
                }
                foldableRanges
                    .filter(({ indent }) => indent === topLevelIndent)
                    .forEach(({ range }) => {
                        session.addFold('...', range);
                });
                previousFolds = new Set(
                    session.getAllFolds().map(fold => fold.start.row)
                );
            } else {
                // Use old custom editor for tree tab
                collapsedLines.clear();
                jsonLines.forEach((line, index) => {
                    if (line.isCollapsible && line.indent > 0) {
                        collapsedLines.add(index);
                    }
                });
                renderCodeEditor();
            }
            updateCollapseExpandButtonState();
        }

        function expandNextLevel() {
            // Check which tab is active
            const codeTabActive = codeView.classList.contains('active');
            
            if (codeTabActive && codeEditorView) {
                // Use ACE folding API
                const session = codeEditorView.session;
                const folds = session.getAllFolds();
                const visibleFolds = folds.filter(fold => !folds.some(other =>
                    other !== fold &&
                    other.start.row <= fold.start.row &&
                    other.end.row >= fold.end.row &&
                    (other.start.row < fold.start.row || other.end.row > fold.end.row)
                ));

                visibleFolds.forEach(fold => session.removeFold(fold));
                previousFolds = new Set(
                    session.getAllFolds().map(fold => fold.start.row)
                );
                codeEditorView.renderer.updateFull();
            } else {
                // Use old custom editor for tree tab
                const visibleCollapsedLines = Array.from(
                    codeEditor.querySelectorAll('.line-toggle:not(.empty)')
                )
                    .map(toggle => Number.parseInt(toggle.getAttribute('data-line'), 10))
                    .filter(lineIndex => collapsedLines.has(lineIndex));

                visibleCollapsedLines.forEach(lineIndex => collapsedLines.delete(lineIndex));
                renderCodeEditor();
            }
            updateCollapseExpandButtonState();
        }

        function updateCollapseExpandButtonState() {
            if (codeView.classList.contains('active') && codeEditorView) {
                const session = codeEditorView.session;
                const folds = session.getAllFolds();
                const foldableRows = [];
                for (let row = 0; row < session.getLength(); row++) {
                    if (
                        !isAceRootContainerRow(session, row) &&
                        session.getFoldWidgetRange(row)
                    ) {
                        foldableRows.push(row);
                    }
                }

                codeCollapseBtn.disabled = foldableRows.length === 0;
                codeExpandBtn.disabled = folds.length === 0;
                return;
            }

            const totalCollapsible = jsonLines.filter(line => line.isCollapsible).length;
            
            if (collapsedLines.size === totalCollapsible && totalCollapsible > 0) {
                // All are collapsed - disable collapse button, enable expand button
                codeCollapseBtn.disabled = true;
                codeExpandBtn.disabled = false;
            } else if (collapsedLines.size === 0) {
                // All are expanded - enable collapse button, disable expand button
                codeCollapseBtn.disabled = false;
                codeExpandBtn.disabled = true;
            } else {
                // Partially collapsed - enable both buttons
                codeCollapseBtn.disabled = false;
                codeExpandBtn.disabled = false;
            }
        }

        function updateJsonFromEditor() {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                console.log('updateJsonFromEditor: Attempting to parse JSON from editor');
                try {
                    // Get ALL line-content spans (including collapsed ones)
                    const allLines = Array.from(codeEditor.querySelectorAll('.code-line'));
                    const jsonLines = [];
                    
                    // Extract text from each line, handling both expanded and collapsed states
                    allLines.forEach(lineDiv => {
                        const contentSpan = lineDiv.querySelector('.line-content');
                        if (contentSpan) {
                            // For collapsed lines, we need to skip the collapsed indicator
                            if (contentSpan.classList.contains('editable')) {
                                // Expanded line - use textContent directly
                                jsonLines.push(contentSpan.textContent);
                            } else {
                                // Collapsed line - extract original text before the collapse indicator
                                // This is problematic - we've lost the original lines!
                                // For now, skip collapsed sections - user must expand to edit
                            }
                        }
                    });
                    
                    // Check if there are any collapsed sections
                    const hasCollapsed = collapsedLines.size > 0;
                    if (hasCollapsed) {
                        console.log('updateJsonFromEditor: Cannot update - some sections are collapsed. Expand all to edit.');
                        return; // Don't attempt to parse if anything is collapsed
                    }
                    
                    const jsonText = jsonLines.join('\n');
                    console.log('updateJsonFromEditor: Extracted text, length:', jsonText.length);
                    
                    const parsed = JSON.parse(jsonText);
                    console.log('updateJsonFromEditor: JSON parsed successfully');
                    
                    _codeViewJson = parsed;
                    
                    // Emit JSON changed event
                    EventBus.emit(Events.JSON_CHANGED, { json: parsed, source: 'code' });
                } catch (error) {
                    // Invalid JSON, don't update
                    console.log('updateJsonFromEditor: Invalid JSON, not updating -', error.message);
                }
            }, 1000);
        }


        codeCollapseBtn.addEventListener('click', collapseToTopLevel);
        codeExpandBtn.addEventListener('click', expandNextLevel);