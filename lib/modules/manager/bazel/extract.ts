import type { PackageDependency, PackageFile } from '../types';
import { parse } from './parser';
import { extractDepFromFragment } from './rules';
import type { RecordFragment } from './types';

export function extractPackageFile(
  content: string,
  packageFile: string
): PackageFile | null {
  const deps: PackageDependency[] = [];

  const fragments: RecordFragment[] | null = parse(content, packageFile);
  if (!fragments) {
    return null;
  }

  for (let idx = 0; idx < fragments.length; idx += 1) {
    const fragment = fragments[idx];

    const dep = extractDepFromFragment(fragment);
    if (!dep) {
      continue;
    }

    dep.managerData = { idx };
    deps.push(dep);
  }

  return deps.length ? { deps } : null;
}
