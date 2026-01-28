import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

// need to use dynamic path so that typescript does not include package.json in dist folder after compilation
const filePath = new URL('../package.json', import.meta.url).pathname;
export const pkg = require(filePath) as typeof import('../package.json');

/**
 * return's re2
 */
export function re2(): RegExpConstructor {
  return require('re2');
}

/**
 * return's prettier
 */
export function prettier(): typeof import('prettier') {
  return require('prettier');
}

/**
 * return's openpgp
 */
export async function openpgp(): Promise<typeof import('openpgp')> {
  return await import('openpgp');
}

/**
 * return's sqlite
 */
export async function sqlite(): Promise<typeof import('better-sqlite3')> {
  return (await import('better-sqlite3')).default;
}
