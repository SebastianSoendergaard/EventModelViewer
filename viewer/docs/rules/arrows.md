# Rules for diagram arrows

## General arrow rules
1. arrows should be curved unless elements are aligned in a straight line (horizontally or vertically) to improve readability
2. arrows should be colored black by default
3. if an arrow is clicked within the diagram, it should be highlighted by changing its color to blue and making it wider
4. if user clicks again the arrow should be unhighlighted by changing its color back to black and restoring its original width
5. if an arrow is hovered, it should be highlighted by changing its color to blue and making it wider
6. if an arrow is hovered and the user clicks on it, the click should be registered as a click on the arrow and not on the element behind it
7. when an arrow is highlighted, the arrow head should also be highlighted in blue and not remain black
8. an arrowhead tip should touch its target element's edge; the line should end at the arrowhead base outside the element, never continue through the element

## Rules for triggers
1. triggers can point to commands and reference views
2. commands should be in the same slice as their trigger
3. every trigger-to-view arrow follows the trigger's view reference and points to the selected view, regardless of trigger type; it indicates the reference, not causal order
4. triggers can reference multiple views
5. a referenced view is identified by its id; if id is not defined, the name is used as id
6. if multiple views have the same id, use the view defined in the same slice as the trigger; otherwise use the nearest preceding view
7. a same-slice trigger-to-view arrow should start at the bottom of the trigger and end at the top of the view
8. a cross-slice trigger-to-view arrow should leave the side of the trigger and enter the top of the view

## Rules for commands
1. commands can only point to events
2. events should be in the same slice as their command  
3. a command can point to multiple events
4. an event is identified by its id, if id is not defined the name is used as id
5. if multiple events with the same id, point from the command to the event that is
defined in the model immediately after the command
6. arrows should enter and exit the commands in the top and bottom to improve readability

## Rules for views
1. views can be referenced by triggers
2. a view can be referenced by multiple triggers
3. the relationship between views and triggers is defined by the trigger
4. views can depend on events, meaning the given event should point to the view
5. views can depend on multiple events
6. a dependend event is identified by its id, if id is not defined the name is used as id
7. if multiple events with the same id, point to the view from the event that is defined in the model immediately before the view
8. arrows should enter and exit the views in the top and bottom to improve readability

## Rules for events
1. events can only point to views
2. commands can point to events
3. an event can point to multiple views
4. the relationship between events and views is defined by the view
5. arrows should enter and exit in the top of the event to improve readability
6. if an event points to a view in the past, meaning the view is defined in the model before the event, the arrow should be dashed
7. if an event points to a view in the past, the arrow should exit on the side to improve readability
9. if an event points to a view within the same slice, the arrow should exit the event from the top to improve readability

## Important note on element references
- Elements can be referenced by their id. If id is not defined, the name is used as id.
- Multiple elements can have the same id. In this case, the diagram should point to the element that is defined in the model immediately before or after the referencing element depending on type. 
- Elements can reference multiple elements. In this case the names of the referenced elements can be the same but the id may differ. So always used the id for reference!

Example: If a command points to an event with the same id as another event, it should point to the event that is defined immediately after the command in the model. 
Example: A command may point to two events with the same name, but their id's are different so command can still point to both events without any confusion.

This is important to keep in mind when defining the model and the relationships between elements, as it can lead to unexpected behavior if not handled correctly.
