/**
 * Test data factory for generating event model structures
 */

/**
 * Create a minimal valid event model
 * @returns {Object}
 */
export function createMinimalEventModel() {
  return {
    title: "Test Model",
    slices: [
      {
        id: "1",
        name: "Test Slice",
        trigger: {
          role: "User",
          type: "input-ui",
          buttons: ["Test"]
        },
        command: {
          name: "Test Command",
          properties: [
            { name: "Id", type: "Guid" }
          ],
          events: [
            {
              name: "Test Event",
              properties: [{ name: "Id", type: "Guid" }]
            }
          ]
        }
      }
    ]
  };
}

/**
 * Create event model with multiple slices
 * @param {number} count - Number of slices
 * @returns {Object}
 */
export function createMultiSliceModel(count = 3) {
  const slices = [];
  
  for (let i = 0; i < count; i++) {
    slices.push({
      id: String(i + 1),
      name: `Slice ${i + 1}`,
      trigger: {
        role: "User",
        type: "input-ui",
        buttons: [`Button ${i + 1}`]
      },
      command: {
        name: `Command ${i + 1}`,
        properties: [
          { name: "Id", type: "Guid" }
        ],
        events: [
          {
            name: `Event ${i + 1}`,
            properties: [{ name: "Id", type: "Guid" }]
          }
        ]
      }
    });
  }
  
  return {
    title: "Multi-Slice Model",
    slices
  };
}

/**
 * Create slice with trigger
 * @param {Object} options
 * @returns {Object}
 */
export function createSliceWithTrigger(options = {}) {
  return {
    id: options.id || "1",
    name: options.name || "Test Slice",
    trigger: {
      role: options.role || "User",
      type: options.triggerType || "input-ui",
      buttons: options.buttons || ["Test"]
    }
  };
}

/**
 * Create slice with command
 * @param {Object} options
 * @returns {Object}
 */
export function createSliceWithCommand(options = {}) {
  return {
    id: options.id || "1",
    name: options.name || "Test Slice",
    command: {
      name: options.commandName || "Test Command",
      properties: options.properties || [
        { name: "Id", type: "Guid" }
      ],
      events: options.events || [
        {
          name: "Test Event",
          properties: [{ name: "Id", type: "Guid" }]
        }
      ]
    }
  };
}

/**
 * Create slice with view
 * @param {Object} options
 * @returns {Object}
 */
export function createSliceWithView(options = {}) {
  return {
    id: options.id || "1",
    name: options.name || "Test Slice",
    view: {
      name: options.viewName || "Test View",
      events: options.events || ["Test Event"],
      properties: options.properties || [
        { name: "Id", type: "Guid" }
      ]
    }
  };
}

/**
 * Create slice with tests
 * @param {Object} options
 * @returns {Object}
 */
export function createSliceWithTests(options = {}) {
  return {
    id: options.id || "1",
    name: options.name || "Test Slice",
    command: {
      name: "Test Command",
      properties: [{ name: "Id", type: "Guid" }],
      events: [{ name: "Test Event", properties: [] }]
    },
    tests: options.tests || [
      {
        given: ["Initial state"],
        when: "Test Command",
        then: ["Test Event"]
      }
    ]
  };
}

/**
 * Create slice with border
 * @param {string} color
 * @returns {Object}
 */
export function createSliceWithBorder(color = "#4CBB17") {
  return {
    id: "1",
    name: "Bordered Slice",
    border: color,
    trigger: {
      role: "User",
      type: "input-ui",
      buttons: ["Test"]
    }
  };
}

/**
 * Create property object
 * @param {string} name
 * @param {string} type
 * @returns {Object}
 */
export function createProperty(name, type = "string") {
  return { name, type };
}

/**
 * Create event object
 * @param {string} name
 * @param {Array} properties
 * @returns {Object}
 */
export function createEvent(name, properties = []) {
  return {
    name,
    properties: properties.length > 0 ? properties : [{ name: "Id", type: "Guid" }]
  };
}

/**
 * Create test case object
 * @param {Array} given
 * @param {string} when
 * @param {Array} then
 * @returns {Object}
 */
export function createTestCase(given, when, then) {
  return { given, when, then };
}
