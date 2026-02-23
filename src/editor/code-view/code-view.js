        const codeEditor = document.getElementById('codeEditor');
        const codeCollapseBtn = document.getElementById('codeCollapseBtn');
        const codeExpandBtn = document.getElementById('codeExpandBtn');

        let collapsedLines = new Set();
        let jsonLines = [];
        let debounceTimer;
        // CodeMirror editor instance
        let codeMirrorView = null;

        // Local JSON state
        let _codeViewJson = null;

        // Subscribe to events
        EventBus.on(Events.FILE_LOADED, ({ json }) => {
            _codeViewJson = json;
            collapsedLines.clear();
            if (codeMirrorView && codeMirrorView.setValue) {
                codeMirrorView.setValue(json ? JSON.stringify(json, null, 2) : '', -1);
            }
        });

        EventBus.on(Events.JSON_CHANGED, ({ json, source }) => {
            if (source === 'code') return; // Don't update from our own edits
            _codeViewJson = json;
            if (codeMirrorView && codeMirrorView.setValue) {
                codeMirrorView.setValue(JSON.stringify(json, null, 2), -1);
            }
        });

        EventBus.on(Events.EDITOR_RESIZED, () => {
            if (codeMirrorView && codeMirrorView.resize) {
                codeMirrorView.resize();
            }
        });

        EventBus.on(Events.APP_INIT, () => {
            initCodeMirror();
        });

        EventBus.on(Events.CODE_SYNC, ({ json }) => {
            if (!codeMirrorView) return;
            if (json === undefined) return;
            const expected = JSON.stringify(json, null, 2);
            if (codeMirrorView.getValue() !== expected) {
                codeMirrorView.setValue(expected, -1);
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
                    mode: "ace/mode/json",
                    theme: "ace/theme/chrome",
                    fontSize: "14px",
                    showPrintMargin: false,
                    wrap: true
                });
                
                // Set initial content
                const initialContent = _codeViewJson ? JSON.stringify(_codeViewJson, null, 2) : '// No JSON loaded. Upload a file to start.';
                editor.setValue(initialContent, -1); // -1 moves cursor to start
                
                // Enable code folding
                editor.session.setFoldStyle('markbegin');
                editor.setOption('foldStyle', 'markbegin');
                
                // Track previous fold state for detecting expansions
                let previousFolds = new Set();
                let isProcessingFolds = false; // Prevent recursive processing
                
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
                    
                    // For each expanded section, fold all its direct children
                    if (expandedRows.length > 0) {
                        isProcessingFolds = true; // Set flag before folding
                        
                        expandedRows.forEach(row => {
                            console.log(`Row ${row} was expanded, folding children...`);
                            
                            // Find the matching bracket for this row
                            const line = editor.session.getLine(row);
                            const trimmed = line.trimStart();
                            
                            // Determine the closing bracket
                            let openChar, closeChar;
                            if (trimmed.includes('{')) {
                                openChar = '{';
                                closeChar = '}';
                            } else if (trimmed.includes('[')) {
                                openChar = '[';
                                closeChar = ']';
                            } else {
                                return;
                            }
                            
                            // Find end of this block
                            let depth = 0;
                            let endRow = row;
                            for (let i = row; i < editor.session.getLength(); i++) {
                                const lineText = editor.session.getLine(i);
                                for (let char of lineText) {
                                    if (char === openChar) depth++;
                                    if (char === closeChar) depth--;
                                    if (depth === 0 && i > row) {
                                        endRow = i;
                                        break;
                                    }
                                }
                                if (depth === 0 && i > row) break;
                            }
                            
                            // Now fold all foldable lines within this range (children)
                            for (let i = row + 1; i < endRow; i++) {
                                const childLine = editor.session.getLine(i);
                                // Check if this line can be folded (has { or [)
                                if (childLine.includes('{') || childLine.includes('[')) {
                                    // Try to fold it
                                    try {
                                        const range = editor.session.getFoldWidgetRange(i);
                                        if (range && !editor.session.getFoldAt(i)) {
                                            editor.session.addFold('...', range);
                                        }
                                    } catch (e) {
                                        // Ignore fold errors
                                    }
                                }
                            }
                        });
                        
                        // Update previousFolds AFTER all child folding is done
                        const allFoldsAfter = editor.session.getAllFolds();
                        previousFolds = new Set();
                        allFoldsAfter.forEach(fold => previousFolds.add(fold.start.row));
                        
                        isProcessingFolds = false; // Clear flag after folding
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
                });
                
                // Store editor instance globally
                codeMirrorView = editor;
                
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
            if (!codeMirrorView) return;
            
            try {
                // ACE uses getValue() instead of state.doc.toString()
                const content = codeMirrorView.getValue();
                const parsed = JSON.parse(content);
                _codeViewJson = parsed;
                
                EventBus.emit(Events.JSON_CHANGED, { json: parsed, source: 'code' });
                
                // Clear any error messages
                const errorMsg = document.querySelector('.json-error-message');
                if (errorMsg) errorMsg.remove();
            } catch (error) {
                // Invalid JSON - show error inline (non-intrusive)
                console.log('Invalid JSON while typing:', error.message);
                
                // Optionally show a subtle error indicator
                let errorMsg = document.querySelector('.json-error-message');
                if (!errorMsg) {
                    errorMsg = document.createElement('div');
                    errorMsg.className = 'json-error-message';
                    errorMsg.style.cssText = 'position: absolute; bottom: 10px; right: 10px; background: #fee; color: #c33; padding: 0.5rem 1rem; border-radius: 4px; font-size: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); z-index: 1000;';
                    codeEditor.style.position = 'relative';
                    codeEditor.appendChild(errorMsg);
                }
                errorMsg.textContent = '⚠️ JSON Syntax Error: ' + error.message;
            }
        }

        function renderCodeEditor() {
            // This function is now deprecated for the Code tab (CodeMirror is used instead)
            // It's only kept for backward compatibility if needed elsewhere
            // Do not render to codeEditor div if CodeMirror is active
            if (codeMirrorView) {
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
                        // Expanding: remove this line from collapsed, but add all child collapsible lines
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
        function collapseAll() {
            // Check which tab is active
            const codeTabActive = codeView.classList.contains('active');
            
            if (codeTabActive && codeMirrorView) {
                // Use ACE folding API
                const session = codeMirrorView.session;
                const foldWidgets = session.foldWidgets;
                if (foldWidgets) {
                    for (let row = 0; row < session.getLength(); row++) {
                        if (session.foldWidgets[row] != null) {
                            session.foldAll(row, row, 0);
                        }
                    }
                }
            } else {
                // Use old custom editor for tree tab
                jsonLines.forEach((line, index) => {
                    if (line.isCollapsible) {
                        collapsedLines.add(index);
                    }
                });
                updateCollapseExpandButtonState();
                renderCodeEditor();
            }
        }

        function expandAll() {
            // Check which tab is active
            const codeTabActive = codeView.classList.contains('active');
            
            if (codeTabActive && codeMirrorView) {
                // Use ACE folding API
                const session = codeMirrorView.session;
                session.unfold();
            } else {
                // Use old custom editor for tree tab
                collapsedLines.clear();
                updateCollapseExpandButtonState();
                renderCodeEditor();
            }
        }

        function updateCollapseExpandButtonState() {
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


        codeCollapseBtn.addEventListener('click', collapseAll);
        codeExpandBtn.addEventListener('click', expandAll);