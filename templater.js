import { $, $$ } from "./dollars.js";

function recursiveFindTemplate(el, selector) {
  const target = $(el, "template" + selector);
  if (target) return target;

  const nested = $$(el, "template");
  for (const t of nested) {
    const result = recursiveFindTemplate(t.content, selector);
    if (result) return result;
  }
}

function packForChildTemplate(parentTemplate, childTemplate) {
  childTemplate = craft(childTemplate, false);

  Object.assign(childTemplate, {
    /**
     * Plug kid(s) into template slot.
     */
    plug(kids) {
      childTemplate.replaceWith(...(kids?.[Symbol.iterator] ? kids : [kids]));
    },
    /**
     * Providing clone function generating child template, then plug the
     * returned elements.
     */
    plugBy(factory) {
      this.plug(
        factory(function clone() {
          return craft(childTemplate, true);
        }),
      );
    },
  });

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

  Object.assign(template, {
    /**
     * Fits the kid(s) into template's slot.
     */
    fit(kids, slotName) {
      const slot = template.$(`slot[name=${slotName}]`);
      slot.append(...(kids?.[Symbol.iterator] ? kids : [kids]));
    },
    /**
     * Landing current template content into slot name with `runway`.
     */
    landing(runway) {
      $(`slot[name="${runway}"]`).append(template);
    },
  });

  return template;
}

export function cloneTemplate(selector) {
  const template = recursiveFindTemplate(document, selector);
  if (!template) return template;

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
