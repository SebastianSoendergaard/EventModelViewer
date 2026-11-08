        const SUPPORTED_TRIGGER_TYPES = [
            'ui',
            'ui-input',
            'ui-input-disabled',
            'ui-table',
            'ui-chart-line',
            'ui-chart-column',
            'ui-chart-pie',
            'automation',
            'translation'
        ];

        let rawJson = null;
        let activeEdit = null;
        let renameChoice = null;
        const RECENT_COLORS_STORAGE_KEY = 'eventModelViewerRecentColors';
        let recentColors = loadRecentColors();

        function cloneJson(value) {
            return value == null ? value : JSON.parse(JSON.stringify(value));
        }

        function asText(value) {
            return value == null ? '' : String(value);
        }

        function escapeText(value) {
            const div = document.createElement('div');
            div.textContent = asText(value);
            return div.innerHTML;
        }

        function isObject(value) {
            return value !== null && typeof value === 'object' && !Array.isArray(value);
        }

        function loadRecentColors() {
            try {
                const saved = JSON.parse(window.localStorage.getItem(RECENT_COLORS_STORAGE_KEY) || '[]');
                return Array.isArray(saved)
                    ? saved.filter(color => typeof color === 'string' && color.trim()).slice(0, 10)
                    : [];
            } catch (error) {
                return [];
            }
        }

        function rememberRecentColor(color) {
            const value = asText(color).trim();
            if (!value) return;
            recentColors = [value, ...recentColors.filter(recent => recent !== value)].slice(0, 10);
            try {
                window.localStorage.setItem(RECENT_COLORS_STORAGE_KEY, JSON.stringify(recentColors));
            } catch (error) {
                // Color history is optional when storage is unavailable.
            }
        }

        function colorToHex(value) {
            const raw = asText(value).trim();
            if (/^#[0-9a-f]{6}$/i.test(raw)) return raw;
            if (/^#[0-9a-f]{3}$/i.test(raw)) {
                return `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}`;
            }
            if (!raw || typeof document === 'undefined' || !document.body) return null;
            const probe = document.createElement('span');
            probe.style.color = raw;
            if (!probe.style.color) return null;
            document.body.appendChild(probe);
            const computed = window.getComputedStyle(probe).color;
            probe.remove();
            const channels = computed.match(/\d+(?:\.\d+)?/g);
            if (!channels || channels.length < 3) return null;
            return `#${channels.slice(0, 3).map(channel =>
                Math.round(Number(channel)).toString(16).padStart(2, '0')
            ).join('')}`;
        }

        function colorInputValue(value) {
            return colorToHex(value) || '#000000';
        }

        function readPropertyName(property) {
            if (!isObject(property)) return '';
            if (property.name !== undefined) return asText(property.name);
            if (property.label !== undefined) return asText(property.label);
            return '';
        }

        function readPropertyValue(property) {
            if (!isObject(property)) return '';
            if (property.value !== undefined) return asText(property.value);
            if (property.propertyName !== undefined) return asText(property.propertyName);
            if (property.type !== undefined) return asText(property.type);
            return '';
        }

        function propertiesToText(properties, field) {
            if (!Array.isArray(properties)) return '';
            return properties.map(property => {
                const name = readPropertyName(property);
                let value = '';
                if (field === 'type') {
                    value = isObject(property) && property.type !== undefined
                        ? asText(property.type)
                        : '';
                } else {
                    value = readPropertyValue(property);
                }
                return `${name}: ${value}`;
            }).join('\n');
        }

        function pathFor(descriptor) {
            const slicePath = ['slices', descriptor.sliceIndex];

            switch (descriptor.kind) {
                case 'slice':
                    return slicePath;
                case 'command':
                    return [...slicePath, 'command'];
                case 'view':
                    return [...slicePath, 'view'];
                case 'event':
                    return [...slicePath, 'events', descriptor.eventIndex];
                case 'note':
                    return [...slicePath, 'note'];
                case 'hotspot':
                    return descriptor.scope === 'model'
                        ? ['hotspots', descriptor.hotspotIndex]
                        : [...slicePath, 'hotspots', descriptor.hotspotIndex];
                case 'trigger':
                    return [...slicePath, 'trigger'];
                case 'test-name':
                    return [...slicePath, 'tests', descriptor.testIndex];
                case 'test-error':
                    return [...slicePath, 'tests', descriptor.testIndex, 'then', 'error'];
                case 'test-item': {
                    const itemPath = [...slicePath, 'tests', descriptor.testIndex, descriptor.testSection];
                    if (descriptor.testCollection === 'command') {
                        return [...itemPath, 'command'];
                    }
                    return [...itemPath, descriptor.testCollection, descriptor.testItemIndex];
                }
                default:
                    return null;
            }
        }

        function getAt(root, path) {
            return path.reduce((value, key) => value == null ? undefined : value[key], root);
        }

        function setAt(root, path, value) {
            const parent = getAt(root, path.slice(0, -1));
            if (parent == null) return;
            parent[path[path.length - 1]] = value;
        }

        function deleteAt(root, path) {
            const parent = getAt(root, path.slice(0, -1));
            if (parent == null) return;
            delete parent[path[path.length - 1]];
        }

        function descriptorFromElement(element) {
            const kind = element.getAttribute('data-inline-edit-kind');
            const number = attribute => Number.parseInt(element.getAttribute(attribute), 10);
            if (!kind) return null;

            if (kind === 'hotspot') {
                return {
                    kind,
                    scope: element.getAttribute('data-hotspot-scope'),
                    sliceIndex: number('data-slice-index'),
                    hotspotIndex: number('data-hotspot-index')
                };
            }
            if (kind === 'event') {
                return { kind, sliceIndex: number('data-slice-index'), eventIndex: number('data-event-index') };
            }
            if (kind === 'test-name' || kind === 'test-error') {
                return { kind, sliceIndex: number('data-slice-index'), testIndex: number('data-test-index') };
            }
            if (kind === 'test-item') {
                return {
                    kind,
                    sliceIndex: number('data-slice-index'),
                    testIndex: number('data-test-index'),
                    testSection: element.getAttribute('data-test-section'),
                    testCollection: element.getAttribute('data-test-collection'),
                    testItemIndex: number('data-test-item-index')
                };
            }
            return { kind, sliceIndex: number('data-slice-index') };
        }

        function samePath(left, right) {
            const leftPath = pathFor(left);
            const rightPath = pathFor(right);
            return JSON.stringify(leftPath) === JSON.stringify(rightPath);
        }

        function findElement(descriptor) {
            const candidates = Array.from(document.querySelectorAll('[data-inline-edit-kind]'));
            return candidates.find(candidate => {
                const candidateDescriptor = descriptorFromElement(candidate);
                return candidateDescriptor && samePath(candidateDescriptor, descriptor);
            }) || null;
        }

        function listViews(json) {
            const views = [];
            (json && Array.isArray(json.slices) ? json.slices : []).forEach(slice => {
                const view = slice && isObject(slice.view) ? slice.view : null;
                if (!view) return;
                const name = asText(view.name);
                const id = asText(view.id) || name;
                views.push({ name, id });
            });
            return views;
        }

        function listCommands(json) {
            const commands = [];
            (json && Array.isArray(json.slices) ? json.slices : []).forEach(slice => {
                const command = slice && isObject(slice.command) ? slice.command : null;
                if (!command) return;
                const name = asText(command.name);
                const id = asText(command.id) || name;
                commands.push({ name, id });
            });
            return commands;
        }

        function listEvents(json, sliceIndex) {
            const events = [];
            const references = [];
            const seen = new Set();
            const addEvent = event => {
                if (!isObject(event)) return;
                const name = asText(event.name);
                const id = asText(event.id) || name;
                if (!event.id && events.some(existing => existing.name === name)) return;
                const key = `${name}\u0000${id}`;
                if (seen.has(key)) return;
                seen.add(key);
                events.push({ name, id });
            };
            const allSlices = json && Array.isArray(json.slices) ? json.slices : [];
            const scopedToSlice = Number.isInteger(sliceIndex);
            const slices = scopedToSlice
                ? [allSlices[sliceIndex]]
                : allSlices;
            slices.forEach(slice => {
                (slice && Array.isArray(slice.events) ? slice.events : []).forEach(event => {
                    addEvent(event);
                });
                (slice && slice.command && Array.isArray(slice.command.events)
                    ? slice.command.events
                    : []).forEach(event => {
                    if (isObject(event)) addEvent(event);
                    else if (!scopedToSlice) references.push(event);
                });
                (!scopedToSlice && slice && slice.view && Array.isArray(slice.view.events)
                    ? slice.view.events
                    : []).forEach(reference => {
                        if (isObject(reference)) addEvent(reference);
                        else references.push(reference);
                    });
            });
            if (!scopedToSlice) references.forEach(reference => {
                const value = referenceText(reference);
                if (!value || events.some(event => event.id === value || event.name === value)) return;
                events.push({ name: value, id: value });
            });
            return events;
        }

        function referencesForTestItem(json, descriptor) {
            if (descriptor.testCollection === 'command') return listCommands(json);
            if (descriptor.testCollection === 'views') return listViews(json);
            return listEvents(json);
        }

        function referenceText(reference) {
            if (isObject(reference)) {
                return asText(reference.id) || asText(reference.name);
            }
            return asText(reference);
        }

        function readDraft(descriptor) {
            const target = getAt(rawJson, pathFor(descriptor));
            if (descriptor.kind === 'slice') {
                const slice = isObject(target) ? target : {};
                const hasId = Object.prototype.hasOwnProperty.call(slice, 'id');
                return {
                    name: asText(slice.name),
                    id: hasId ? asText(slice.id) : asText(slice.name),
                    idEnabled: hasId,
                    border: asText(slice.border),
                    background: asText(slice.background),
                    hints: Array.isArray(slice.hints) ? slice.hints.map(asText).join('\n') : asText(slice.hints)
                };
            }
            if (descriptor.kind === 'note' || descriptor.kind === 'hotspot' || descriptor.kind === 'test-error') {
                return { text: asText(target) };
            }
            if (descriptor.kind === 'test-name') {
                return { name: isObject(target) ? asText(target.name) : '' };
            }
            if (descriptor.kind === 'trigger') {
                const trigger = isObject(target) ? target : {};
                return {
                    name: asText(trigger.name),
                    type: asText(trigger.type) || 'ui',
                    swimlane: asText(trigger.swimlane),
                    properties: propertiesToText(trigger.properties, 'value'),
                    views: Array.isArray(trigger.views) ? trigger.views.map(asText) : [],
                    buttons: Array.isArray(trigger.buttons) ? trigger.buttons.map(asText).join('\n') : ''
                };
            }
            const element = isObject(target) ? target : {};
            const propertyField = descriptor.kind === 'command' ||
                descriptor.kind === 'view' ||
                descriptor.kind === 'event' ? 'type' : 'value';
            const draft = {
                name: asText(element.name),
                properties: propertiesToText(element.properties, propertyField),
                events: descriptor.kind === 'command' || descriptor.kind === 'view'
                    ? (Array.isArray(element.events) ? element.events.map(referenceText) : [])
                    : undefined
            };
            if (descriptor.kind === 'command' || descriptor.kind === 'view' || descriptor.kind === 'event') {
                const hasId = Object.prototype.hasOwnProperty.call(element, 'id');
                draft.id = hasId ? asText(element.id) : draft.name;
                draft.idEnabled = hasId;
            }
            if (descriptor.kind === 'event') {
                draft.swimlane = asText(element.swimlane);
                draft.external = element.external === true;
            }
            return draft;
        }

        function createField(editor, labelText, tagName, field, value) {
            const label = document.createElement('label');
            label.textContent = labelText;
            const input = document.createElement(tagName);
            input.dataset.inlineEditField = field;
            input.value = value;
            if (tagName === 'textarea') {
                input.rows = 3;
            }
            label.appendChild(input);
            editor.appendChild(label);
            return input;
        }

        function createViewsField(editor, views, selectedViews) {
            return createReferenceField(editor, 'Views', 'views', views, selectedViews);
        }

        function createReferenceField(editor, labelText, field, references, selectedReferences) {
            const label = document.createElement('label');
            label.textContent = labelText;
            const select = document.createElement('select');
            select.multiple = true;
            select.size = Math.min(Math.max(references.length, 2), 6);
            select.dataset.inlineEditField = field;
            const selected = new Set(selectedReferences);
            references.forEach(reference => {
                const option = document.createElement('option');
                option.value = reference.id;
                option.textContent = `${reference.name} - ${reference.id}`;
                option.selected = selected.has(reference.id) || selected.has(reference.name);
                select.appendChild(option);
            });
            label.appendChild(select);
            editor.appendChild(label);
            return select;
        }

        function createTestItemNameField(editor, references, selectedName) {
            const label = document.createElement('label');
            label.textContent = 'Name';
            const select = document.createElement('select');
            select.dataset.inlineEditField = 'name';
            const selectedReference = references.find(reference =>
                reference.name === selectedName || reference.id === selectedName
            );
            if (!selectedReference && selectedName) {
                const unavailable = document.createElement('option');
                unavailable.value = selectedName;
                unavailable.textContent = `${selectedName} (unavailable)`;
                unavailable.selected = true;
                unavailable.disabled = true;
                select.appendChild(unavailable);
            }
            references.forEach(reference => {
                const option = document.createElement('option');
                option.value = reference.name;
                option.textContent = `${reference.name} - ${reference.id}`;
                option.selected = selectedReference === reference;
                select.appendChild(option);
            });
            label.appendChild(select);
            editor.appendChild(label);
            return select;
        }

        function createCheckbox(editor, labelText, field, checked) {
            const label = document.createElement('label');
            label.className = 'inline-edit-checkbox';
            const input = document.createElement('input');
            input.type = 'checkbox';
            input.dataset.inlineEditField = field;
            input.checked = checked;
            const text = document.createElement('span');
            text.textContent = labelText;
            label.append(text, input);
            editor.appendChild(label);
            return input;
        }

        function createIdField(editor, value, enabled) {
            const label = document.createElement('label');
            label.textContent = 'ID';
            const row = document.createElement('span');
            row.className = 'inline-edit-id-row';
            const input = document.createElement('input');
            input.type = 'text';
            input.dataset.inlineEditField = 'id';
            input.value = value;
            input.disabled = !enabled;
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.dataset.inlineEditField = 'idEnabled';
            checkbox.checked = enabled;
            checkbox.title = 'Use a custom ID';
            checkbox.setAttribute('aria-label', 'Use a custom ID');
            row.append(input, checkbox);
            label.appendChild(row);
            editor.appendChild(label);
            return { input, checkbox };
        }

        function renderRecentColors(container, field, textInput, colorInput) {
            container.replaceChildren();
            recentColors.forEach(color => {
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'inline-edit-recent-color';
                button.style.backgroundColor = color;
                button.title = color;
                button.setAttribute('aria-label', `Use recent color ${color}`);
                button.addEventListener('click', () => {
                    textInput.value = color;
                    colorInput.value = colorInputValue(color);
                    if (activeEdit) activeEdit.draft[field] = color;
                });
                container.appendChild(button);
            });
        }

        function createColorField(editor, labelText, field, value) {
            const label = document.createElement('label');
            label.textContent = labelText;
            const row = document.createElement('span');
            row.className = 'inline-edit-color-row';
            const textInput = document.createElement('input');
            textInput.type = 'text';
            textInput.dataset.inlineEditField = field;
            textInput.value = value;
            const colorInput = document.createElement('input');
            colorInput.type = 'color';
            colorInput.dataset.inlineEditColorFor = field;
            colorInput.value = colorInputValue(value);
            colorInput.title = `Choose ${labelText.toLowerCase()} color`;
            row.append(textInput, colorInput);
            const recent = document.createElement('span');
            recent.className = 'inline-edit-recent-colors';
            label.append(row, recent);
            editor.appendChild(label);
            renderRecentColors(recent, field, textInput, colorInput);
        }

        function setupIdField(editor) {
            const nameInput = editor.querySelector('[data-inline-edit-field="name"]');
            const idInput = editor.querySelector('[data-inline-edit-field="id"]');
            const idEnabled = editor.querySelector('[data-inline-edit-field="idEnabled"]');
            const updateIdInputState = () => {
                const disabled = !idEnabled.checked;
                idInput.disabled = disabled;
                idInput.setAttribute('aria-disabled', String(disabled));
                if (disabled) idInput.value = nameInput.value;
            };
            nameInput.addEventListener('input', updateIdInputState);
            idEnabled.addEventListener('change', updateIdInputState);
            updateIdInputState();
        }

        function positionOverlay(overlay) {
            if (!overlay || !diagramContainer) return;
            const containerRect = diagramContainer.getBoundingClientRect();
            overlay.style.left = `${containerRect.left + containerRect.width / 2}px`;
            overlay.style.top = `${containerRect.top + containerRect.height / 2}px`;
        }

        function repositionActiveOverlays() {
            positionOverlay(activeEdit && activeEdit.editor);
            positionOverlay(renameChoice);
        }

        function renderEditor() {
            if (!activeEdit || !activeEdit.target) return;
            const target = activeEdit.target;
            activeEdit.originalHtml = target.innerHTML;

            if (activeEdit.editor && activeEdit.editor.isConnected) {
                activeEdit.editor.remove();
            }

            const editor = document.createElement('div');
            editor.className = 'inline-edit-editor';
            editor.dataset.inlineEditor = 'true';
            const { descriptor, draft } = activeEdit;

            if (descriptor.kind === 'slice') {
                createField(editor, 'Name', 'input', 'name', draft.name);
                createIdField(editor, draft.id, draft.idEnabled);
                createColorField(editor, 'Border', 'border', draft.border);
                createColorField(editor, 'Background', 'background', draft.background);
                createField(editor, 'Hints (one per line)', 'textarea', 'hints', draft.hints);
            } else if (descriptor.kind === 'note' || descriptor.kind === 'hotspot' || descriptor.kind === 'test-error') {
                createField(editor, descriptor.kind === 'test-error' ? 'Error' : 'Text', 'textarea', 'text', draft.text);
            } else if (descriptor.kind === 'test-name') {
                createField(editor, 'Test name', 'input', 'name', draft.name);
            } else if (descriptor.kind === 'test-item') {
                createTestItemNameField(
                    editor,
                    referencesForTestItem(rawJson, descriptor),
                    draft.name
                );
                createField(editor, 'Properties (name: value)', 'textarea', 'properties', draft.properties);
            } else {
                createField(editor, 'Name', 'input', 'name', draft.name);
                if (descriptor.kind === 'command' || descriptor.kind === 'view' || descriptor.kind === 'event') {
                    createIdField(editor, draft.id, draft.idEnabled);
                }

                if (descriptor.kind === 'trigger') {
                    const typeLabel = document.createElement('label');
                    typeLabel.textContent = 'Type';
                    const typeSelect = document.createElement('select');
                    typeSelect.dataset.inlineEditField = 'type';
                    SUPPORTED_TRIGGER_TYPES.forEach(type => {
                        const option = document.createElement('option');
                        option.value = type;
                        option.textContent = type;
                        typeSelect.appendChild(option);
                    });
                    if (!SUPPORTED_TRIGGER_TYPES.includes(draft.type)) {
                        const unsupported = document.createElement('option');
                        unsupported.value = draft.type;
                        unsupported.textContent = `${draft.type} (unsupported)`;
                        typeSelect.appendChild(unsupported);
                    }
                    typeSelect.value = draft.type;
                    typeLabel.appendChild(typeSelect);
                    editor.appendChild(typeLabel);
                    createField(editor, 'Swimlane', 'input', 'swimlane', draft.swimlane);
                }

                if (descriptor.kind === 'event') {
                    createField(editor, 'Swimlane', 'input', 'swimlane', draft.swimlane);
                }

                const propertyLabel = descriptor.kind === 'trigger'
                    ? 'Properties (name: value)'
                    : 'Properties (name: type)';
                createField(editor, propertyLabel, 'textarea', 'properties', draft.properties);

                if (descriptor.kind === 'event') {
                    createCheckbox(editor, 'External event', 'external', draft.external);
                }

                if (descriptor.kind === 'trigger') {
                    createField(editor, 'Buttons (one per line)', 'textarea', 'buttons', draft.buttons);
                    createViewsField(editor, listViews(rawJson), draft.views);
                } else if (descriptor.kind === 'command' || descriptor.kind === 'view') {
                    const eventOptions = descriptor.kind === 'command'
                        ? listEvents(rawJson, descriptor.sliceIndex)
                        : listEvents(rawJson);
                    createReferenceField(editor, 'Events', 'events', eventOptions, draft.events);
                }
            }

            const error = document.createElement('p');
            error.className = 'inline-edit-error';
            error.hidden = true;
            editor.appendChild(error);

            const actions = document.createElement('div');
            actions.className = 'inline-edit-actions';
            const cancel = document.createElement('button');
            cancel.type = 'button';
            cancel.textContent = 'Cancel';
            const save = document.createElement('button');
            save.type = 'button';
            save.textContent = 'Save';
            actions.append(cancel, save);
            editor.appendChild(actions);
            activeEdit.editor = editor;

            editor.querySelectorAll('[data-inline-edit-field]').forEach(field => {
                const readValue = () => field.type === 'checkbox'
                    ? field.checked
                    : field.multiple
                        ? Array.from(field.selectedOptions).map(option => option.value)
                        : field.value;
                field.addEventListener('input', () => {
                    activeEdit.draft[field.dataset.inlineEditField] = readValue();
                });
                field.addEventListener('change', () => {
                    activeEdit.draft[field.dataset.inlineEditField] = readValue();
                });
            });
            if (descriptor.kind === 'slice' ||
                descriptor.kind === 'command' ||
                descriptor.kind === 'view' ||
                descriptor.kind === 'event') {
                setupIdField(editor);
            }
            if (descriptor.kind === 'slice') {
                editor.querySelectorAll('[data-inline-edit-color-for]').forEach(colorInput => {
                    const field = colorInput.dataset.inlineEditColorFor;
                    const textInput = editor.querySelector(`[data-inline-edit-field="${field}"]`);
                    const recent = colorInput.closest('label').querySelector('.inline-edit-recent-colors');
                    const updateFromPicker = () => {
                        textInput.value = colorInput.value;
                        activeEdit.draft[field] = colorInput.value;
                        rememberRecentColor(colorInput.value);
                        renderRecentColors(recent, field, textInput, colorInput);
                    };
                    colorInput.addEventListener('input', updateFromPicker);
                    colorInput.addEventListener('change', updateFromPicker);
                    textInput.addEventListener('input', () => {
                        const parsed = colorToHex(textInput.value);
                        if (parsed) colorInput.value = parsed;
                    });
                });
            }
            cancel.addEventListener('click', cancelEdit);
            save.addEventListener('click', commitEdit);

            diagramContainer.appendChild(editor);
            positionOverlay(editor);
            const firstField = editor.querySelector('[data-inline-edit-field]');
            if (firstField) firstField.focus();
        }

        function syncDraftFromEditor() {
            if (!activeEdit || !activeEdit.editor) return;
            activeEdit.editor.querySelectorAll('[data-inline-edit-field]').forEach(field => {
                activeEdit.draft[field.dataset.inlineEditField] =
                    field.type === 'checkbox'
                        ? field.checked
                        : field.multiple
                            ? Array.from(field.selectedOptions).map(option => option.value)
                            : field.value;
            });
        }

        function showValidationError(message) {
            if (!activeEdit || !activeEdit.editor) return;
            const error = activeEdit.editor.querySelector('.inline-edit-error');
            if (error) {
                error.textContent = message;
                error.hidden = false;
            }
        }

        function clearValidationError() {
            if (!activeEdit || !activeEdit.editor) return;
            const error = activeEdit.editor.querySelector('.inline-edit-error');
            if (error) {
                error.textContent = '';
                error.hidden = true;
            }
        }

        function parseProperties(text, field, rejectDuplicates) {
            const result = [];
            const names = new Set();
            const lines = String(text || '').split(/\r?\n/);
            for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
                const line = lines[lineIndex];
                if (!line.trim()) continue;
                const separator = line.indexOf(':');
                if (separator < 0) {
                    throw new Error(`Property line ${lineIndex + 1} must contain ":"`);
                }
                const name = line.slice(0, separator).trim();
                const value = line.slice(separator + 1).trim();
                if (!name) {
                    throw new Error(`Property line ${lineIndex + 1} has no name`);
                }
                if (field === 'type' && !value) {
                    throw new Error(`Property "${name}" must have a type`);
                }
                if (rejectDuplicates && names.has(name)) {
                    throw new Error(`Property "${name}" is duplicated`);
                }
                names.add(name);
                result.push({ name, value });
            }
            return result;
        }

        function propertiesForRaw(parsed, field, originals) {
            return parsed.map((property, index) => {
                const original = Array.isArray(originals) ? originals[index] : null;
                if (field === 'type') {
                    return { name: property.name, type: property.value };
                }
                if (isObject(original) && original.name === undefined &&
                    (original.label !== undefined || original.propertyName !== undefined)) {
                    return { label: property.name, propertyName: property.value };
                }
                if (isObject(original) && original.value === undefined &&
                    original.type !== undefined && original.name !== undefined) {
                    return { name: property.name, type: property.value };
                }
                if (isObject(original) && original.name !== undefined &&
                    original.value === undefined && original.type === undefined &&
                    property.value === '') {
                    return { name: property.name };
                }
                return { name: property.name, value: property.value };
            });
        }

        function collectNamedElements(json, kind) {
            const entries = [];
            (json && Array.isArray(json.slices) ? json.slices : []).forEach((slice, sliceIndex) => {
                if (kind === 'event') {
                    (Array.isArray(slice.events) ? slice.events : []).forEach((element, eventIndex) => {
                        entries.push({ element, descriptor: { kind, sliceIndex, eventIndex } });
                    });
                } else {
                    const element = slice && slice[kind];
                    if (element) entries.push({ element, descriptor: { kind, sliceIndex } });
                }
            });
            return entries;
        }

        function nameConflicts(json, descriptor, name, renameAll, oldName) {
            const entries = collectNamedElements(json, descriptor.kind);
            return entries.some(entry => {
                if (renameAll && entry.element && entry.element.name === oldName) return false;
                return !samePath(entry.descriptor, descriptor) && entry.element &&
                    entry.element.name === name;
            });
        }

        function duplicateNameMatches(json, descriptor, oldName) {
            return collectNamedElements(json, descriptor.kind)
                .filter(entry => entry.element && entry.element.name === oldName);
        }

        function updateNameReferences(json, kind, oldName, newName) {
            const explicitIds = new Set();
            (json.slices || []).forEach(slice => {
                (slice.events || []).forEach(event => {
                    if (event && event.id) explicitIds.add(String(event.id));
                });
                if (slice.view && slice.view.id) explicitIds.add(String(slice.view.id));
            });
            const replaceReference = reference =>
                reference === oldName && !explicitIds.has(reference) ? newName : reference;

            (json.slices || []).forEach(slice => {
                if (kind === 'event') {
                    if (slice.command && Array.isArray(slice.command.events)) {
                        slice.command.events = slice.command.events.map(replaceReference);
                    }
                    if (slice.view && Array.isArray(slice.view.events)) {
                        slice.view.events = slice.view.events.map(replaceReference);
                    }
                } else if (kind === 'view' && slice.trigger && Array.isArray(slice.trigger.views)) {
                    slice.trigger.views = slice.trigger.views.map(replaceReference);
                }
            });
        }

        function validateDraft() {
            const { descriptor, draft } = activeEdit;
            if (descriptor.kind === 'slice') {
                draft.name = draft.name.trim();
                if (draft.idEnabled) draft.id = draft.id.trim();
            } else if (descriptor.kind === 'trigger' &&
                !SUPPORTED_TRIGGER_TYPES.includes(draft.type)) {
                throw new Error(`Unsupported trigger type "${draft.type}"`);
            }

            if (descriptor.kind === 'command' || descriptor.kind === 'view' || descriptor.kind === 'event') {
                draft.name = draft.name.trim();
                if (!draft.name) throw new Error('Name is required');
                if (nameConflicts(rawJson, descriptor, draft.name, false, '')) {
                    throw new Error(`A ${descriptor.kind} named "${draft.name}" already exists`);
                }
                if (draft.idEnabled) draft.id = draft.id.trim();
                parseProperties(draft.properties, 'type', true);
            } else if (descriptor.kind === 'trigger' || descriptor.kind === 'test-item') {
                parseProperties(draft.properties, 'value', descriptor.kind === 'trigger');
            }

            if (descriptor.kind === 'test-name') {
                draft.name = draft.name.trim();
            }
        }

        function createRenameChoice() {
            const { descriptor, draft } = activeEdit;
            const currentTarget = getAt(rawJson, pathFor(descriptor));
            const oldName = asText(currentTarget && currentTarget.name);
            const choice = document.createElement('div');
            choice.className = 'inline-edit-rename-choice';
            choice.innerHTML = `<p>Several ${descriptor.kind}s are named "${escapeText(oldName)}". Rename this one or all matching elements?</p>`;
            const actions = document.createElement('div');
            actions.className = 'inline-edit-choice-actions';
            const cancel = document.createElement('button');
            cancel.type = 'button';
            cancel.textContent = 'Cancel';
            const current = document.createElement('button');
            current.type = 'button';
            current.textContent = 'This element only';
            const all = document.createElement('button');
            all.type = 'button';
            all.textContent = 'All matching';
            actions.append(cancel, current, all);
            choice.appendChild(actions);
            diagramContainer.appendChild(choice);
            positionOverlay(choice);
            renameChoice = choice;
            cancel.addEventListener('click', closeRenameChoice);
            current.addEventListener('click', () => finishCommit('current'));
            all.addEventListener('click', () => finishCommit('all'));
        }

        function closeRenameChoice() {
            if (renameChoice) renameChoice.remove();
            renameChoice = null;
        }

        function finishCommit(renameScope) {
            if (!activeEdit) return;
            closeRenameChoice();
            syncDraftFromEditor();
            try {
                validateDraft();
                const nextJson = cloneJson(rawJson);
                applyDraft(nextJson, activeEdit.descriptor, activeEdit.draft, renameScope);
                const source = 'diagram-inline-edit';
                activeEdit.editor?.remove();
                activeEdit = null;
                EventBus.emit(Events.JSON_CHANGED, { json: nextJson, source });
            } catch (error) {
                showValidationError(error.message);
            }
        }

        function commitEdit() {
            if (!activeEdit || renameChoice) return;
            clearValidationError();
            syncDraftFromEditor();
            try {
                validateDraft();
                const { descriptor, draft } = activeEdit;
                if (descriptor.kind === 'command' || descriptor.kind === 'view' || descriptor.kind === 'event') {
                    const current = getAt(rawJson, pathFor(descriptor));
                    const oldName = current && current.name;
                    if (oldName && draft.name !== oldName &&
                        duplicateNameMatches(rawJson, descriptor, oldName).length > 1) {
                        createRenameChoice();
                        return;
                    }
                }
                finishCommit('current');
            } catch (error) {
                showValidationError(error.message);
            }
        }

        function applyDraft(json, descriptor, draft, renameScope) {
            const targetPath = pathFor(descriptor);
            const target = getAt(json, targetPath);

            if (descriptor.kind === 'slice') {
                target.name = draft.name.trim();
                if (draft.idEnabled) target.id = draft.id.trim();
                else delete target.id;

                if (draft.border.trim()) target.border = draft.border.trim();
                else delete target.border;
                if (draft.background.trim()) target.background = draft.background.trim();
                else delete target.background;

                const hints = String(draft.hints || '')
                    .split(/\r?\n/)
                    .map(hint => hint.trim())
                    .filter(Boolean);
                if (hints.length > 0) target.hints = hints;
                else delete target.hints;
                return;
            }
            if (descriptor.kind === 'note' || descriptor.kind === 'hotspot' || descriptor.kind === 'test-error') {
                setAt(json, targetPath, draft.text);
                return;
            }
            if (descriptor.kind === 'test-name') {
                if (draft.name) target.name = draft.name;
                else delete target.name;
                return;
            }
            if (descriptor.kind === 'trigger') {
                if (draft.name) target.name = draft.name;
                else delete target.name;
                target.type = draft.type;
                target.swimlane = asText(draft.swimlane);
                const parsed = parseProperties(draft.properties, 'value', true);
                target.properties = propertiesForRaw(parsed, 'value', target.properties);
                if (draft.views.length > 0) target.views = draft.views;
                else delete target.views;
                target.buttons = String(draft.buttons || '').split(/\r?\n/).filter(line => line.trim());
                return;
            }
            if (descriptor.kind === 'test-item') {
                target.name = draft.name;
                const parsed = parseProperties(draft.properties, 'value', false);
                target.properties = propertiesForRaw(parsed, 'value', target.properties);
                return;
            }

            const parsed = parseProperties(draft.properties, 'type', true);
            const oldName = target.name;
            const newName = draft.name;
            if (draft.idEnabled) target.id = draft.id.trim();
            else delete target.id;
            if (renameScope === 'all') {
                collectNamedElements(json, descriptor.kind)
                    .filter(entry => entry.element && entry.element.name === oldName)
                    .forEach(entry => {
                        entry.element.name = newName;
                    });
                updateNameReferences(json, descriptor.kind, oldName, newName);
            } else {
                target.name = newName;
            }
            target.properties = propertiesForRaw(parsed, 'type', target.properties);
            if (descriptor.kind === 'command' || descriptor.kind === 'view') {
                if (draft.events.length > 0) target.events = draft.events;
                else delete target.events;
            }
            if (descriptor.kind === 'event') {
                target.swimlane = asText(draft.swimlane);
                if (draft.external) target.external = true;
                else delete target.external;
            }
        }

        function cancelEdit() {
            if (!activeEdit) return;
            closeRenameChoice();
            if (activeEdit.target && activeEdit.target.isConnected) {
                activeEdit.target.innerHTML = activeEdit.originalHtml;
            }
            activeEdit.editor?.remove();
            activeEdit = null;
        }

        function restoreEditor() {
            if (!activeEdit) return;
            const target = findElement(activeEdit.descriptor);
            if (!target) {
                activeEdit = null;
                return;
            }
            if (target === activeEdit.target && activeEdit.editor?.isConnected) {
                return;
            }
            activeEdit.target = target;
            renderEditor();
        }

        function beginEdit(element) {
            if (activeEdit || !rawJson) return;
            const descriptor = descriptorFromElement(element);
            if (!descriptor || pathFor(descriptor) === null) return;
            const target = getAt(rawJson, pathFor(descriptor));
            if (target === undefined) return;
            activeEdit = {
                descriptor,
                target: descriptor.kind === 'trigger'
                    ? element.closest('.trigger-slot') || element
                    : element,
                draft: readDraft(descriptor),
                originalHtml: ''
            };
            renderEditor();
        }

        function onDiagramDoubleClick(event) {
            if (activeEdit) return;
            const element = event.target.closest && event.target.closest('[data-inline-edit-kind]');
            if (!element || !diagramElement.contains(element)) return;
            event.preventDefault();
            beginEdit(element);
        }

        EventBus.on(Events.FILE_LOADED, ({ json }) => {
            rawJson = cloneJson(json);
        });

        EventBus.on(Events.INLINE_EDIT_REQUESTED, ({ element }) => {
            if (element) beginEdit(element);
        });

        EventBus.on(Events.JSON_CHANGED, ({ json }) => {
            rawJson = cloneJson(json);
        });

        EventBus.on(Events.MODEL_CHANGED, ({ source }) => {
            if (!activeEdit) return;
            if (source) {
                cancelEdit();
            } else {
                restoreEditor();
            }
        });

        EventBus.on(Events.FILTER_TOGGLED, () => {
            if (activeEdit) restoreEditor();
        });

        const diagramContainer = document.getElementById('diagramContainer');
        const diagramElement = document.getElementById('diagram');
        diagramElement.addEventListener('dblclick', onDiagramDoubleClick);
        diagramContainer.addEventListener('scroll', repositionActiveOverlays);
        window.addEventListener('resize', repositionActiveOverlays);
        EventBus.on(Events.EDITOR_RESIZED, repositionActiveOverlays);
        document.addEventListener('keydown', event => {
            if (activeEdit && event.key === 'Escape') {
                event.preventDefault();
                cancelEdit();
            }
        });
