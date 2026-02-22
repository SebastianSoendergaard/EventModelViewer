        const treeEditor = document.getElementById('treeEditor');

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