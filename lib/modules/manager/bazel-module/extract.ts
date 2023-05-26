import { logger } from '../../../logger';
import { LooseArray } from '../../../util/schema-utils';
import type { PackageFileContent } from '../types';
import { ToBazelDep } from './bazel-dep';
import { parse } from './parser';

export function extractPackageFile(
  content: string,
  packageFile: string
): PackageFileContent | null {
  try {
    const records = parse(content);
    return LooseArray(ToBazelDep)
      .transform((deps) => (deps.length ? { deps } : null))
      .parse(records);
  } catch (err) {
    logger.debug({ err, packageFile }, 'Failed to parse bazel module file.');
    return null;
  }
}
