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
