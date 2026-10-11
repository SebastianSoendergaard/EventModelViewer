(function() {
    const STORAGE_KEY = 'eventModelViewerPresentationState';
    const FILTER_NAMES = ['slices', 'tests', 'types', 'swimlanes'];
    const DEFAULT_FILTERS = {
        slices: true,
        tests: true,
        types: true,
        swimlanes: true
    };

    let fileStates = readFileStates();
    let currentKey = null;
    let currentState = createDefaultState();
    let persistTimer = null;

    function createDefaultState() {
        return {
            filters: { ...DEFAULT_FILTERS },
            zoom: null,
            scrollLeft: 0,
            scrollTop: 0
        };
    }

    function copyState(state) {
        return {
            filters: { ...state.filters },
            zoom: state.zoom,
            scrollLeft: state.scrollLeft,
            scrollTop: state.scrollTop
        };
    }

    function normalizeState(value) {
        const state = createDefaultState();
        if (!value || typeof value !== 'object' || Array.isArray(value)) return state;

        if (value.filters && typeof value.filters === 'object') {
            FILTER_NAMES.forEach(name => {
                if (typeof value.filters[name] === 'boolean') {
                    state.filters[name] = value.filters[name];
                }
            });
        }

        if (Number.isFinite(value.zoom) && value.zoom > 0 && value.zoom <= 5) {
            state.zoom = value.zoom;
        }
        if (Number.isFinite(value.scrollLeft) && value.scrollLeft >= 0) {
            state.scrollLeft = value.scrollLeft;
        }
        if (Number.isFinite(value.scrollTop) && value.scrollTop >= 0) {
            state.scrollTop = value.scrollTop;
        }

        return state;
    }

    function readFileStates() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (!saved) return {};

            const parsed = JSON.parse(saved);
            if (parsed?.version !== 1 || !parsed.files || typeof parsed.files !== 'object' || Array.isArray(parsed.files)) {
                console.warn('[presentation-state] Stored presentation state has an unsupported format.');
                return {};
            }
            return parsed.files;
        } catch (error) {
            console.warn('[presentation-state] Failed to read saved presentation state:', error);
            return {};
        }
    }

    function keyForIdentity(identity) {
        if (!identity || typeof identity !== 'object') return null;

        if (identity.type === 'standalone' && typeof identity.fileName === 'string' && identity.fileName.length > 0) {
            return JSON.stringify(['standalone', identity.fileName]);
        }

        if (identity.type === 'server' &&
            typeof identity.root === 'string' && identity.root.length > 0 &&
            typeof identity.path === 'string' && identity.path.length > 0) {
            const root = identity.root.replace(/[\\/]+$/, '');
            const path = identity.path.replace(/\\/g, '/');
            return JSON.stringify(['server', root, path]);
        }

        return null;
    }

    function persistCurrentState() {
        if (!currentKey) return;

        fileStates[currentKey] = copyState(currentState);
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                version: 1,
                files: fileStates
            }));
        } catch (error) {
            console.warn('[presentation-state] Failed to save presentation state:', error);
        }
    }

    function flushPendingPersist() {
        if (persistTimer !== null) {
            clearTimeout(persistTimer);
            persistTimer = null;
            persistCurrentState();
        }
    }

    function schedulePersist() {
        if (!currentKey) return;
        if (persistTimer !== null) clearTimeout(persistTimer);
        persistTimer = setTimeout(() => {
            persistTimer = null;
            persistCurrentState();
        }, 100);
    }

    EventBus.on(Events.FILE_LOADED, payload => {
        flushPendingPersist();
        currentKey = keyForIdentity(payload?.presentationIdentity);

        const hasSavedState = !!currentKey && Object.prototype.hasOwnProperty.call(fileStates, currentKey);
        currentState = hasSavedState
            ? normalizeState(fileStates[currentKey])
            : createDefaultState();

        EventBus.emit(Events.PRESENTATION_STATE_LOADED, {
            state: copyState(currentState),
            hasSavedState
        });
    });

    EventBus.on(Events.PRESENTATION_IDENTITY_CHANGED, ({ identity }) => {
        flushPendingPersist();
        currentKey = keyForIdentity(identity);
        persistCurrentState();
    });

    EventBus.on(Events.FILTER_TOGGLED, ({ type, checked }) => {
        if (!FILTER_NAMES.includes(type) || typeof checked !== 'boolean') return;
        currentState.filters[type] = checked;
        schedulePersist();
    });

    EventBus.on(Events.PRESENTATION_STATE_CHANGED, ({ zoom, scrollLeft, scrollTop }) => {
        if (Number.isFinite(zoom) && zoom > 0 && zoom <= 5) currentState.zoom = zoom;
        if (Number.isFinite(scrollLeft) && scrollLeft >= 0) currentState.scrollLeft = scrollLeft;
        if (Number.isFinite(scrollTop) && scrollTop >= 0) currentState.scrollTop = scrollTop;
        schedulePersist();
    });

    window.addEventListener('beforeunload', flushPendingPersist);
})();
