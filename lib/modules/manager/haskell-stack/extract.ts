import { logger } from '../../../logger/index.ts';
import type { PackageFileContent } from '../types.ts';
import { StackYaml } from './schema.ts';

export function extractPackageFile(
  content: string,
  packageFile: string,
): PackageFileContent | null {
  const deps = StackYaml.safeParse(content);
  if (!deps.success) {
    logger.debug(
      { packageFile, err: deps.error },
      'Failed to parse stack.yaml',
    );
    return null;
  }
  if (!deps.data.length) {
    return null;
  }
  return { deps: deps.data };
}
