import { dequal } from 'dequal';
import { logger } from '../../../logger';
import type { PackageDependency, PackageFile } from '../types';
import { parse } from './parser';
import type { ParsedResult, RuleMeta } from './types';
import { ruleMappers } from './util';

// TODO: remove it (#9667)
function getRuleDefinition(
  content: string,
  meta: RuleMeta[],
  ruleIndex: number
): string | null {
  let result: string | null = null;

  const rulePath = [ruleIndex];
  const ruleMeta = meta.find(({ path }) => dequal(path, rulePath));
  if (ruleMeta) {
    const {
      data: { offset, length },
    } = ruleMeta;
    result = content.slice(offset, offset + length);
  }

  return result;
}

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
  for (let i = 0; i < targets.length; i += 1) {
    const target = targets[i];
    const { rule } = target;
    const mapperFn = ruleMappers[rule];

    // istanbul ignore if
    if (!mapperFn) {
      continue;
    }

    const dep = mapperFn(target);

    // istanbul ignore if
    if (!dep) {
      continue;
    }

    const def = getRuleDefinition(content, meta, i);

    // istanbul ignore if
    if (!def) {
      continue;
    }

    dep.managerData = { def };
    deps.push(dep);
  }

  return deps.length ? { deps } : null;
}
