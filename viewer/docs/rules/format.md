# EMJ/EMY format specification

Field-by-field reference for the `.emj` (JSON) / `.emy` (YAML) event model schema — same structure for both encodings. This is the same specification shown in-app via the **?** help overlay.

```
title: the title of the work flow
slices: list of slices on the diagram
  slice: a single slice
    name: name of the slice
    border: color to mark a slice and its state (e.g. black=>draft, blue=>todo, red=>in progress, green=>done)
    trigger: something that triggers actions in the flow 
      name: name of the trigger that initiates an action
      type: type of the trigger e.g. ui or automation, see all options below
      properties: list of properties for the trigger
        name: name of a trigger property
        value: value of a trigger property
      swimlane: name of the swimlane (role/person/system) the trigger belongs to, if not defined it will be put in a default swimlane 
      buttons: list of buttons to show on ui trigger
      views: list of dependencies of views (id of view if defined, else name of view) 
    command: a command
      name: name of the command
      id: unique id of a command, can be used for reference on name clashes, if not defined fallback to name property
      properties: list of properties for the command
        name: name of a command property
        type: type of a command property
      events: list of references to events (id of event if defined, else name of event) 
    view: a view
      name: name of the view
      id: unique id of a view, can be used for reference on name clashes, if not defined fallback to name property
      properties: list of properties for the view
        name: name of a view property
        type: type of a view property
      events: list of dependencies of events (id of event if defined, else name of event) 
    events: list of events 
      name: name of an event
      id: unique id of an event, can be used for reference on name clashes, if not defined fallback to name property
      swimlane: name of the swimlane (aggregate/module/system) the event belongs to, if not defined it will be put in a default swimlane
      external: true if the event is external
      properties: list of properties for the event
        name: name of an event property
        type: type of an event property
    tests: list of test cases for the slice
      name: name of the test case
      given: list of preconditional events
        name: name of the event
        properties: list of properties for the event
          name: name of an event property
          value: value of an event property
      when: the action 
        name: name of the command
        properties: list of properties for the command
          name: name of a command property
          value: value of a command property
      then: list of resulting events or views
        name: name of the event or view
        properties: list of properties for the event or view
          name: name of an event or view property
          value: value of an event or view property

trigger types:
  ui: shows properties as plain label/value rows
  ui-input: properties as label + enabled text input field
  ui-input-disabled: same as ui-input but disabled input (read-only appearance)
  ui-table: displays tabular data with properties as column headers
  ui-chart-line: displays a hardcoded example line chart (SVG)
  ui-chart-column: displays a hardcoded example column/bar chart (SVG)
  ui-chart-pie: displays a hardcoded example pie chart (SVG, 3 slices)
  automation: represents an automated process trigger (no user interaction)
  translation: represents a trigger that translates/relays events between systems (Translation Pattern)

```
