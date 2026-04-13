/**
 * Browser-compatible stub for expose.ts.
 * Node-specific modules (re2, prettier, openpgp, sqlite) are not available
 * in the browser. Functions that attempt to use them will throw at call time,
 * not at import time, so that the browser bundle can still be loaded.
 */

// pkg is not available in the browser, use an empty object
export const pkg = {} as typeof import('../package.json');

/**
 * Returns re2 - not available in browser, throws when called.
 * The caller (lib/util/regex.ts) wraps this in a try-catch so it
 * gracefully falls back to native RegExp.
 */
export function re2(): RegExpConstructor {
  throw new Error('re2 is not available in the browser');
}

/**
 * Returns prettier - not available in browser, throws when called.
 */
export function prettier(): typeof import('prettier') {
  throw new Error('prettier is not available in the browser');
}

/**
 * Returns openpgp - not available in browser, throws when called.
 */
export function openpgp(): Promise<typeof import('openpgp')> {
  return Promise.reject(new Error('openpgp is not available in the browser'));
}

/**
 * Returns sqlite - not available in browser, throws when called.
 */
export function sqlite(): Promise<typeof import('better-sqlite3')> {
  return Promise.reject(new Error('sqlite is not available in the browser'));
}
