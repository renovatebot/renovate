import { GalaxyCollectionDatasource } from '../../datasource/galaxy-collection';
import type { PackageDependency } from '../types';
import { dependencyRegex, galaxyRegEx } from './util';

export function extractCollectionsMetaDataFile(
  lines: string[],
): PackageDependency[] {
  const deps: PackageDependency[] = [];
  // in a galaxy.yml the dependency map is inside a `dependencies:` block
  let foundDependencyBlock = false;
  for (let lineNumber = 0; lineNumber < lines.length; lineNumber += 1) {
    const line = lines[lineNumber];

    if (dependencyRegex.exec(line)) {
      foundDependencyBlock = true;
    } else if (foundDependencyBlock) {
      // expects a line like this `  ansible.windows: "1.4.0"`
      const galaxyRegExResult = galaxyRegEx.exec(line);
      if (galaxyRegExResult?.groups) {
        const dep: PackageDependency = {
          depType: 'galaxy-collection',
          datasource: GalaxyCollectionDatasource.id,
          depName: galaxyRegExResult.groups.packageName,
          currentValue: galaxyRegExResult.groups.version,
        };
        deps.push(dep);
      } else {
        // if we can not match additional lines, the block has ended.
        break;
      }
    }
  }
  return deps;
}
