import fs from 'fs-extra';

/**
 * @type {Set<string>}
 */
export const newFiles = new Set();

/**
 * Get environment variable or empty string.
 * Used for easy mocking.
 * @param {string} key variable name
 * @returns {string}
 */
export function getEnv(key) {
  return process.env[key] ?? '';
}

/**
 * Find all module directories.
 * @param {string} dirname dir to search in
 * @returns {string[]}
 */
export function findModules(dirname) {
  return fs
    .readdirSync(dirname, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name)
    .filter((name) => !name.startsWith('__'))
    .sort();
}

/**
 * @param {string} input
 * @returns {string}
 */
export function camelCase(input) {
  return input
    .replace(/(?:^\w|[A-Z]|\b\w)/g, (char, index) =>
      index === 0 ? char.toLowerCase() : char.toUpperCase()
    )
    .replace(/-/g, '');
}

/**
 * @param {string } file
 * @param {string} code
 * @returns {Promise<void>}
 */
export async function updateFile(file, code) {
  const oldCode = fs.existsSync(file) ? await fs.readFile(file, 'utf8') : null;
  if (code !== oldCode) {
    await fs.writeFile(file, code);
  }
  newFiles.add(file);
}

/**
 * @param {string } file
 * @returns {Promise<string | null>}
 */
export function readFile(file) {
  if (fs.existsSync(file)) {
    return fs.readFile(file, 'utf8');
  }
  return null;
}
