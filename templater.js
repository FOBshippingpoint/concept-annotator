import { $, $$ } from "./dollars.js";

function recursiveFindTemplate(el, selector) {
  const target = $(el, "template" + selector);
  if (target) {
    return target;
  }

  const nested = $$(el, "template");
  for (const t of nested) {
    const result = recursiveFindTemplate(t.content, selector);
    if (result) {
      return result;
    }
  }
}

function packForChildTemplate(parentTemplate, childTemplate) {
  childTemplate = craft(childTemplate, false);
  childTemplate.plug = (kids) => {
    childTemplate.replaceWith(
      ...(kids?.[Symbol.iterator] ? [...kids] : [kids]),
    );
  };
  childTemplate.plugBy = (factory) =>
    childTemplate.plug(
      factory(function clone() {
        return craft(childTemplate, true);
      }),
    );

  for (const c of childTemplate.classList) {
    parentTemplate["$" + c] = childTemplate;
  }
  return parentTemplate;
}

function craft(template, clone) {
  if (clone) {
    template = template.content.cloneNode(true);
  }
  template = pack($(template));
  template.$$("template").forEach((child) => {
    packForChildTemplate(template, child);
  });
  template.fit = (kids, slotName) => {
    const slot = template.$(`slot[name=${slotName}]`);
    slot.append(...(kids?.[Symbol.iterator] ? [...kids] : [kids]));
  };
  template.landing = (runway) => {
    $(`slot[name="${runway}"]`).append(template);
  };
  return template;
}

export function cloneTemplate(selector) {
  let template = recursiveFindTemplate(document, selector);
  if (!template) {
    throw Error("Template not found");
  }
  return craft(template, true);
}

function pack(element) {
  $$(element, "[class]").forEach((el) => {
    for (const c of el.classList) {
      element[c] = el;
    }
  });
  return element;
}
