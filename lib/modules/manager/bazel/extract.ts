import type { PackageDependency, PackageFileContent } from '../types';
import { parse } from './parser';
import { extractDepsFromFragment } from './rules';
import type { RecordFragment } from './types';

export function extractPackageFile(
  content: string,
  packageFile: string
): PackageFileContent | null {
  const deps: PackageDependency[] = [];

  const fragments: RecordFragment[] | null = parse(content, packageFile);
  if (!fragments) {
    return null;
  }

  for (let idx = 0; idx < fragments.length; idx += 1) {
    const fragment = fragments[idx];
    for (const dep of extractDepsFromFragment(fragment)) {
      dep.managerData = { idx };

      // Selectively provide `replaceString` in order
      // to auto-replace functionality work correctly.
      const replaceString = fragment.value;
      if (
        replaceString.startsWith('container_pull') ||
        replaceString.startsWith('oci_pull') ||
        replaceString.startsWith('git_repository') ||
        replaceString.startsWith('go_repository')
      ) {
        if (dep.currentValue && dep.currentDigest) {
          dep.replaceString = replaceString;
        }
      }

      deps.push(dep);
    }
  }

  return deps.length ? { deps } : null;
}
