import findUp from 'find-up';
import { join } from 'upath';

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
