import type { PackageFileContent } from '../types';
import { BazelDepRecordToPackageDependency } from './bazel-dep';
import { instanceExists } from './filters';
import { Fragments } from './fragments';
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
    .map((value) => Fragments.safeAsRecord(value))
    .filter(instanceExists)
    .filter((record) => record.isRule('bazel_dep'))
    .map((record) => BazelDepRecordToPackageDependency.parse(record));
  // istanbul ignore next: cannot reach null without introducing fake rule
  return deps.length ? { deps } : null;
}
