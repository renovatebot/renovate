import * as datasourceGalaxyCollection from '../../datasource/galaxy-collection';
import { PackageDependency } from '../types';

export function extractCollectionsMetaDataFile(
  lines: string[]
): PackageDependency[] {
  const dependencyRegex = /^dependencies:/;
  const galaxyRegEx = /^\s+(?<lookupName>[\w.]+):\s*["'](?<version>.+)["']\s*/;
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
      if (galaxyRegExResult) {
        const dep: PackageDependency = {
          depType: 'collection',
          datasource: datasourceGalaxyCollection.id,
          depName: galaxyRegExResult.groups.lookupName,
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
