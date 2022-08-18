import { logger } from '../../../logger';
import type { PackageDependency, PackageFile } from '../types';
import { extractDepFromTarget, getRuleDefinition } from './common';
import { parse } from './parser';
import type { ParsedResult } from './types';

export function extractPackageFile(
  content: string,
  packageFile: string
): PackageFile | null {
  const deps: PackageDependency[] = [];

  let parsed: ParsedResult | null = null;
  try {
    parsed = parse(content);
  } catch (err) /* istanbul ignore next */ {
    logger.debug({ err, packageFile }, 'Bazel parsing error');
  }

  if (!parsed) {
    return null;
  }

  const { targets, meta: meta } = parsed;
  for (let idx = 0; idx < targets.length; idx += 1) {
    const target = targets[idx];
    const dep = extractDepFromTarget(target);
    if (!dep) {
      continue;
    }

    const def = getRuleDefinition(content, meta, idx);
    // istanbul ignore if: should not happen
    if (!def) {
      logger.warn({ dep }, `Bazel: can't extract definition fragment`);
      continue;
    }

    dep.managerData = { def };
    deps.push(dep);
  }

  return deps.length ? { deps } : null;
}
