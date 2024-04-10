/**
 * @module dollars
 *
 * This module provides a simplified, jQuery-like syntax for DOM manipulation.
 * It offers functions for selecting elements, creating new elements, and
 * attaching event listeners.
 */

/**
 * Alias for Document.querySelector
 */
function single1(selector) {
  return document.querySelector(selector);
}

/**
 * Alias for HTMLElement.querySelector
 */
function single2(element, selector) {
  return element.querySelector(selector);
}

/**
 * Alias for Document.querySelectorAll
 * @returns {HTMLElement[]}
 */
function multiple1(selector) {
  return [...document.querySelectorAll(selector)].map(wrap);
}

/**
 * Alias for HTMLElement.querySelectorAll
 * @returns {HTMLElement[]}
 */
function multiple2(element, selector) {
  return [...element.querySelectorAll(selector)].map(wrap);
}

/**
 * Add $ and $$ for selecting element(s) in this element's scope.
 * @param {HTMLElement} element
 */
function wrap(element) {
  if (element) {
    Object.assign(element, {
      $: (selector) => single2(element, selector),
      $$: (selector) => multiple2(element, selector),
    });
  }

  return element;
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
  let arr;
  if (args.length == 1 && typeof args[0] == "string") {
    arr = multiple1(...args);
  } else if (args.length == 2) {
    arr = multiple2(...args);
  }
  arr.do = (func) => arr.forEach(func);
  arr.kill = () => arr.forEach((el) => el.remove());
  return arr;
}

/**
 * Creates a new HTML element with the specified tag name and optional attributes.
 */
export function $$$(...args) {
  return document.createElement(...args);
}

EventTarget.prototype.on = EventTarget.prototype.addEventListener;
EventTarget.prototype.off = EventTarget.prototype.removeEventListener;
