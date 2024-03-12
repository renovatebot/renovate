import type { PackageDependency, PackageFileContent } from '../types';
import { parse } from './parser';
import { extractDepsFromFragment } from './rules';
import { dockerRules } from './rules/docker';
import { gitRules } from './rules/git';
import { goRules } from './rules/go';
import { ociRules } from './rules/oci';
import type { RecordFragment } from './types';

export function extractPackageFile(
  content: string,
  packageFile: string,
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

      // Selectively provide `replaceString` in order to make auto-replace
      // functionality work correctly.
      const rules = [...dockerRules, ...ociRules, ...gitRules, ...goRules];
      const replaceString = fragment.value;
      if (rules.some((rule) => replaceString.startsWith(rule))) {
        if (dep.currentValue && dep.currentDigest) {
          dep.replaceString = replaceString;
        }
      }

      deps.push(dep);
    }
  }

  return deps.length ? { deps } : null;
}
