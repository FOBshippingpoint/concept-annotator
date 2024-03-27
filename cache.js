/**
 * cache.js
 *
 * This module provides a simple in-memory cache that persists only for the duration of the current web page session.
 * It allows storing and retrieving data identified by unique keys.
 */

export const cache = {};

/**
 * Checks if a value is cached for the given `id`.
 *
 * @param {string} id - The unique identifier for the cached value.
 * @returns {boolean} True if a value is cached for the provided `id`, false otherwise.
 */
export function isCached(id) {
  return cache.hasOwnProperty(id);
}
