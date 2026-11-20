import { logger } from '../../../logger/index.ts';
import type { PackageFileContent } from '../types.ts';
import { StackYaml } from './schema.ts';

export function extractPackageFile(
  content: string,
  packageFile: string,
): PackageFileContent | null {
  const parsed = StackYaml.safeParse(content);
  if (!parsed.success) {
    logger.debug(
      { packageFile, err: parsed.error },
      'Failed to parse stack.yaml',
    );
    return null;
  }
  if (!parsed.data.length) {
    return null;
  }
  return { deps: parsed.data };
}
