import type { PackageFileContent } from '../types';
import { instanceExists } from './filters';
import { RecordFragment } from './fragments';
import { parse } from './parser';
import { BazelDepRecordToPackageDependency } from './rules';

export function extractPackageFile(
  content: string,
  packageFile: string
): PackageFileContent | null {
  const fragments = parse(content, packageFile);
  if (!fragments) {
    return null;
  }
  const deps = fragments
    .filter((value) => value instanceof RecordFragment)
    .map((value) => value as RecordFragment)
    .filter((record) => record.isRule('bazel_dep'))
    .map((record) => {
      const result = BazelDepRecordToPackageDependency.safeParse(record);
      return result.success ? result.data : undefined;
    })
    .filter(instanceExists);
  return deps.length ? { deps } : null;
}
