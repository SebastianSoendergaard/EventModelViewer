        const showSlicesCheckbox = document.getElementById('showSlices');
        const showTestsCheckbox = document.getElementById('showTests');
        const showTypesCheckbox = document.getElementById('showTypes');
        const showSwimlanesCheckbox = document.getElementById('showSwimlanes');

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
