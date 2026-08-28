        const EventBus = {
            _listeners: {},
            on(event, cb) {
                if (!this._listeners[event]) this._listeners[event] = [];
                this._listeners[event].push(cb);
            },
            off(event, cb) {
                if (this._listeners[event]) {
                    this._listeners[event] = this._listeners[event].filter(f => f !== cb);
                }
            },
            emit(event, data) {
                (this._listeners[event] || []).forEach(cb => cb(data));
            }
        };

        const Events = {
            // A file was loaded (from disk, localStorage) or a new document was created.
            // Payload: { json, fileName, format }  — json is null for new/cleared
            // document; format ('json'|'yaml', see Codec) is set explicitly when a
            // document has no fileName yet (e.g. a brand-new document), otherwise it's
            // inferred from fileName's extension (.emj/.emy)
            FILE_LOADED:    'file:loaded',

            // JSON content was changed by a user edit or undo/redo.
            // Payload: { json, source }  — source: 'code' | 'tree' | 'history' | 'addslice'
            JSON_CHANGED:   'json:changed',

            // A filter checkbox was toggled.
            // Payload: { type, checked }  — type: 'slices' | 'tests' | 'types' | 'swimlanes'
            FILTER_TOGGLED: 'filter:toggled',

            // The editor panel was resized; ACE editor should call .resize().
            // Payload: {}
            EDITOR_RESIZED: 'editor:resized',

            // The application is ready; modules should self-initialize.
            // Payload: {}
            APP_INIT:       'app:init',

            // Request the tree view to re-render its current state (e.g. on tab switch).
            // Payload: {}
            TREE_SYNC:      'tree:sync',

            // Request the code editor to sync its content with current JSON (e.g. on tab switch).
            // Payload: { json }
            CODE_SYNC:      'code:sync',

            // The event model has been built from raw JSON (on FILE_LOADED or JSON_CHANGED).
            // Payload: { model }  — fully-enriched event model object, or { model: null } for cleared document
            MODEL_CHANGED:  'model:changed',

            // The server's active root folder (scanned for .emj/.emy files) changed.
            // Payload: { root }  — absolute path of the new root folder
            ROOT_CHANGED:   'root:changed',
        };
