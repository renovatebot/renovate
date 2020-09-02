import findUp from 'find-up';
import { join } from 'upath';
import { RenovateConfig } from '../config/common';
import { setExecConfig } from './exec';
import { setFsConfig } from './fs';

export async function setUtilConfig(
  config: Partial<RenovateConfig>
): Promise<void> {
  await setExecConfig(config);
  setFsConfig(config);
}

/**
 * Resolve path for a file relative to renovate root directory (our package.json)
 * @param file a file to resolve
 */
export async function resolveFile(file: string): Promise<string> {
  const pkg = await findUp('package.json', { cwd: __dirname, type: 'file' });
  // istanbul ignore if
  if (!pkg) {
    throw new Error('Missing package.json');
  }
  return join(pkg, '../', file);
}

export function sampleSize(array: string[], n: number): string[] {
  const length = array == null ? 0 : array.length;
  if (!length || n < 1) {
    return [];
  }
  // eslint-disable-next-line no-param-reassign
  n = n > length ? length : n;
  let index = 0;
  const lastIndex = length - 1;
  const result = [...array];
  while (index < n) {
    const rand = index + Math.floor(Math.random() * (lastIndex - index + 1));
    [result[rand], result[index]] = [result[index], result[rand]];
    index += 1;
  }
  return result.slice(0, n);
}
