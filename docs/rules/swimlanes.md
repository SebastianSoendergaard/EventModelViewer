## Rules for trigger swimlanes
1. triggers should be devided into swimlanes depending on the swimlane attribute of the trigger.
2. automation and translation swimlanes should appear before ui swimlanes
3. swimlanes should be listed in the order they appear in the model, but automation and translation swimlanes should be listed before ui swimlanes regardless of order in the model
4. if a trigger does not have a swimlane attribute, it should be put in a default swimlane without any name

## Rules for command and view swimlanes
1. commands and views should be placed in the same swimlane
2. the swimlane is not named
3. the swimlane is placed after all trigger swimlanes
4. the swimlane is placed before all event swimlanes
5. the swimlane is vertically higher than the trigger and event swimlanes to improve readability
6. elements are centered vertically in the swimlane

## Rules for event swimlanes
1. events should be devided into swimlanes depending on the swimlane attribute of the event.
2. swimlanes should be listed in the order they appear in the model
3. if an event does not have a swimlane attribute, it should be put in a default swimlane without any name
4. if an event is marked external and does not have a swimlane attribute, it should be put in a default swimlane called "External"
5. swimlanes with external events should be listed after all other swimlanes regardless of order in the model

## Rules for the test swimlane
1. tests should be placed in a separate swimlane at the bottom of the diagram
2. the swimlane is not named
3. the swimlane is placed after all trigger, command, view and event swimlanes
4. elements are located at the vertical top of the swimlane
