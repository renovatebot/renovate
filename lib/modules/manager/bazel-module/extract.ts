import { logger } from '../../../logger';
import { LooseArray } from '../../../util/schema-utils';
import type { PackageFileContent } from '../types';
import { parse } from './parser';
import { RuleToBazelModulePackageDep } from './rules';
import * as rules from './rules';

export function extractPackageFile(
  content: string,
  packageFile: string
): PackageFileContent | null {
  try {
    const records = parse(content);
    return LooseArray(RuleToBazelModulePackageDep)
      .transform(rules.toPackageDependencies)
      .transform((deps) => (deps.length ? { deps } : null))
      .parse(records);
  } catch (err) {
    logger.debug({ err, packageFile }, 'Failed to parse bazel module file.');
    return null;
  }
}
