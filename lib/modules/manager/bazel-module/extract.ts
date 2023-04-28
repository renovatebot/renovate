import type { PackageFileContent } from '../types';
import { BazelDepRecordToPackageDependency } from './bazel-dep';
import { instanceExists } from './filters';
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
    .map((record) => {
      const result = BazelDepRecordToPackageDependency.safeParse(record);
      // istanbul ignore next: cannot reach undefined without an additional rule
      return result.success ? result.data : undefined;
    })
    .filter(instanceExists);
  // istanbul ignore next: cannot reach null without introducing fake rule
  return deps.length ? { deps } : null;
}
