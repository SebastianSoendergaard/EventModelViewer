/**
 * Test helper utilities for EventModelViewer tests
 */

/**
 * Load and parse HTML file for testing
 * @param {string} filePath - Path to HTML file
 * @returns {Promise<Window>} - Window object with loaded DOM
 */
export async function loadHTML(filePath) {
  const fs = await import('fs/promises');
  const { Window } = await import('happy-dom');
  
  const html = await fs.readFile(filePath, 'utf-8');
  const window = new Window();
  window.document.write(html);
  
  // Wait for scripts to execute
  await new Promise(resolve => setTimeout(resolve, 100));
  
  return window;
}

/**
 * Create a mock FileList for file upload testing
 * @param {Array<{name: string, content: string, type: string}>} files
 * @returns {FileList} - Mock FileList
 */
export function createMockFileList(files) {
  const fileList = files.map(({ name, content, type }) => {
    const blob = new Blob([content], { type });
    blob.name = name;
    return blob;
  });
  
  // Make it look like FileList
  fileList.item = function(index) {
    return this[index] || null;
  };
  
  return fileList;
}

/**
 * Wait for debounced function to execute
 * @param {number} ms - Milliseconds to wait
 */
export function waitForDebounce(ms = 1100) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Query selector with error handling
 * @param {Document} document
 * @param {string} selector
 * @returns {Element}
 */
export function querySelector(document, selector) {
  const element = document.querySelector(selector);
  if (!element) {
    throw new Error(`Element not found: ${selector}`);
  }
  return element;
}

/**
 * Query all elements with validation
 * @param {Document} document
 * @param {string} selector
 * @returns {NodeList}
 */
export function querySelectorAll(document, selector) {
  return document.querySelectorAll(selector);
}

/**
 * Simulate file input change event
 * @param {HTMLInputElement} input
 * @param {FileList} files
 */
export function simulateFileUpload(input, files) {
  Object.defineProperty(input, 'files', {
    value: files,
    writable: false
  });
  
  const event = new Event('change', { bubbles: true });
  input.dispatchEvent(event);
}

/**
 * Extract text content from element
 * @param {Element} element
 * @returns {string}
 */
export function getTextContent(element) {
  return element.textContent.trim();
}

/**
 * Check if element has class
 * @param {Element} element
 * @param {string} className
 * @returns {boolean}
 */
export function hasClass(element, className) {
  return element.classList.contains(className);
}

/**
 * Get computed style property
 * @param {Element} element
 * @param {string} property
 * @returns {string}
 */
export function getStyle(element, property) {
  return window.getComputedStyle(element)[property];
}

/**
 * Trigger click event
 * @param {Element} element
 */
export function click(element) {
  const event = new MouseEvent('click', { bubbles: true, cancelable: true });
  element.dispatchEvent(event);
}

/**
 * Wait for element to appear
 * @param {Document} document
 * @param {string} selector
 * @param {number} timeout
 * @returns {Promise<Element>}
 */
export async function waitForElement(document, selector, timeout = 5000) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    const element = document.querySelector(selector);
    if (element) return element;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  throw new Error(`Element not found within ${timeout}ms: ${selector}`);
}
