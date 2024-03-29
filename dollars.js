/**
 * @module dollars
 *
 * This module provides a simplified, jQuery-like syntax for DOM manipulation.
 * It offers functions for selecting elements, creating new elements, and attaching event listeners.
 */

function single1(selector) {
  return document.querySelector(selector);
}

function single2(element, selector) {
  return element.querySelector(selector);
}

function multiple1(selector) {
  return [...document.querySelectorAll(selector)].map(wrap);
}

function multiple2(element, selector) {
  return [...element.querySelectorAll(selector)].map(wrap);
}

function wrap(element) {
  if (element) {
    element.$ = (selector) => single2(element, selector);
    element.$$ = (selector) => multiple2(element, selector);
    return element;
  }
}

/**
 * Selects a single element from the DOM.
 *
 * @param {string|HTMLElement} el - Either a CSS selector string or an existing DOM element.
 * @param {string} [selector] - Optional selector string if `el` is an element.
 * @returns {HTMLElement|null} The selected element or null if not found.
 */
export function $(...args) {
  if (args.length == 1) {
    if (typeof args[0] == "string") {
      return wrap(single1(...args));
    } else {
      return wrap(...args);
    }
  } else if (args.length == 2) {
    return wrap(single2(...args));
  }
}

/**
 * Selects multiple elements from the DOM and returns them as an array.
 *
 * @param {string|HTMLElement} el - Either a CSS selector string or an existing DOM element (ignored).
 * @param {string} selector - The selector string for the elements to select.
 * @returns {HTMLElement[]} An array of the selected elements.
 */
export function $$(...args) {
  if (args.length == 1 && typeof args[0] == "string") {
    return multiple1(...args);
  } else if (args.length == 2) {
    return multiple2(...args);
  }
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
