import * as datasourceGalaxyCollection from '../../datasource/galaxy-collection';
import * as datasourceGitTags from '../../datasource/git-tags';
import { SkipReason } from '../../types';
import { PackageDependency } from '../types';
import { blockLineRegEx, galaxyDepRegex, newBlockRegEx } from './util';

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
      break;
    }
    case 'source': {
      localDependency.managerData.source = value;
      localDependency.registryUrls = [value];
      break;
    }
    case 'type': {
      localDependency.managerData.type = value;
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

  const source: string = dep.managerData.source;
  const sourceMatch: RegExpMatchArray = new RegExp(
    /^(git|http|git\+http|ssh)s?(:\/\/|@).*(\/|:)(.+\/[^.]+)\/?(\.git)?$/
  ).exec(source);
  if (sourceMatch) {
    dep.datasource = datasourceGitTags.id;
    dep.depName = sourceMatch[4];
    // remove leading `git+` from URLs like `git+https://...`
    dep.lookupName = source.replace(/git\+/, '');
  } else if (galaxyDepRegex.exec(source)) {
    dep.datasource = datasourceGalaxyCollection.id;
    dep.depName = dep.managerData.source;
    dep.lookupName = dep.managerData.source;
  } else if (galaxyDepRegex.exec(dep.managerData.name)) {
    dep.datasource = datasourceGalaxyCollection.id;
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

export function extractCollections(lines: string[]): PackageDependency[] {
  const deps: PackageDependency[] = [];

  for (let lineNumber = 0; lineNumber < lines.length; lineNumber += 1) {
    let lineMatch = newBlockRegEx.exec(lines[lineNumber]);
    if (lineMatch) {
      const dep: PackageDependency = {
        depType: 'collection',
        managerData: {
          name: null,
          version: null,
          type: null,
          source: null,
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
