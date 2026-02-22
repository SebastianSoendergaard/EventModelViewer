        const codeEditor = document.getElementById('codeEditor');
        const treeEditor = document.getElementById('treeEditor');

        const codeCollapseBtn = document.getElementById('codeCollapseBtn');
        const codeExpandBtn = document.getElementById('codeExpandBtn');
        const editorTabs = document.querySelectorAll('.editor-tab');
        const codeView = document.getElementById('codeView');
        const treeView = document.getElementById('treeView');

        let collapsedLines = new Set();
        let jsonLines = [];
        let debounceTimer;
        // CodeMirror editor instance
        let codeMirrorView = null;

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
                const initialContent = currentJson ? JSON.stringify(currentJson, null, 2) : '// No JSON loaded. Upload a file to start.';
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
                currentJson = parsed;
                
                // Update history
                historyManager.pushState(currentJson);
                
                // Rebuild tree view
                renderTreeView();
                
                // Update diagram
                renderDiagram(content);
                
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
            
            if (!currentJson) {
                codeEditor.innerHTML = '<div style="color: #999; padding: 1rem;">No JSON loaded. Upload a file to start.</div>';
                return;
            }

            jsonLines = parseJsonToLines(currentJson);
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
                    
                    currentJson = parsed;
                    
                    // Rebuild tree view
                    console.log('updateJsonFromEditor: Rebuilding tree view...');
                    if (currentJson) {
                        treeData = buildTreeData(currentJson);
                        renderTreeView();
                        console.log('updateJsonFromEditor: Tree view rebuilt');
                    }
                    
                    // Update diagram
                    console.log('updateJsonFromEditor: Updating diagram...');
                    updateDiagram();
                    console.log('updateJsonFromEditor: Diagram updated');
                    
                    // Push to history after successful parse
                    historyManager.pushState(currentJson);
                    console.log('updateJsonFromEditor: State pushed to history');
                } catch (error) {
                    // Invalid JSON, don't update
                    console.log('updateJsonFromEditor: Invalid JSON, not updating -', error.message);
                }
            }, 1000);
        }

        // Tree View State
        let treeData = null;
        let treeNodeIdCounter = 0;
        let treeCollapsedNodes = new Set();
        let draggedNode = null;
        let dropTarget = null;

        // Context Menu State
        const treeContextMenu = document.getElementById('treeContextMenu');
        let contextMenuTargetNode = null;

        // Get meaningful type name for a node
        function getMeaningfulType(node, parentKey) {
            // For items inside arrays, use the singular form of the array name
            if (parentKey && !isNaN(node.key)) {
                const singularMap = {
                    'slices': 'slice',
                    'events': 'event',
                    'properties': 'property',
                    'buttons': 'button',
                    'tests': 'test',
                    'commands': 'command',
                    'views': 'view',
                    'triggers': 'trigger',
                    'children': 'child',
                    'items': 'item',
                    'given': 'given',
                    'then': 'then'
                };
                
                const lower = parentKey.toLowerCase();
                if (singularMap[lower]) {
                    return singularMap[lower];
                }
                
                // Try simple pluralization removal (remove trailing 's')
                if (lower.endsWith('s')) {
                    return lower.slice(0, -1);
                }
                
                return parentKey;
            }
            
            // For all other items, use the JSON key
            if (node.key && node.key !== 'root') {
                return node.key;
            }
            
            // Fallback to JSON type
            return node.type;
        }

        // Build tree data structure from JSON
        function buildTreeData(data, key = 'root', path = [], parentKey = null) {
            const nodeId = `node-${treeNodeIdCounter++}`;
            const nodeType = Array.isArray(data) ? 'array' : 
                             data === null ? 'null' : 
                             typeof data;
            
            const node = {
                id: nodeId,
                key: key,
                type: nodeType,
                meaningfulType: null, // Will be set later
                value: data,
                path: [...path],
                collapsed: treeCollapsedNodes.has(nodeId),
                children: []
            };

            if (nodeType === 'object' && data !== null) {
                for (const [childKey, childValue] of Object.entries(data)) {
                    const childNode = buildTreeData(childValue, childKey, [...path, childKey], key);
                    node.children.push(childNode);
                }
            } else if (nodeType === 'array') {
                data.forEach((item, index) => {
                    const childNode = buildTreeData(item, index.toString(), [...path, index], key);
                    node.children.push(childNode);
                });
            }

            // Set meaningful type after children are built
            node.meaningfulType = getMeaningfulType(node, parentKey);

            return node;
        }

        // Get display value for a node
        function getNodeDisplayValue(node) {
            if (node.type === 'object' && node.value !== null) {
                // Try to find a meaningful property to display
                const meaningfulProps = ['name', 'title', 'id', 'type', 'role'];
                for (const prop of meaningfulProps) {
                    if (node.value[prop]) {
                        const val = node.value[prop];
                        if (typeof val === 'string' && val.length > 0) {
                            return val.length > 30 ? val.substring(0, 27) + '...' : val;
                        }
                    }
                }
                return `{${Object.keys(node.value).length} props}`;
            } else if (node.type === 'array') {
                return `[${node.value.length} items]`;
            } else if (node.type === 'string') {
                const str = String(node.value);
                return str.length > 30 ? str.substring(0, 27) + '...' : str;
            } else if (node.type === 'null') {
                return 'null';
            } else {
                return String(node.value);
            }
        }

        // Render a single tree node
        function renderTreeNode(node, level = 0, isLastSibling = false) {
            const hasChildren = node.children.length > 0;
            const isCollapsed = treeCollapsedNodes.has(node.id);
            const displayValue = getNodeDisplayValue(node);
            
            let html = `<div class="tree-node" data-node-id="${node.id}" data-level="${level}">`;
            
            // Drop zone before this node (doubles as "after previous sibling")
            html += `<div class="tree-drop-zone" data-node-id="${node.id}" data-position="before"></div>`;
            
            html += `<div class="tree-node-header">`;
            
            // Toggle button
            if (hasChildren) {
                const icon = isCollapsed ? '▶' : '▼';
                html += `<span class="tree-toggle" data-node-id="${node.id}">${icon}</span>`;
            } else {
                html += `<span class="tree-toggle empty"></span>`;
            }
            
            // Draggable box
            html += `<div class="tree-box" draggable="true" data-node-id="${node.id}">`;
            html += `<span class="tree-type-badge tree-type-${node.type}">${escapeHtml(node.meaningfulType)}</span>`;
            html += `<span class="tree-value">${escapeHtml(displayValue)}</span>`;
            html += `</div>`;
            
            html += `</div>`; // Close tree-node-header
            
            // Children
            if (hasChildren && !isCollapsed) {
                html += `<div class="tree-children" data-parent-id="${node.id}">`;
                for (let i = 0; i < node.children.length; i++) {
                    const child = node.children[i];
                    const isLast = i === node.children.length - 1;
                    html += renderTreeNode(child, level + 1, isLast);
                }
                // Drop zone after last child (for dropping at end of container)
                html += `<div class="tree-drop-zone" data-parent-id="${node.id}" data-position="inside-end"></div>`;
                html += `</div>`;
            } else if (hasChildren && isCollapsed) {
                html += `<div class="tree-children collapsed" data-parent-id="${node.id}"></div>`;
            }
            
            html += `</div>`; // Close tree-node
            return html;
        }

        // Render the entire tree view
        function renderTreeView() {
            if (!currentJson) {
                treeEditor.innerHTML = '<div style="color: #999; padding: 1rem;">No JSON loaded</div>';
                return;
            }
            
            try {
                // Reset counter and build tree
                treeNodeIdCounter = 0;
                treeData = buildTreeData(currentJson);
                
                // Render children of root directly (skip the root node itself)
                let html = '<div class="tree-container">';
                if (treeData.children.length > 0) {
                    for (let i = 0; i < treeData.children.length; i++) {
                        const child = treeData.children[i];
                        const isLast = i === treeData.children.length - 1;
                        html += renderTreeNode(child, 0, isLast);
                    }
                }
                html += '</div>';
                
                treeEditor.innerHTML = html;
                
                attachTreeEventListeners();
            } catch (error) {
                console.error('Error rendering tree view:', error);
                treeEditor.innerHTML = `<div style="color: #e74c3c; padding: 1rem;">Error rendering tree: ${escapeHtml(error.message)}</div>`;
            }
        }

        // Attach event listeners to tree elements
        function attachTreeEventListeners() {
            // Toggle collapse/expand for individual nodes
            treeEditor.querySelectorAll('.tree-toggle:not(.empty)').forEach(toggle => {
                toggle.addEventListener('click', (e) => {
                    const nodeId = e.target.getAttribute('data-node-id');
                    toggleTreeNode(nodeId);
                });
            });

            // Drag and drop events on boxes (only dragstart and dragend)
            treeEditor.querySelectorAll('.tree-box').forEach(box => {
                box.addEventListener('dragstart', handleDragStart);
                box.addEventListener('dragend', handleDragEnd);
                
                // Context menu for tree boxes
                box.addEventListener('contextmenu', handleContextMenu);
                
                // Double-click to edit leaf items
                box.addEventListener('dblclick', handleDoubleClick);
            });

            // Drag and drop events on drop zones
            treeEditor.querySelectorAll('.tree-drop-zone').forEach(zone => {
                zone.addEventListener('dragover', handleDragOver);
                zone.addEventListener('drop', handleDrop);
                zone.addEventListener('dragleave', handleDragLeave);
            });
        }

        // Toggle a single tree node
        function toggleTreeNode(nodeId) {
            if (treeCollapsedNodes.has(nodeId)) {
                treeCollapsedNodes.delete(nodeId);
            } else {
                treeCollapsedNodes.add(nodeId);
            }
            renderTreeView();
        }

        // Collapse all tree nodes
        function collapseAllTreeNodes(node = treeData) {
            if (!node) return;
            if (node.children.length > 0) {
                treeCollapsedNodes.add(node.id);
                node.children.forEach(child => collapseAllTreeNodes(child));
            }
        }

        // Expand all tree nodes
        function expandAllTreeNodes(node = treeData) {
            if (!node) return;
            treeCollapsedNodes.delete(node.id);
            node.children.forEach(child => expandAllTreeNodes(child));
        }

        // Find node by ID in tree
        function findNodeById(nodeId, node = treeData) {
            if (!node) return null;
            if (node.id === nodeId) return node;
            for (const child of node.children) {
                const found = findNodeById(nodeId, child);
                if (found) return found;
            }
            return null;
        }

        // Check if targetNode is a descendant of sourceNode
        function isDescendant(sourceNode, targetNode) {
            if (sourceNode.id === targetNode.id) return true;
            for (const child of sourceNode.children) {
                if (isDescendant(child, targetNode)) return true;
            }
            return false;
        }

        // Drag and drop handlers
        function handleDragStart(e) {
            const nodeId = e.target.getAttribute('data-node-id');
            draggedNode = findNodeById(nodeId);
            e.target.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/html', e.target.innerHTML);
        }

        function handleDragEnd(e) {
            e.target.classList.remove('dragging');
            // Remove all drop zone highlights
            treeEditor.querySelectorAll('.tree-drop-zone').forEach(zone => {
                zone.classList.remove('drag-over', 'invalid');
            });
            draggedNode = null;
            dropTarget = null;
        }

        function handleDragOver(e) {
            if (!draggedNode) return;
            e.preventDefault();
            
            const dropZone = e.target.closest('.tree-drop-zone');
            if (!dropZone) return;
            
            // Determine what we're dropping relative to
            const position = dropZone.getAttribute('data-position');
            const nodeId = dropZone.getAttribute('data-node-id');
            const parentId = dropZone.getAttribute('data-parent-id');
            
            let isValid = false;
            
            if (position === 'inside-end' && parentId) {
                // Dropping as last child of parent
                const parentNode = findNodeById(parentId);
                isValid = parentNode && !isDescendant(draggedNode, parentNode);
            } else if (nodeId) {
                // Dropping before or after a sibling
                const siblingNode = findNodeById(nodeId);
                if (siblingNode && siblingNode.id !== draggedNode.id) {
                    // Check if we're not dropping into our own descendants
                    isValid = !isDescendant(draggedNode, siblingNode);
                }
            }
            
            // Update visual feedback
            if (isValid) {
                dropZone.classList.add('drag-over');
                dropZone.classList.remove('invalid');
                e.dataTransfer.dropEffect = 'move';
            } else {
                dropZone.classList.add('invalid');
                dropZone.classList.remove('drag-over');
                e.dataTransfer.dropEffect = 'none';
            }
        }

        function handleDragLeave(e) {
            const dropZone = e.target.closest('.tree-drop-zone');
            if (dropZone) {
                dropZone.classList.remove('drag-over', 'invalid');
            }
        }

        function handleDrop(e) {
            e.preventDefault();
            e.stopPropagation();
            
            if (!draggedNode) return;
            
            try {
                const dropZone = e.target.closest('.tree-drop-zone');
                if (!dropZone) return;
                
                const position = dropZone.getAttribute('data-position');
                const nodeId = dropZone.getAttribute('data-node-id');
                const parentId = dropZone.getAttribute('data-parent-id');
                
                if (position === 'inside-end' && parentId) {
                    // Drop as last child of parent
                    const parentNode = findNodeById(parentId);
                    if (!parentNode || isDescendant(draggedNode, parentNode)) return;
                    
                    moveNodeToParent(draggedNode, parentNode, -1); // -1 means append
                } else if (nodeId) {
                    // Drop before or after sibling
                    const siblingNode = findNodeById(nodeId);
                    if (!siblingNode || siblingNode.id === draggedNode.id) return;
                    if (isDescendant(draggedNode, siblingNode)) return;
                    
                    moveNodeNextToSibling(draggedNode, siblingNode, position);
                }
                
                // Update JSON and re-render
                rebuildJsonFromTree();
                renderTreeView();
                renderCodeEditor();
                updateDiagram();
                
                // Push to history after successful drop
                historyManager.pushState(currentJson);
            } catch (error) {
                console.error('Error during drop operation:', error);
                renderTreeView();
            }
        }

        // Find parent of a node
        function findParentNode(targetNode, currentNode = treeData) {
            if (!currentNode) return null;
            
            const index = currentNode.children.findIndex(c => c.id === targetNode.id);
            if (index !== -1) {
                return currentNode;
            }
            
            for (const child of currentNode.children) {
                const parent = findParentNode(targetNode, child);
                if (parent) return parent;
            }
            return null;
        }

        // Move node to be child of parent at specific index
        function moveNodeToParent(sourceNode, parentNode, index) {
            // Remove source from its current parent
            removeNodeFromParent(sourceNode);
            
            // Add source as child of target parent
            if (index === -1) {
                parentNode.children.push(sourceNode);
            } else {
                parentNode.children.splice(index, 0, sourceNode);
            }
            
            // Update the key/index for the moved node
            if (parentNode.type === 'array') {
                // Update array indices
                parentNode.children.forEach((child, idx) => {
                    child.key = idx.toString();
                });
            } else if (parentNode.type === 'object') {
                // Try to preserve the key name, or generate a new one
                let newKey = sourceNode.key;
                let counter = 1;
                while (parentNode.children.some(c => c !== sourceNode && c.key === newKey)) {
                    newKey = `${sourceNode.key}_${counter++}`;
                }
                sourceNode.key = newKey;
            }
        }

        // Move node next to a sibling (before or after)
        function moveNodeNextToSibling(sourceNode, siblingNode, position) {
            // Find parent of sibling
            const parentNode = findParentNode(siblingNode);
            if (!parentNode) return;
            
            // Remove source from its current parent
            removeNodeFromParent(sourceNode);
            
            // Find sibling's index in parent
            const siblingIndex = parentNode.children.findIndex(c => c.id === siblingNode.id);
            if (siblingIndex === -1) return;
            
            // Insert before or after sibling
            const insertIndex = position === 'before' ? siblingIndex : siblingIndex + 1;
            parentNode.children.splice(insertIndex, 0, sourceNode);
            
            // Update keys if parent is array
            if (parentNode.type === 'array') {
                parentNode.children.forEach((child, idx) => {
                    child.key = idx.toString();
                });
            } else {
                // For objects, try to preserve key or generate new one
                let newKey = sourceNode.key;
                let counter = 1;
                while (parentNode.children.some(c => c !== sourceNode && c.key === newKey)) {
                    newKey = `${sourceNode.key}_${counter++}`;
                }
                sourceNode.key = newKey;
            }
        }

        // Move a node to be a child of target node (old function - kept for compatibility)
        function moveNode(sourceNode, targetNode) {
            // Remove source from its current parent
            removeNodeFromParent(sourceNode);
            
            // Add source as child of target
            if (targetNode.type === 'object' || targetNode.type === 'array') {
                targetNode.children.push(sourceNode);
                // Update the key/index for the moved node
                if (targetNode.type === 'array') {
                    sourceNode.key = targetNode.children.length - 1;
                } else {
                    // Try to preserve the key name, or generate a new one
                    let newKey = sourceNode.key;
                    let counter = 1;
                    while (targetNode.children.some(c => c !== sourceNode && c.key === newKey)) {
                        newKey = `${sourceNode.key}_${counter++}`;
                    }
                    sourceNode.key = newKey;
                }
            }
        }

        // Remove node from its parent
        function removeNodeFromParent(node, parent = treeData) {
            if (!parent) return false;
            
            const index = parent.children.findIndex(c => c.id === node.id);
            if (index !== -1) {
                parent.children.splice(index, 1);
                return true;
            }
            
            for (const child of parent.children) {
                if (removeNodeFromParent(node, child)) {
                    return true;
                }
            }
            return false;
        }

        // Rebuild JSON from tree data
        function rebuildJsonFromTree() {
            function nodeToJson(node) {
                if (node.type === 'object' && node.value !== null) {
                    const obj = {};
                    for (const child of node.children) {
                        obj[child.key] = nodeToJson(child);
                    }
                    return obj;
                } else if (node.type === 'array') {
                    return node.children.map(child => nodeToJson(child));
                } else {
                    return node.value;
                }
            }
            
            currentJson = nodeToJson(treeData);
        }

        // Context Menu Functions
        function handleContextMenu(e) {
            e.preventDefault();
            e.stopPropagation(); // Prevent event bubbling
            
            // Get the tree-box element (might be clicking on child span)
            const treeBox = e.target.closest('.tree-box');
            if (!treeBox) return;
            
            const nodeId = treeBox.getAttribute('data-node-id');
            if (!nodeId) return;
            
            contextMenuTargetNode = findNodeById(nodeId, treeData);
            if (!contextMenuTargetNode) return;
            
            // Only show context menu for parent items (objects/arrays)
            if (contextMenuTargetNode.type !== 'object' && contextMenuTargetNode.type !== 'array') {
                return; // Don't show menu for leaf items
            }
            
            // Position the menu at cursor
            showContextMenu(e.clientX, e.clientY);
        }

        function showContextMenu(x, y) {
            // Calculate position to keep menu in viewport
            const menuWidth = 160;
            const menuHeight = 80;
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            
            let menuX = x;
            let menuY = y;
            
            // Adjust if menu would overflow viewport
            if (x + menuWidth > viewportWidth) {
                menuX = viewportWidth - menuWidth - 10;
            }
            if (y + menuHeight > viewportHeight) {
                menuY = viewportHeight - menuHeight - 10;
            }
            
            treeContextMenu.style.left = `${menuX}px`;
            treeContextMenu.style.top = `${menuY}px`;
            treeContextMenu.classList.add('visible');
            
            // Add dismiss handlers
            document.addEventListener('click', hideContextMenu);
            document.addEventListener('keydown', handleContextMenuKeydown);
        }

        function hideContextMenu() {
            treeContextMenu.classList.remove('visible');
            contextMenuTargetNode = null;
            
            // Remove dismiss handlers
            document.removeEventListener('click', hideContextMenu);
            document.removeEventListener('keydown', handleContextMenuKeydown);
        }

        function handleContextMenuKeydown(e) {
            if (e.key === 'Escape') {
                hideContextMenu();
            }
        }

        function deepCopyNode(node) {
            const newNode = {
                id: `node-${treeNodeIdCounter++}`,
                key: node.key,
                type: node.type,
                value: node.value,
                meaningfulType: node.meaningfulType,
                children: []
            };
            
            // Recursively copy children
            for (const child of node.children) {
                newNode.children.push(deepCopyNode(child));
            }
            
            return newNode;
        }

        function copyTreeNode() {
            if (!contextMenuTargetNode) return;
            
            // Create a deep copy of the node
            const copiedNode = deepCopyNode(contextMenuTargetNode);
            
            // Modify the key to add '_copy' suffix
            if (!isNaN(copiedNode.key)) {
                // It's an array index, keep as is (will be renumbered on insert)
                copiedNode.key = parseInt(copiedNode.key);
            } else {
                // It's an object key, add '_copy' suffix
                copiedNode.key = `${copiedNode.key}_copy`;
                copiedNode.meaningfulType = `${copiedNode.meaningfulType}_copy`;
            }
            
            // Find parent and insert after original
            const parent = findParentNode(contextMenuTargetNode);
            if (!parent) return;
            
            const index = parent.children.findIndex(c => c.id === contextMenuTargetNode.id);
            if (index !== -1) {
                parent.children.splice(index + 1, 0, copiedNode);
                
                // If parent is an array, renumber all children
                if (parent.type === 'array') {
                    parent.children.forEach((child, idx) => {
                        child.key = idx.toString();
                    });
                }
            }
            
            // Rebuild JSON and re-render
            rebuildJsonFromTree();
            renderTreeView();
            renderCodeEditor();
            updateDiagram();
            
            // Push to history after copy
            historyManager.pushState(currentJson);
            hideContextMenu();
        }

        function deleteTreeNode() {
            if (!contextMenuTargetNode) return;
            
            // Confirm deletion
            const nodeName = contextMenuTargetNode.meaningfulType || contextMenuTargetNode.key || 'this item';
            if (!confirm(`Are you sure you want to delete "${nodeName}"?`)) {
                hideContextMenu();
                return;
            }
            
            // Remove the node
            removeNodeFromParent(contextMenuTargetNode);
            
            // Rebuild JSON and re-render
            rebuildJsonFromTree();
            renderTreeView();
            renderCodeEditor();
            updateDiagram();
            
            // Push to history after delete
            historyManager.pushState(currentJson);
            hideContextMenu();
        }

        // Context menu item click handlers
        treeContextMenu.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent hiding menu immediately
            
            const menuItem = e.target.closest('.tree-context-menu-item');
            if (!menuItem) return;
            
            const action = menuItem.getAttribute('data-action');
            
            if (action === 'copy') {
                copyTreeNode();
            } else if (action === 'delete') {
                deleteTreeNode();
            }
        });

        // Double-click to edit leaf items
        function handleDoubleClick(e) {
            const treeBox = e.target.closest('.tree-box');
            if (!treeBox) return;
            
            const nodeId = treeBox.getAttribute('data-node-id');
            if (!nodeId) return;
            
            const node = findNodeById(nodeId, treeData);
            if (!node) return;
            
            // Only allow editing leaf items (not objects or arrays)
            if (node.type === 'object' || node.type === 'array') {
                return;
            }
            
            // Start editing
            startEditingNode(treeBox, node);
        }

        function startEditingNode(treeBox, node) {
            // Prevent drag during edit
            treeBox.setAttribute('draggable', 'false');
            treeBox.classList.add('editing');
            
            // Find the value span
            const valueSpan = treeBox.querySelector('.tree-value');
            if (!valueSpan) return;
            
            // Store original value
            const originalValue = node.value;
            
            // Create input field
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'tree-value-input';
            input.value = originalValue === null ? 'null' : String(originalValue);
            
            // Replace span with input
            valueSpan.replaceWith(input);
            input.focus();
            input.select();
            
            // Flag to prevent double-saving
            let isSaving = false;
            
            // Save on Enter or blur
            const saveEdit = () => {
                if (isSaving) return; // Prevent double-save
                isSaving = true;
                
                const newValue = input.value.trim();
                
                // Parse the value based on the node type
                let parsedValue;
                if (node.type === 'string') {
                    parsedValue = newValue;
                } else if (node.type === 'number') {
                    parsedValue = parseFloat(newValue);
                    if (isNaN(parsedValue)) {
                        alert('Invalid number. Changes not saved.');
                        cancelEdit();
                        return;
                    }
                } else if (node.type === 'boolean') {
                    if (newValue === 'true') {
                        parsedValue = true;
                    } else if (newValue === 'false') {
                        parsedValue = false;
                    } else {
                        alert('Boolean must be "true" or "false". Changes not saved.');
                        cancelEdit();
                        return;
                    }
                } else if (node.type === 'null') {
                    if (newValue === 'null') {
                        parsedValue = null;
                    } else {
                        alert('Null value must be "null". Changes not saved.');
                        cancelEdit();
                        return;
                    }
                }
                
                // Update the node value
                node.value = parsedValue;
                
                // Remove event listeners before re-rendering
                input.removeEventListener('blur', blurHandler);
                input.removeEventListener('keydown', keydownHandler);
                
                // Rebuild JSON and re-render
                rebuildJsonFromTree();
                renderTreeView();
                renderCodeEditor();
                updateDiagram();
                
                // Push to history after inline edit
                historyManager.pushState(currentJson);
            };
            
            const cancelEdit = () => {
                if (isSaving) return; // Prevent multiple cancels
                isSaving = true;
                
                // Remove event listeners before re-rendering
                input.removeEventListener('blur', blurHandler);
                input.removeEventListener('keydown', keydownHandler);
                
                // Just re-render to restore original state
                renderTreeView();
            };
            
            // Handle Enter key
            const keydownHandler = (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    saveEdit();
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    cancelEdit();
                }
            };
            
            // Handle blur (clicking outside)
            const blurHandler = () => {
                saveEdit();
            };
            
            input.addEventListener('keydown', keydownHandler);
            input.addEventListener('blur', blurHandler);
        }


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


        // Collapse/Expand button handlers for code editor
        codeCollapseBtn.addEventListener('click', collapseAll);
        codeExpandBtn.addEventListener('click', expandAll);

        // Collapse/Expand button handlers for tree editor
        const treeCollapseAllBtn = document.getElementById('treeCollapseAllBtn');
        const treeExpandAllBtn = document.getElementById('treeExpandAllBtn');
        
        treeCollapseAllBtn.addEventListener('click', () => {
            collapseAllTreeNodes();
            renderTreeView();
        });
        
        treeExpandAllBtn.addEventListener('click', () => {
            expandAllTreeNodes();
            renderTreeView();
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
