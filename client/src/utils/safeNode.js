import React from 'react';

/**
 * safeNode: ensures only renderable React primitives or React elements are returned.
 * Filters out raw DOM elements (e.g. HTMLBodyElement, HTMLElement), objects, or invalid items.
 */
export function safeNode(val, fallback = null) {
  if (val === null || val === undefined) {
    return fallback;
  }
  if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
    return val;
  }
  if (React.isValidElement(val)) {
    return val;
  }
  if (Array.isArray(val)) {
    return val.map((child, idx) => safeNode(child, null));
  }
  if (typeof Node !== 'undefined' && val instanceof Node) {
    if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
      console.warn('[safeNode guard] Blocked DOM Node from being rendered as a React child:', val);
    }
    return fallback;
  }
  if (typeof val === 'object') {
    if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
      console.warn('[safeNode guard] Blocked non-React object from being rendered as a React child:', val);
    }
    return fallback;
  }
  return fallback;
}

