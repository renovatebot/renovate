import * as datasourceGalaxyCollection from '../../datasource/galaxy-collection';
import * as datasourceGitTags from '../../datasource/git-tags';
import * as datasourceGithubTags from '../../datasource/github-tags';
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
      localDependency.registryUrls = value ? [value] : [];
      break;
    }
    case 'type': {
      localDependency.managerData.type = value;
      break;
    }
    default: {
      // fail if we find an unexpected key
      localDependency.skipReason = SkipReason.Unsupported;
    }
  }
  return localDependency;
}

function handleGitDep(
  dep: PackageDependency,
  nameMatch: RegExpExecArray
): PackageDependency {
  /* eslint-disable no-param-reassign */
  dep.datasource = datasourceGitTags.id;

  if (nameMatch) {
    // if a github.com repository is referenced use github-tags instead of git-tags
    if (nameMatch.groups.hostname === 'github.com') {
      dep.datasource = datasourceGithubTags.id;
    } else {
      dep.datasource = datasourceGitTags.id;
    }
    // source definition without version appendix
    const source = nameMatch.groups.source;
    dep.depName = `${nameMatch.groups.hostname}/${nameMatch.groups.depName}`;
    // remove leading `git+` from URLs like `git+https://...`
    dep.lookupName = source.replace(/git\+/, '');

    // if version is declared using version appendix `<source url>,v1.2.0`, use it
    if (nameMatch.groups.version) {
      dep.currentValue = nameMatch.groups.version;
    } else {
      dep.currentValue = dep.managerData.version;
    }
  }
  return dep;
  /* eslint-enable no-param-reassign */
}

function handleGalaxyDep(dep: PackageDependency): PackageDependency {
  /* eslint-disable no-param-reassign */
  dep.datasource = datasourceGalaxyCollection.id;
  dep.depName = dep.managerData.name;
  dep.registryUrls = dep.managerData.source ? [dep.managerData.source] : [];
  dep.currentValue = dep.managerData.version;
  return dep;
  /* eslint-enable no-param-reassign */
}

function finalize(dependency: PackageDependency): boolean {
  const dep = dependency;
  dep.depName = dep.managerData.name;

  const name = dep.managerData.name;
  const nameMatchRegex = /^(?<source>(git|http|git\+http|ssh)s?(:\/\/|@)(?<hostname>.*)(\/|:)(?<depName>.+\/[^.,]+)\/?(\.git)?)(,(?<version>.*))?$/;
  const nameMatch = nameMatchRegex.exec(name);

  // use type if defined
  switch (dependency.managerData.type) {
    case 'galaxy':
      handleGalaxyDep(dep);
      break;
    case 'git':
      handleGitDep(dep, nameMatch);
      break;
    case 'file':
      dep.skipReason = SkipReason.LocalDependency;
      break;
    case null:
      // try to find out type based on source
      if (nameMatch) {
        handleGitDep(dep, nameMatch);
        break;
      }
      if (galaxyDepRegex.exec(dep.managerData.name)) {
        dep.datasource = datasourceGalaxyCollection.id;
        dep.depName = dep.managerData.name;
        break;
      }
      dep.skipReason = SkipReason.NoSourceMatch;
      break;
    default:
      dep.skipReason = SkipReason.Unsupported;
      return true;
  }

  if (dependency.currentValue == null && dep.skipReason == null) {
    dep.skipReason = SkipReason.NoVersion;
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
        interpretLine(lineMatch, lineNumber, dep);
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
