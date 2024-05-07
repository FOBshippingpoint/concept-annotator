export function updatePopoverContent(el, annotation) {
  const cuisText = annotation.body
    .filter(({ purpose }) => purpose === "tagging")
    .map(({ value }) => value)
    .join(", ");

  const affirmative = annotation.body
    .find(({ purpose }) => purpose === "commenting")
    ?.value.split("|", 2)[0];

  if (affirmative === "negated") {
    el.dataset.negated = "true";
  } else {
    el.dataset.negated = "false";
  }

  el.dataset.popoverContent = cuisText;
}
