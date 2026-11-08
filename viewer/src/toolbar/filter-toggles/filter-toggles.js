        const showBordersCheckbox = document.getElementById('showBorders');
        const showBackgroundCheckbox = document.getElementById('showBackground');
        const showTestsCheckbox = document.getElementById('showTests');
        const showTypesCheckbox = document.getElementById('showTypes');
        const showSwimlanesCheckbox = document.getElementById('showSwimlanes');

        EventBus.on(Events.PRESENTATION_STATE_LOADED, ({ state }) => {
            showBordersCheckbox.checked = state.filters.borders;
            showBackgroundCheckbox.checked = state.filters.background;
            showTestsCheckbox.checked = state.filters.tests;
            showTypesCheckbox.checked = state.filters.types;
            showSwimlanesCheckbox.checked = state.filters.swimlanes;
        });

        showBordersCheckbox.addEventListener('change', () => {
            EventBus.emit(Events.FILTER_TOGGLED, { type: 'borders', checked: showBordersCheckbox.checked });
        });

        showBackgroundCheckbox.addEventListener('change', () => {
            EventBus.emit(Events.FILTER_TOGGLED, { type: 'background', checked: showBackgroundCheckbox.checked });
        });

        showTestsCheckbox.addEventListener('change', () => {
            EventBus.emit(Events.FILTER_TOGGLED, { type: 'tests', checked: showTestsCheckbox.checked });
        });

        showTypesCheckbox.addEventListener('change', () => {
            EventBus.emit(Events.FILTER_TOGGLED, { type: 'types', checked: showTypesCheckbox.checked });
        });

        showSwimlanesCheckbox.addEventListener('change', () => {
            EventBus.emit(Events.FILTER_TOGGLED, { type: 'swimlanes', checked: showSwimlanesCheckbox.checked });
        });
