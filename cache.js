export const cache = {};

export function isCached(id) {
  return cache.hasOwnProperty(id);
}
