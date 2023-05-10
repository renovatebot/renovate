import type { PackageFileContent } from '../types';
import * as bazelDep from './bazel-dep';
import { isNotNullOrUndefined } from './filters';
import { parse } from './parser';

export function extractPackageFile(
  content: string,
  packageFile: string
): PackageFileContent | null {
  const fragments = parse(content, packageFile);
  if (!fragments) {
    return null;
  }
  const deps = fragments
    .map((frag) => bazelDep.toPackageDependency(frag))
    .filter(isNotNullOrUndefined);
  // istanbul ignore next: cannot reach null without introducing fake rule
  return deps.length ? { deps } : null;
}
