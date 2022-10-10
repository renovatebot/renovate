import { logger } from '../../../logger';
import type { PackageDependency, PackageFile } from '../types';
import { coerceFragmentToTarget, extractDepFromTarget } from './common';
import { parse } from './parser';
import type { ArrayFragment } from './types';

export function extractPackageFile(
  content: string,
  packageFile: string
): PackageFile | null {
  const deps: PackageDependency[] = [];

  let parsed: ArrayFragment | null = null;
  try {
    parsed = parse(content);
  } catch (err) /* istanbul ignore next */ {
    logger.debug({ err, packageFile }, 'Bazel parsing error');
  }

  if (!parsed) {
    return null;
  }

  for (let idx = 0; idx < parsed.children.length; idx += 1) {
    const fragment = parsed.children[idx];
    const target = coerceFragmentToTarget(fragment);
    if (!target) {
      continue;
    }

    const dep = extractDepFromTarget(target);
    if (!dep) {
      continue;
    }

    dep.managerData = { def: fragment.value };
    deps.push(dep);
  }

  return deps.length ? { deps } : null;
}
