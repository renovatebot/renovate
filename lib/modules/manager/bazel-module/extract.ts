import { LooseArray } from '../../../util/schema-utils';
import type { PackageFileContent } from '../types';
import { ToBazelDep } from './bazel-dep';
import { parse } from './parser';

export function extractPackageFile(
  content: string,
  packageFile: string
): PackageFileContent | null {
  const records = parse(content);
  return LooseArray(ToBazelDep)
    .transform((deps) => (deps.length ? { deps } : null))
    .parse(records);
}
