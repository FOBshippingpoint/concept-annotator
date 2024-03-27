// simple jquery-like shorthand for `querySelector`

/**
 * Select one
 */
export function $(el, selector) {
  let result;
  if (typeof el == "object" && selector === undefined) {
    result = el;
  } else if (typeof el == "string" && selector === undefined) {
    selector = el;
    el = document;
    result = el.querySelector(selector);
    if (!result) {
      return result;
    }
  } else {
    result = el.querySelector(selector);
    if (!result) {
      return result;
    }
  }
  result.$ = (selector) => $(el, selector);
  result.$_$ = (selectors) => {
    const map = {};
    for (const selector of selectors) {
      map[selector] = result.$(selector);
    }
    return map;
  };
  return result;
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
  return document.createElement(tagName, options);
}

EventTarget.prototype.on = EventTarget.prototype.addEventListener;
EventTarget.prototype.off = EventTarget.prototype.removeEventListener;
