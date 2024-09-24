import fs from 'fs-extra';
import { SemVer } from 'semver';
import { logger } from '../../lib/logger';

export const newFiles = new Set();

/**
 * @param {string } file
 * @param {string} code
 * @returns {Promise<void>}
 */
export async function updateFile(file: string, code: string): Promise<void> {
  const oldCode = fs.existsSync(file) ? await fs.readFile(file, 'utf8') : null;
  if (code !== oldCode) {
    if (!code) {
      logger.error({ file }, 'Missing content');
    }
    await fs.outputFile(file, code ?? '', { encoding: 'utf8' });
  }
  newFiles.add(file);
}

/**
 * @param {string } file
 * @returns {Promise<string | null>}
 */
export function readFile(file: string): Promise<string> {
  if (fs.existsSync(file)) {
    return fs.readFile(file, 'utf8');
  }
  return Promise.resolve('');
}

/**
 *
 * @param  val
 */
export function parsePositiveInt(val: string | undefined): number {
  if (!val) {
    return 0;
  }
  const r = Number.parseInt(val, 10);
  if (!Number.isFinite(r) || r < 0) {
    throw new Error(`Invalid number: ${val}`);
  }

  return r;
}

/**
 *
 * @param val
 */
export function parseVersion(val: string | undefined): SemVer | undefined {
  if (!val) {
    return undefined;
  }
  // can throw
  return new SemVer(val);
}
