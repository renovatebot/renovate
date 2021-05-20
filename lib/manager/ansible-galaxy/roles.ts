import * as datasourceGalaxy from '../../datasource/galaxy';
import * as datasourceGitTags from '../../datasource/git-tags';
import { SkipReason } from '../../types';
import type { PackageDependency } from '../types';
import {
  blockLineRegEx,
  galaxyDepRegex,
  nameMatchRegex,
  newBlockRegEx,
} from './util';

function interpretLine(
  lineMatch: RegExpMatchArray,
  lineNumber: number,
  dependency: PackageDependency
): PackageDependency {
  const localDependency: PackageDependency = dependency;
  const key = lineMatch[2];
  const value = lineMatch[3].replace(/["']/g, '');
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

function finalize(dependency: PackageDependency): boolean {
  const dep = dependency;
  if (dependency.managerData.version === null) {
    dep.skipReason = SkipReason.NoVersion;
    return false;
  }

  const source: string = dep.managerData.src;
  const sourceMatch = nameMatchRegex.exec(source);
  if (sourceMatch) {
    dep.datasource = datasourceGitTags.id;
    dep.depName = sourceMatch.groups.depName.replace(/.git$/, '');
    // remove leading `git+` from URLs like `git+https://...`
    dep.lookupName = source.replace(/git\+/, '');
  } else if (galaxyDepRegex.exec(source)) {
    dep.datasource = datasourceGalaxy.id;
    dep.depName = dep.managerData.src;
    dep.lookupName = dep.managerData.src;
  } else if (galaxyDepRegex.exec(dep.managerData.name)) {
    dep.datasource = datasourceGalaxy.id;
    dep.depName = dep.managerData.name;
    dep.lookupName = dep.managerData.name;
  } else {
    dep.skipReason = SkipReason.NoSourceMatch;
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
      const dep: PackageDependency = {
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
        if (localdep == null) {
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
        delete dep.managerData;
        deps.push(dep);
      }
    }
  }
  return deps;
}
