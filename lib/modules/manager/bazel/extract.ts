import type { PackageDependency, PackageFileContent } from '../types.ts';
import { parse } from './parser.ts';
import { dockerRules } from './rules/docker.ts';
import { gitRules } from './rules/git.ts';
import { goRules } from './rules/go.ts';
import { extractDepsFromFragment } from './rules/index.ts';
import { ociRules } from './rules/oci.ts';
import type { RecordFragment } from './types.ts';

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
