/**
 * Escape special regex characters in a string.
 * Prevents regex injection when using user input in RegExp constructors.
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = escapeRegex;
