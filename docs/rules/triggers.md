# Rules for rendering triggers in the diagram

## General rules for triggers
1. triggers should be redered differently based on their type to visually distinguish them from each other.
2. the trigger should be placed in the trigger section of the slice to clearly indicate its role in the diagram
3. the trigger should point to the command in the same slice that it triggers to clearly indicate the relationship between the trigger and the command
4. if a trigger depends on a view, the view should point to the trigger to clearly indicate the relationship between the view and the trigger
5. if a trigger depends on multiple views, all views should point to the trigger to clearly indicate the relationship between the views and the trigger

## Rules for ui triggers
1. ui triggers are triggers where the type start with "ui" or has no type defined, and are meant for manual user input or reporting.
2. ui triggers should be rendered as dialogs or windows to visually show this is for manual user input/reporting.
3. the name of the trigger should be displayed just above the trigger to clearly identify the trigger
4. the properties of the trigger should be displayed inside the trigger to provide additional information about the trigger
5. the color of the trigger should be green to visually distinguish it from other elements in the diagram
6. if the trigger has buttons defined, the buttons should be displayed inside the trigger to visually indicate that the trigger is interactive and requires user input. The buttons should be displayed at the bottom of the trigger to visually separate them from the properties of the trigger and to improve readability.
7. multiple ui triggers should be supported, which is given by its name.

### Input triggers
1. input triggers are ui triggers where the type is "ui-input" and "ui-input-disabled" and are meant for user input.
2. input triggers should be rendered with all properties listed in label/input pairs, where the label is the name of the property and the value is the value of the property. The value should be rendered as an input field to visually indicate that the trigger is meant for user input and to provide a clear way for users to interact with the trigger. 
3. The input fields should be displayed at the top of the trigger to visually separate them from the buttons of the trigger and to improve readability.
4. "ui-input" triggers should be rendered with the input fields enabled.
5. "ui-input-disabled" triggers should be rendered with the input fields disabled.

### Table triggers
1. table triggers are ui triggers where the type is "ui-table" and are meant for displaying tabular data.
2. table triggers should be rendered with all properties listed with label in first table row, where the label is the name of the property. 

### Chart triggers
1. chart triggers are ui triggers where the type is "ui-chart-line", "ui-chart-column" or "ui-chart-pie" and are meant for displaying data in a chart format.
2. "ui-chart-line" triggers should be rendered as line charts with hardcoded example data.
3. "ui-chart-column" triggers should be rendered as column charts with hardcoded example data.
4. "ui-chart-pie" triggers should be rendered as pie charts with hardcoded example data.

## Rules for automation and translation triggers
1. automation and translation triggers should be rendered as a gear icon to visually distinguish them from ui
triggers. 
2. the name of the trigger should be displayed just above the gear icon to clearly identify the trigger
3. the gear icon should be colored black to visually distinguish it from ui triggers
 
