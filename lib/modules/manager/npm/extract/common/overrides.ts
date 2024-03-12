import is from '@sindresorhus/is';
import type { PackageDependency } from '../../../types';
import type { NpmManagerData } from '../../types';
import { extractDependency } from './dependency';
import { setNodeCommitTopic } from './node';

/**
 * Used when there is a json object as a value in overrides block.
 * @param parents
 * @param child
 * @returns PackageDependency array
 */
export function extractOverrideDepsRec(
  parents: string[],
  child: NpmManagerData,
): PackageDependency[] {
  const deps: PackageDependency[] = [];
  if (!child || is.emptyObject(child)) {
    return deps;
  }
  for (const [overrideName, versionValue] of Object.entries(child)) {
    if (is.string(versionValue)) {
      // special handling for "." override depenency name
      // "." means the constraint is applied to the parent dep
      const currDepName =
        overrideName === '.' ? parents[parents.length - 1] : overrideName;
      const dep: PackageDependency<NpmManagerData> = {
        depName: currDepName,
        depType: 'overrides',
        managerData: { parents: parents.slice() }, // set parents for dependency
      };
      setNodeCommitTopic(dep);
      deps.push({
        ...dep,
        ...extractDependency('overrides', currDepName, versionValue),
      });
    } else {
      // versionValue is an object, run recursively.
      parents.push(overrideName);
      const depsOfObject = extractOverrideDepsRec(parents, versionValue);
      deps.push(...depsOfObject);
    }
  }
  parents.pop();
  return deps;
}
