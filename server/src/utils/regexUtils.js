/**
 * Regular Expression Utilities
 * Escapes regex special characters to prevent ReDoS and RegExp syntax errors.
 */

export const escapeRegex = (string) => {
  if (typeof string !== 'string') return '';
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

