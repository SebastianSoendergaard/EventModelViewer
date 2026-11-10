        const contextMenuDiagramContainer = document.getElementById('diagramContainer');
        const contextMenuDiagramElement = document.getElementById('diagram');
        const diagramContextMenu = document.createElement('div');
        diagramContextMenu.className = 'diagram-context-menu';
        diagramContextMenu.setAttribute('role', 'menu');
        diagramContextMenu.hidden = true;
        contextMenuDiagramContainer.appendChild(diagramContextMenu);

        let contextMenuSliceIndex = null;
        let contextMenuElement = null;
        let contextMenuDescriptor = null;
        let contextMenuModel = null;

        function cloneContextMenuJson(value) {
            return JSON.parse(JSON.stringify(value));
        }

        function isContextMenuObject(value) {
            return value !== null && typeof value === 'object' && !Array.isArray(value);
        }

        function nextContextMenuName(base, values) {
            const names = new Set(values.filter(Boolean).map(value => String(value)));
            if (!names.has(base)) return base;
            let suffix = 2;
            while (names.has(`${base} ${suffix}`)) suffix++;
            return `${base} ${suffix}`;
        }

        function allNamedElements(kind) {
            return (contextMenuModel.slices || [])
                .map(slice => slice && slice[kind])
                .filter(Boolean)
                .map(element => element.name);
        }

        function createContextMenuElement(action, label, disabled) {
            const item = document.createElement('button');
            item.type = 'button';
            item.dataset.contextMenuAction = action;
            item.textContent = label;
            item.disabled = disabled;
            item.setAttribute('role', 'menuitem');
            return item;
        }

        function createContextMenuSeparator() {
            const separator = document.createElement('hr');
            separator.className = 'diagram-context-menu-separator';
            return separator;
        }

        function descriptorForContextElement(element) {
            const kind = element.getAttribute('data-inline-edit-kind');
            const number = attribute => Number.parseInt(element.getAttribute(attribute), 10);
            const testSection = element.getAttribute('data-context-menu-test-section');
            if (testSection) {
                return {
                    kind: 'test-section',
                    sliceIndex: number('data-slice-index'),
                    testIndex: number('data-test-index'),
                    testSection
                };
            }
            if (!kind) return null;
            if (kind === 'title') return { kind };
            if (kind === 'slice') {
                return { kind, sliceIndex: number('data-slice-index') };
            }
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

        function menuItemsForSlice(slice) {
            return [
                createContextMenuElement('add-trigger', 'Add Trigger', !!slice.trigger),
                createContextMenuElement('add-view', 'Add view', !!slice.view),
                createContextMenuElement('add-command', 'Add command', !!slice.command),
                createContextMenuElement('add-event', 'Add event', false),
                createContextMenuElement('add-note', 'Add note', Object.prototype.hasOwnProperty.call(slice, 'note')),
                createContextMenuElement('add-hotspot', 'Add hotspot', false),
                createContextMenuElement('add-test', 'Add test', false)
            ];
        }

        function menuItemsForTestSection(test, section) {
            if (section === 'given') {
                return [createContextMenuElement('add-test-event', 'Add event', false)];
            }
            if (section === 'when') {
                const when = test && test.when;
                const hasCommand = when && (
                    when.command ||
                    when.name ||
                    typeof when === 'string'
                );
                return [createContextMenuElement(
                    'add-test-command',
                    'Add command',
                    !!hasCommand
                )];
            }
            if (section === 'then') {
                return [
                    createContextMenuElement('add-test-event', 'Add event', false),
                    createContextMenuElement('add-test-view', 'Add view', false)
                ];
            }
            return [];
        }

        function showDiagramContextMenu(event) {
            event.preventDefault();
            const sliceElement = event.target.closest && event.target.closest('[data-slice-index]');
            const sliceIndex = sliceElement ? Number.parseInt(sliceElement.getAttribute('data-slice-index'), 10) : null;
            const slice = Number.isInteger(sliceIndex) && contextMenuModel &&
                Array.isArray(contextMenuModel.slices) ? contextMenuModel.slices[sliceIndex] : null;
            const testSectionElement = event.target.closest &&
                event.target.closest('[data-context-menu-test-section]');
            const inlineEditElement = event.target.closest &&
                event.target.closest('[data-inline-edit-kind]');
            const testCaseElement = event.target.closest &&
                event.target.closest('.test-case[data-inline-edit-kind="test-name"]');
            const isOutsideSlice = !slice && !testSectionElement && !inlineEditElement && !testCaseElement;
            const backgroundTitleElement = isOutsideSlice
                ? contextMenuDiagramElement.querySelector('.diagram-title')
                : null;
            contextMenuElement = testSectionElement || inlineEditElement || testCaseElement || backgroundTitleElement;
            contextMenuDescriptor = contextMenuElement
                ? descriptorForContextElement(contextMenuElement)
                : isOutsideSlice && contextMenuModel
                    ? { kind: 'title' }
                    : null;

            contextMenuSliceIndex = slice ? sliceIndex : null;
            diagramContextMenu.replaceChildren();
            const testElementKinds = new Set(['test-name', 'test-item', 'test-error']);
            const isTestElement = contextMenuDescriptor &&
                testElementKinds.has(contextMenuDescriptor.kind);
            const isTestSection = contextMenuDescriptor &&
                contextMenuDescriptor.kind === 'test-section';
            const isSliceElement = contextMenuDescriptor && contextMenuDescriptor.kind === 'slice';
            const isTitleElement = contextMenuDescriptor && contextMenuDescriptor.kind === 'title';
            const canShowSliceActions = slice && !isTestElement &&
                (!contextMenuElement || isSliceElement || isTestSection);
            if (contextMenuElement && contextMenuDescriptor &&
                !isTestElement && !isTestSection && !isTitleElement) {
                diagramContextMenu.appendChild(createContextMenuElement('edit-element', 'Edit', false));
                diagramContextMenu.appendChild(createContextMenuElement('delete-element', 'Delete', false));
                if (canShowSliceActions) {
                    diagramContextMenu.appendChild(createContextMenuSeparator());
                }
            }
            if (isOutsideSlice && isTitleElement) {
                diagramContextMenu.appendChild(createContextMenuElement('edit-element', 'Edit', false));
                diagramContextMenu.appendChild(createContextMenuSeparator());
                diagramContextMenu.appendChild(createContextMenuElement('add-slice', 'Add slice', false));
            } else if (contextMenuElement && isTitleElement) {
                diagramContextMenu.appendChild(createContextMenuElement('edit-element', 'Edit', false));
            }
            if (contextMenuElement && contextMenuDescriptor && isTestElement) {
                diagramContextMenu.appendChild(createContextMenuElement('edit-element', 'Edit', false));
                diagramContextMenu.appendChild(createContextMenuElement('delete-element', 'Delete', false));
            } else if (!isTestSection && !slice && !isTitleElement) {
                diagramContextMenu.appendChild(createContextMenuElement('add-slice', 'Add slice', false));
            }
            if (canShowSliceActions) {
                if (contextMenuDescriptor && contextMenuDescriptor.kind === 'test-section') {
                    const test = slice.tests && slice.tests[contextMenuDescriptor.testIndex];
                    menuItemsForTestSection(test, contextMenuDescriptor.testSection)
                        .forEach(item => diagramContextMenu.appendChild(item));
                } else {
                    menuItemsForSlice(slice).forEach(item => diagramContextMenu.appendChild(item));
                }
            }
            if (canShowSliceActions && !isTestSection) {
                diagramContextMenu.appendChild(createContextMenuSeparator());
                diagramContextMenu.appendChild(createContextMenuElement('add-slice', 'Add slice', false));
            }

            diagramContextMenu.hidden = false;
            const menuWidth = diagramContextMenu.offsetWidth;
            const menuHeight = diagramContextMenu.offsetHeight;
            diagramContextMenu.style.left = `${Math.max(4, Math.min(event.clientX, window.innerWidth - menuWidth - 4))}px`;
            diagramContextMenu.style.top = `${Math.max(4, Math.min(event.clientY, window.innerHeight - menuHeight - 4))}px`;
        }

        function hideDiagramContextMenu() {
            diagramContextMenu.hidden = true;
            contextMenuSliceIndex = null;
            contextMenuElement = null;
            contextMenuDescriptor = null;
        }

        function addContextMenuSlice(json) {
            if (!Array.isArray(json.slices)) json.slices = [];
            const name = nextContextMenuName('New slice', json.slices.map(slice => slice && slice.name));
            json.slices.push({ name });
        }

        function addContextMenuTestItem(json, descriptor, action) {
            const slice = json.slices[descriptor.sliceIndex];
            const test = slice && Array.isArray(slice.tests) && slice.tests[descriptor.testIndex];
            if (!test) return;

            const sectionName = descriptor.testSection;
            if (action === 'add-test-command') {
                let section = test.when;
                if (typeof section === 'string') {
                    section = { command: { name: section, properties: [] } };
                    test.when = section;
                } else if (isContextMenuObject(section) && section.name && !section.command) {
                    section = { command: section };
                    test.when = section;
                } else if (!isContextMenuObject(section)) {
                    section = {};
                    test.when = section;
                }
                if (section.command) return;
                section.command = {
                    name: nextContextMenuName('New Command', allNamedElements('command')),
                    properties: []
                };
                return;
            }

            const collection = action === 'add-test-view' ? 'views' : 'events';
            const baseName = action === 'add-test-view' ? 'New View' : 'New Event';
            let section = test[sectionName];
            if (Array.isArray(section)) {
                section = {
                    events: section.map(item => isContextMenuObject(item)
                        ? item
                        : { name: String(item), properties: [] })
                };
                test[sectionName] = section;
            } else if (!isContextMenuObject(section)) {
                section = {};
                test[sectionName] = section;
            }
            if (!Array.isArray(section[collection])) section[collection] = [];
            section[collection].push({
                name: nextContextMenuName(
                    baseName,
                    section[collection].map(item => item && item.name)
                ),
                properties: []
            });
        }

        function addContextMenuElement(json, action, sliceIndex) {
            const slice = json.slices[sliceIndex];
            if (!slice) return;

            if (action === 'add-test') {
                if (!Array.isArray(slice.tests)) slice.tests = [];
                slice.tests.push({
                    name: nextContextMenuName('New test', slice.tests.map(test => test && test.name))
                });
            } else if (action === 'add-trigger' && !slice.trigger) {
                slice.trigger = {
                    name: nextContextMenuName('New Trigger', allNamedElements('trigger')),
                    type: 'ui',
                    properties: []
                };
            } else if (action === 'add-view' && !slice.view) {
                slice.view = {
                    name: nextContextMenuName('New View', allNamedElements('view')),
                    properties: [],
                    events: []
                };
            } else if (action === 'add-command' && !slice.command) {
                slice.command = {
                    name: nextContextMenuName('New Command', allNamedElements('command')),
                    properties: [],
                    events: []
                };
            } else if (action === 'add-event') {
                if (!Array.isArray(slice.events)) slice.events = [];
                slice.events.push({
                    name: nextContextMenuName('New Event', (slice.events || []).map(event => event && event.name)),
                    properties: []
                });
            } else if (action === 'add-note' && !Object.prototype.hasOwnProperty.call(slice, 'note')) {
                slice.note = 'New note';
            } else if (action === 'add-hotspot') {
                if (!Array.isArray(slice.hotspots)) slice.hotspots = [];
                slice.hotspots.push(nextContextMenuName('New hotspot', slice.hotspots));
            }
        }

        function deleteContextMenuElement(json, descriptor) {
            if (!descriptor) return;
            const slice = json.slices && json.slices[descriptor.sliceIndex];
            switch (descriptor.kind) {
                case 'slice':
                    if (Array.isArray(json.slices)) json.slices.splice(descriptor.sliceIndex, 1);
                    break;
                case 'command':
                case 'view':
                case 'trigger':
                case 'note':
                    if (slice) delete slice[descriptor.kind];
                    break;
                case 'event':
                    if (slice && Array.isArray(slice.events)) slice.events.splice(descriptor.eventIndex, 1);
                    break;
                case 'hotspot':
                    if (descriptor.scope === 'model') {
                        if (Array.isArray(json.hotspots)) json.hotspots.splice(descriptor.hotspotIndex, 1);
                    } else if (slice && Array.isArray(slice.hotspots)) {
                        slice.hotspots.splice(descriptor.hotspotIndex, 1);
                    }
                    break;
                case 'test-name':
                    if (slice && Array.isArray(slice.tests)) slice.tests.splice(descriptor.testIndex, 1);
                    break;
                case 'test-error': {
                    const test = slice && slice.tests && slice.tests[descriptor.testIndex];
                    if (test && test.then && typeof test.then === 'object') delete test.then.error;
                    break;
                }
                case 'test-item': {
                    const test = slice && slice.tests && slice.tests[descriptor.testIndex];
                    const section = test && test[descriptor.testSection];
                    if (!section) break;
                    if (descriptor.testCollection === 'command') {
                        delete section.command;
                    } else if (Array.isArray(section[descriptor.testCollection])) {
                        section[descriptor.testCollection].splice(descriptor.testItemIndex, 1);
                    }
                    break;
                }
                default:
                    break;
            }
        }

        diagramContextMenu.addEventListener('click', event => {
            const item = event.target.closest('[data-context-menu-action]');
            if (!item || item.disabled || !contextMenuModel) return;
            const action = item.dataset.contextMenuAction;
            if (action === 'edit-element') {
                event.stopPropagation();
                const target = contextMenuElement;
                const descriptor = contextMenuDescriptor;
                hideDiagramContextMenu();
                if ((target && target.isConnected) || descriptor?.kind === 'title') {
                    EventBus.emit(Events.INLINE_EDIT_REQUESTED, { element: target, descriptor });
                }
                return;
            }
            const nextJson = cloneContextMenuJson(contextMenuModel);
            if (action === 'delete-element') {
                deleteContextMenuElement(nextJson, contextMenuDescriptor);
            } else if (action === 'add-slice') {
                addContextMenuSlice(nextJson);
            } else if (action === 'add-test-event' ||
                action === 'add-test-command' ||
                action === 'add-test-view') {
                addContextMenuTestItem(nextJson, contextMenuDescriptor, action);
            } else if (contextMenuSliceIndex !== null) {
                addContextMenuElement(nextJson, action, contextMenuSliceIndex);
            }
            hideDiagramContextMenu();
            EventBus.emit(Events.JSON_CHANGED, { json: nextJson, source: 'diagram-context-menu' });
        });

        EventBus.on(Events.FILE_LOADED, ({ json }) => {
            contextMenuModel = json ? cloneContextMenuJson(json) : null;
            hideDiagramContextMenu();
        });

        EventBus.on(Events.JSON_CHANGED, ({ json }) => {
            contextMenuModel = json ? cloneContextMenuJson(json) : null;
        });

        contextMenuDiagramContainer.addEventListener('contextmenu', showDiagramContextMenu);
        document.addEventListener('click', event => {
            if (!event.target.closest('.diagram-context-menu')) hideDiagramContextMenu();
        });
        document.addEventListener('keydown', event => {
            if (event.key === 'Escape') hideDiagramContextMenu();
        });
