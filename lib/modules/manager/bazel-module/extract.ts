import { logger } from '../../../logger';
import { isNotNullOrUndefined } from '../../../util/array';
import type { PackageFileContent } from '../types';
import { toPackageDependency } from './bazel-dep';
import { parse } from './parser';

export function extractPackageFile(
  content: string,
  packageFile: string
): PackageFileContent | null {
  const deps = parse(content)
    .map((frag) => toPackageDependency(frag))
    .filter(isNotNullOrUndefined);
  if (deps.length) {
    return { deps };
  }
  logger.debug(
    { packageFile },
    'The package file did not contain any package dependencies.'
  );
  return null;
}
