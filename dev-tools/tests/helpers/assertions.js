/**
 * Custom assertions for EventModelViewer tests
 */

/**
 * Assert element exists in document
 * @param {Document} document
 * @param {string} selector
 * @param {string} message
 */
export function assertElementExists(document, selector, message) {
  const element = document.querySelector(selector);
  if (!element) {
    throw new Error(message || `Element not found: ${selector}`);
  }
}

/**
 * Assert element does not exist
 * @param {Document} document
 * @param {string} selector
 * @param {string} message
 */
export function assertElementNotExists(document, selector, message) {
  const element = document.querySelector(selector);
  if (element) {
    throw new Error(message || `Element should not exist: ${selector}`);
  }
}

/**
 * Assert element has text content
 * @param {Element} element
 * @param {string} expectedText
 * @param {string} message
 */
export function assertTextContent(element, expectedText, message) {
  const actual = element.textContent.trim();
  if (actual !== expectedText) {
    throw new Error(
      message || `Expected text "${expectedText}" but got "${actual}"`
    );
  }
}

/**
 * Assert element has class
 * @param {Element} element
 * @param {string} className
 * @param {string} message
 */
export function assertHasClass(element, className, message) {
  if (!element.classList.contains(className)) {
    throw new Error(
      message || `Element does not have class: ${className}`
    );
  }
}

/**
 * Assert element count
 * @param {Document} document
 * @param {string} selector
 * @param {number} expectedCount
 * @param {string} message
 */
export function assertElementCount(document, selector, expectedCount, message) {
  const elements = document.querySelectorAll(selector);
  if (elements.length !== expectedCount) {
    throw new Error(
      message || `Expected ${expectedCount} elements but found ${elements.length}: ${selector}`
    );
  }
}

/**
 * Assert HTML contains substring
 * @param {string} html
 * @param {string} substring
 * @param {string} message
 */
export function assertHTMLContains(html, substring, message) {
  if (!html.includes(substring)) {
    throw new Error(
      message || `HTML does not contain: ${substring}`
    );
  }
}

/**
 * Assert HTML does not contain substring
 * @param {string} html
 * @param {string} substring
 * @param {string} message
 */
export function assertHTMLNotContains(html, substring, message) {
  if (html.includes(substring)) {
    throw new Error(
      message || `HTML should not contain: ${substring}`
    );
  }
}

/**
 * Assert element is visible
 * @param {Element} element
 * @param {string} message
 */
export function assertVisible(element, message) {
  const style = window.getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden') {
    throw new Error(
      message || 'Element is not visible'
    );
  }
}

/**
 * Assert element is hidden
 * @param {Element} element
 * @param {string} message
 */
export function assertHidden(element, message) {
  const style = window.getComputedStyle(element);
  if (style.display !== 'none' && style.visibility !== 'hidden') {
    throw new Error(
      message || 'Element is not hidden'
    );
  }
}

/**
 * Assert array contains value
 * @param {Array} array
 * @param {*} value
 * @param {string} message
 */
export function assertContains(array, value, message) {
  if (!array.includes(value)) {
    throw new Error(
      message || `Array does not contain value: ${value}`
    );
  }
}

/**
 * Assert diagram structure is valid
 * @param {Document} document
 */
export function assertValidDiagram(document) {
  assertElementExists(document, '.event-model-diagram', 'Diagram not rendered');
  assertElementExists(document, '.slice', 'No slices found in diagram');
}

/**
 * Assert slice has expected structure
 * @param {Element} slice
 */
export function assertValidSlice(slice) {
  if (!slice.classList.contains('slice')) {
    throw new Error('Element is not a valid slice');
  }
  
  const hasContent = 
    slice.querySelector('.element.trigger') ||
    slice.querySelector('.element.command') ||
    slice.querySelector('.element.view');
    
  if (!hasContent) {
    throw new Error('Slice has no content elements');
  }
}
