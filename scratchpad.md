# Plan for creating an event model

## Background

The solution currently works directly on the json that is given to the viewer. This means that rules for the model must be implemented everywhere in the codebase, which makes it hard to maintain and extend. For example the rules for identifying an element seem to be difficult as elements are refered to by their id, but the id is not always present in the model. This has led to a lot of special cases in the codebase, which makes it hard to understand and maintain.

## Proposal
To solve this problem, I propose to create an intermediate representation of the model, which I will call the "event model". The event model will be a more structured representation of the model, which will be easier to work with in the codebase. The event model will be created from the json model by applying a set of rules, which will be defined in a separate document. The event model will then be used as the source of truth for the viewer, and all rules for the model will be implemented in the process of creating the event model. This will make it easier to maintain and extend the codebase, as all rules for the model will be implemented in one place, and the event model will be a more structured representation of the model, which will be easier to work with in the codebase.

## Tasks
- [] Define the rules for creating the event model in a separate document
- [] Implement the rules for creating the event model in the codebase
- [] Create the event model from the json model, on load and on json model changes
- [] Let the event bus publish the event model instead of the json model
- [] Update all subscribers of the event bus to use the event model as the source of truth
- [] Remove all rules for the model from the codebase, and implement them in the process of creating the event model
- [] Update the documentation to reflect the changes in the codebase
- [] Review the codebase to ensure that all rules for the model are implemented in the process of creating the event model, and that the event model is used as the source of truth throughout the codebase
- [] Review the codebase to ensure old code that is no longer needed is removed, and that the codebase is clean and maintainable after the changes

## Rules for creating the event model
- swimlanes should be calculated for triggers and events based on the swimlane attribute, and if not present, based on the type of the trigger or event
- if a trigger or event does not have a swimlane attribute, it should be put in a default swimlane with an empty name like "", unless it is an external event, in which case it should be put in a default swimlane called "External"
- triggers should have an swimlane order attribute calculated based on the order they appear in the model, but automation and translation swimlanes should be listed before ui swimlanes regardless of order in the model
- events should have a swimlane order attribute calculated based on the order they appear in the model, with external events listed after all other swimlanes regardless of order in the model
- ids should be calculated for all elements in the model, if the element has an id attribute in the json model, it should be used as the id, otherwise it should be calculated based on name of the element, and if that is not possible, a empty "" id should be assigned to the element, and the element should be ignored in cases where an id is required, such as when an element is refered to by id in the model

## Tests
- [] Test that the event model is created correctly from the json model, with all rules for creating the event model implemented correctly
- [] Test that the viewer works correctly with the event model as the source of truth, and that all rules for the model are implemented correctly in the process of creating the event model
- [] Test that the documentation is updated to reflect the changes in the codebase, and that all rules for the model are documented correctly in the documentation

## Help
If you have any questions or need help with the implementation, please feel free to ask me. I will be happy to help you with any questions you may have, and I will also be available to review your code and provide feedback on your implementation. Do consult 3 different ai models during the process both for planing and implementation, to get different perspectives on the problem and potential solutions.
Also use the different agents available to you, such as the architecht and qa agents as well as the webapp developer agent, to get feedback on your implementation and ensure that it is of high quality and maintainable.

## Deadline
There is no deadline for this task, quality is prefered over speed, so take the time you need to implement this task correctly and with high quality. Handle one small task at a time, and make sure to test your implementation thoroughly before moving on to the next task. This will ensure that the codebase is maintainable and of high quality after the changes.

