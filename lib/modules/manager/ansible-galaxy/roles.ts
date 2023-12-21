import { regEx } from '../../../util/regex';
import { GalaxyDatasource } from '../../datasource/galaxy';
import { GitTagsDatasource } from '../../datasource/git-tags';
import type { PackageDependency } from '../types';
import type { AnsibleGalaxyPackageDependency } from './types';
import {
  blockLineRegEx,
  galaxyDepRegex,
  nameMatchRegex,
  newBlockRegEx,
} from './util';

function interpretLine(
  lineMatch: RegExpMatchArray,
  lineNumber: number,
  dependency: AnsibleGalaxyPackageDependency,
): AnsibleGalaxyPackageDependency | null {
  const localDependency = dependency;
  const key = lineMatch[2];
  const value = lineMatch[3].replace(regEx(/["']/g), '');
  switch (key) {
    case 'name': {
      localDependency.managerData.name = value;
      break;
    }
    case 'version': {
      localDependency.managerData.version = value;
      localDependency.currentValue = value;
      localDependency.managerData.lineNumber = lineNumber;
      break;
    }
    case 'scm': {
      localDependency.managerData.scm = value;
      break;
    }
    case 'src': {
      localDependency.managerData.src = value;
      break;
    }
    default: {
      return null;
    }
  }
  return localDependency;
}

function finalize(dependency: AnsibleGalaxyPackageDependency): boolean {
  const dep = dependency;
  if (dependency.managerData.version === null) {
    dep.skipReason = 'unspecified-version';
    return false;
  }
  const source = dep.managerData.src ?? '';
  const sourceMatch = nameMatchRegex.exec(source);
  if (sourceMatch?.groups) {
    dep.datasource = GitTagsDatasource.id;
    dep.depName = sourceMatch.groups.depName.replace(regEx(/.git$/), '');
    // remove leading `git+` from URLs like `git+https://...`
    dep.packageName = source.replace(regEx(/git\+/), '');
  } else if (galaxyDepRegex.exec(source)) {
    dep.datasource = GalaxyDatasource.id;
    dep.depName = source;
    dep.packageName = source;
  } else if (galaxyDepRegex.exec(dep.managerData.name ?? '')) {
    dep.datasource = GalaxyDatasource.id;
    dep.depName = dep.managerData.name!;
    dep.packageName = dep.managerData.name!;
  } else {
    dep.skipReason = 'no-source-match';
    return false;
  }
  if (dep.managerData.name !== null) {
    dep.depName = dep.managerData.name;
  }

  return true;
}

export function extractRoles(lines: string[]): PackageDependency[] {
  const deps: PackageDependency[] = [];

  for (let lineNumber = 0; lineNumber < lines.length; lineNumber += 1) {
    let lineMatch = newBlockRegEx.exec(lines[lineNumber]);
    if (lineMatch) {
      const dep: AnsibleGalaxyPackageDependency = {
        depType: 'role',
        managerData: {
          name: null,
          version: null,
          scm: null,
          src: null,
        },
      };
      do {
        const localdep = interpretLine(lineMatch, lineNumber, dep);
        if (!localdep) {
          break;
        }
        const line = lines[lineNumber + 1];

        if (!line) {
          break;
        }
        lineMatch = blockLineRegEx.exec(line);
        if (lineMatch) {
          lineNumber += 1;
        }
      } while (lineMatch);
      if (finalize(dep)) {
        delete (dep as PackageDependency).managerData;
        deps.push(dep);
      }
    }
  }
  return deps;
}
