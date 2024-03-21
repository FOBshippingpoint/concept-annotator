// simple jquery-like shorthand for `querySelector`

/**
 * Select one
 */
export function $(el, selector) {
	if (typeof el == "string" && selector === undefined) {
		selector = el;
		el = document;
	}
	return el.querySelector(selector);
}

/**
 * Select many as array
 */
export function $$(el, selector) {
	if (typeof el == "string" && selector === undefined) {
		selector = el;
		el = document;
	}
	return [...el.querySelectorAll(selector)];
}

export function $$$(tagName, options) {
  return document.createElement(tagName, options)
}

EventTarget.prototype.on = EventTarget.prototype.addEventListener;
