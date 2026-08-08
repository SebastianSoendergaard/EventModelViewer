# Rules for general layout of the diagram

## General layout rules
1. The diagram is divided into vertical sections called slices.
2. The diagram is divided into horizontal sections called swimlanes.
3. The name of the slice is displayed at the top of the slice.
4. The name of the swimlane is displayed at the left of the swimlane.

## Slices
1. Each slice is represented as a vertical section of the diagram, surrounded by a border. 
2. The border color can be set in the model. If no color is defined the border should be white, thus invisible.
3. The slice is devided into 5 sections for; name of the slice, triggers, commands and views, events, and tests, in that order. 
4. If an element for a section is not present, the section is still rendered. 
5. The different sections must be aligned between slices, meaning all trigger sections should be vertically aligned, all command and view sections should be vertically aligned, and all event sections should be vertically aligned. The test section is always at the bottom of the slice and should be aligned between slices as well. 
6. The elements within a section is vertically aligned to the top of the section.
7. The elements within a slice are centered horizontally within the slice.
8. The elements within a slice are ordered from top to bottom in the following order: name of slice, triggers, commands and views, events, and tests.
9. If a slice contains multiple elements of the same type (same section), the elements should be presented side by side. 
10. If a slice contains both commands and views, the commands should be placed to the right of the view to improve readability.
11. If a slice contains multiple events, the events should be placed side by side in the order they appear in the model.

## Triggers
1. A trigger can be presented as either a Window/view with user interaction or as a gear for automation and translation triggers.
2. The type of the trigger is defined by the `type` property of the trigger in the model. If no type is defined, it should be treated as a ui trigger.
3. The trigger should be placed in the trigger section of the slice.
4. The trigger should point to the command in the same slice that it triggers.
5. If a trigger depends on a view, the view should point to the trigger.
6. If a trigger depends on multiple views, all views should point to the trigger.

## Commands and views
1. A command is presented as a blue rectangle with the name of the command and its properties.
2. A view is presented as a green rectangle with the name of the view and its properties.
3. Commands and views should be placed in the command and view section of the slice.
4. When a command points to an event, the event should be in the same slice as the command.
5. If both a view and a command is present in the same slice, the command should be placed to the right of the view to improve readability.
 
## Events
1. An event is presented as a orange rectangle with the name of the event and its properties.
2. Events should be placed in the event section of the slice.
3. When a command points to an event, the event should be in the same slice as the command.
4. If an event points to a view that is defined in the model before the event, the arrow should be dashed and should exit on the side of the event.
5. If an event points to a view that is defined in the model after the event, the arrow should be solid and should exit from the top of the event.
6. If an event is marked as external, it should be yellow instead of orange.
7. If multiple events in the same slice, the events should be presented side by side in the order they appear in the model.

## Tests
1. given-when-then test cases should be placed in the test section of the slice.
2. Each test case should be presented as a rectangle with the name of the test case and its given, when, then properties.
3. The given property should list the preconditional events or views for the test case, including their properties and values.
4. The when property should list the command for the test case, including its properties and values. 
5. The then property should list the expected events or views for the test case, including their properties and values.
6. If multiple test cases in the same slice, the test cases should be presented below each other in the order they appear in the model.

## Swimlanes
1. Swimlanes are horizontal sections of the diagram that group elements by their swimlane attribute in the model.
2. The name of the swimlane is displayed at the left of the swimlane. If the swimlane has no name, no name is displayed.
3. The default swimlines are: trigger swimlane, command and view swimlane, event swimlane, and test swimlane. The trigger swimlanes are listed first, then the command and view swimlane, then the event swimlanes, and finally the test swimlane.
4. The trigger and event swimlines can be divided into multiple swimlines based on the swimlane attribute of the triggers and events in the model. 
Read more about the rules for swimlanes in the [swimlane rules](./swimlanes.md) document.

## Arrows
1. Triggers can point to commands, and depend on views.
2. Commands can point to events.
3. Views can point to triggers, and depend on events.
4. Events can point to views.
5. Arrows should be curved unless elements are aligned in a straight line (horizontally or vertically).
6. Arrows should be colored black by default.
7. If an arrow is clicked within the diagram, it should be highlighted by changing its color to blue and making it wider, including the arrow head.
8. If user clicks again the arrow, it should be unhighlighted by changing its color back to black and restoring its original width, including the arrow head.
9. If an arrow is hovered, it should be highlighted by changing its color to blue and making it wider, including the arrow head.
10. If an arrow is hovered and the user clicks on it, the click should be registered as a click on the arrow and not on the element behind it.
Read more about the rules for arrows in the [arrow rules](./arrows.md) document.
