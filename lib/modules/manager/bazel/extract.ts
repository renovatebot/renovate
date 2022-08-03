import { dequal } from 'dequal';
import type { PackageDependency, PackageFile } from '../types';
import { parse } from './parser';
import type { RuleMeta } from './types';
import { ruleMappers } from './util';

// TODO: remove it
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
  _fileName?: string
): PackageFile | null {
  const deps: PackageDependency[] = [];

  const parsed = parse(content);
  if (parsed) {
    const { targets, meta: meta } = parsed;
    for (let i = 0; i < targets.length; i += 1) {
      const target = targets[i];
      const { rule } = target;
      const mapperFn = ruleMappers[rule];
      if (mapperFn) {
        const dep = mapperFn(target);
        if (dep) {
          const def = getRuleDefinition(content, meta, i);
          if (def) {
            dep.managerData = { def };
            deps.push(dep);
          }
        }
      }
    }
  }

  return deps.length ? { deps } : null;
}
