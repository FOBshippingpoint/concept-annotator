import { $$$ } from "./dollars.js";

export function adjustElementPosition(targetEl, referenceEl) {
  const coords = getCoords(referenceEl);
  targetEl.style.left = coords.left + coords.width / 2 + "px";
  targetEl.style.top = coords.top + coords.height * 1.1 + "px";
  targetEl.style.transform = "translateX(-50%)";
}

export function addTagForElement(el, textContent, dataset) {
  const tag = $$$("dfn");
  tag.classList.add("tag");
  tag.textContent = textContent;
  tag.adjustPosition = () => {
    queueMicrotask(() => adjustElementPosition(tag, el));
  };
  for (const key in dataset) {
    tag.dataset[key] = dataset[key];
  }

  document.body.appendChild(tag);
  tag.adjustPosition();
}

// get document coordinates of the element
function getCoords(el) {
  let box = el.getBoundingClientRect();

  return {
    top: box.top + scrollY,
    right: box.right + scrollX,
    bottom: box.bottom + scrollY,
    left: box.left + scrollX,
    width: box.width,
    height: box.height,
  };
}

export function updatePopoverContent(el, annotation) {
  const cuisText = annotation.body
    .filter(({ purpose }) => purpose === "tagging")
    .map(({ value }) => value)
    .join(", ");

  const affirmative = annotation.body
    .find(({ purpose }) => purpose === "commenting")
    .value.split("|", 2)[0];

  if (affirmative === "negated") {
    el.dataset.negated = "true";
  } else {
    el.dataset.negated = "false";
  }

  el.dataset.popoverContent = cuisText;
}
