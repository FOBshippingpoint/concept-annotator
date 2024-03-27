/**
 * Create a debounced function that delays invoking `func`.
 * See {@link https://css-tricks.com/debouncing-throttling-explained-examples/}
 * for more information.
 */
export default function debounce(func, type = "trailing", timeout = 300) {
  let timer;
  return (...args) => {
    if (timer) {
      clearTimeout(timer);
    } else if (type == "leading") {
      func.apply(this, args);
    }
    timer = setTimeout(() => {
      timer = undefined;
      func.apply(this, args);
    }, timeout);
  };
}
