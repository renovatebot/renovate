import crypto from 'node:crypto';
import fs from 'node:fs/promises';

/**
 * Generate hash from array of strings
 * @param {string[]} input
 * @param {string} algorithm
 * @returns {string}
 */
export function hashFromArray(input, algorithm = 'sha512') {
  const hash = crypto.createHash(algorithm);
  for (const str of input) {
    hash.update(str);
  }

  return hash.digest('hex');
}

/**
 * Generate hash from array of strings
 * @param {string} file
 * @param {string} algorithm
 * @returns {Promise<string>}
 */
export async function hashFile(file, algorithm = 'sha512') {
  const data = await fs.readFile(file);
  const hash = crypto.createHash(algorithm);
  hash.update(data);
  return hash.digest('hex');
}
