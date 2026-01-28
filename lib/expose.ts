// need to use dynamic path so that typescript does not include package.json in dist folder after compilation
const filePath = new URL('../package.json', import.meta.url).pathname;
export const pkg = (await import(filePath, { with: { type: 'json' } }))
  .default as typeof import('../package.json');

/**
 * return's re2
 */
export async function re2(): Promise<RegExpConstructor> {
  return (await import('re2')).default;
}

/**
 * return's prettier
 */
export async function prettier(): Promise<typeof import('prettier')> {
  return await import('prettier');
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
