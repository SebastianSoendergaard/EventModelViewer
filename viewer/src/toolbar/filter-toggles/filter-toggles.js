        const showSlicesCheckbox = document.getElementById('showSlices');
        const showTestsCheckbox = document.getElementById('showTests');
        const showTypesCheckbox = document.getElementById('showTypes');
        const showSwimlanesCheckbox = document.getElementById('showSwimlanes');

        showSlicesCheckbox.addEventListener('change', () => {
            EventBus.emit(Events.FILTER_TOGGLED, { type: 'slices', checked: showSlicesCheckbox.checked });
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
