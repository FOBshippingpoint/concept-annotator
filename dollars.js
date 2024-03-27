/**
 * @module dollars
 *
 * This module provides a simplified, jQuery-like syntax for DOM manipulation.
 * It offers functions for selecting elements, creating new elements, and attaching event listeners.
 */

/**
 * Selects a single element from the DOM.
 *
 * @param {string|HTMLElement} el - Either a CSS selector string or an existing DOM element.
 * @param {string} [selector] - Optional selector string if `el` is an element.
 * @returns {HTMLElement|null} The selected element or null if not found.
 */
export function $(el, selector) {
  let result;

  // If `el` is already an element and no selector is provided
  if (typeof el === "object" && selector === undefined) {
    result = el;
  }
  // If `el` is a CSS selector string and no selector is provided
  else if (typeof el === "string" && selector === undefined) {
    selector = el;
    el = document;
    result = el.querySelector(selector);
    if (!result) {
      return null;
    }
  }
  // If both `el` and selector are provided
  else {
    result = el.querySelector(selector);
    if (!result) {
      return null;
    }
  }

  /**
   * Chains another `$` call within the current context.
   *
   * @param {string} selector - The selector string for the nested element.
   * @returns {HTMLElement|null} The selected element within the current context.
   */
  result.$ = (childSelector) => $(result, childSelector);

  /**
   * Selects multiple elements as an array using `querySelectorAll`.
   *
   * @param {string} selector - The selector string for the elements to select.
   * @returns {HTMLElement[]} An array of the selected elements.
   */
  result.$$ = (childSelector) => $$(result, childSelector);

  return result;
}

/**
 * Selects multiple elements from the DOM and returns them as an array.
 *
 * @param {string|HTMLElement} el - Either a CSS selector string or an existing DOM element (ignored).
 * @param {string} selector - The selector string for the elements to select.
 * @returns {HTMLElement[]} An array of the selected elements.
 */
export function $$(el, selector) {
  if (typeof el === "string") {
    selector = el;
    el = document;
  }

  return [...el.querySelectorAll(selector)];
}

/**
 * Creates a new HTML element with the specified tag name and optional attributes.
 *
 * @param {string} tagName - The tag name of the element to create (e.g., "div", "span", "p").
 * @param {Object} [options] - Optional object containing attributes for the element.
 * @returns {HTMLElement} The newly created element.
 */
export function $$$(tagName, options = {}) {
  return document.createElement(tagName, options);
}

EventTarget.prototype.on = EventTarget.prototype.addEventListener;
EventTarget.prototype.off = EventTarget.prototype.removeEventListener;
