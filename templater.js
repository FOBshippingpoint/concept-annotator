import { $ } from "./dollars.js";

export function plug(el, slotName, children) {
  if (arguments.length == 2) {
    el = document;
    slotName = arguments[0];
    children = arguments[1];
  }
  if (typeof children[Symbol.iterator] == "function") {
    $(el, `[name="${slotName}"]`).append(...children);
  } else {
    $(el, `[name="${slotName}"]`).append(children);
  }
}

export function cloneTemplate(selector) {
  const result = $($("template" + selector).content.cloneNode(true));
  result.unbox = () => {
    const map = {};
    result.$$("[class]").forEach((el) => {
      for (const c of el.classList) {
        map[c] = el;
      }
    });
    return map;
  };
  return result;
}
