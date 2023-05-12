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
  return deps.length ? { deps } : null;
}
