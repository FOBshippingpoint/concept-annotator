export default function debounceTrailing(func, timeout = 300) {
	let timer;
	return (...args) => {
		clearTimeout(timer);
		timer = setTimeout(() => {
			timer = undefined;
			func.apply(this, args);
		}, timeout);
	};
}
