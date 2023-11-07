import { regEx } from '../../../util/regex';
import { GalaxyCollectionDatasource } from '../../datasource/galaxy-collection';
import { GitTagsDatasource } from '../../datasource/git-tags';
import { GithubTagsDatasource } from '../../datasource/github-tags';
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
  dependency: AnsibleGalaxyPackageDependency,
): void {
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
      break;
    }
    case 'source': {
      localDependency.managerData.source = value;
      if (value?.startsWith('git@') || value?.endsWith('.git')) {
        localDependency.packageName = value;
      } else {
        localDependency.registryUrls = value
          ? [value]
          : /* istanbul ignore next: should have test */ [];
      }
      break;
    }
    case 'type': {
      localDependency.managerData.type = value;
      break;
    }
    default: {
      // fail if we find an unexpected key
      localDependency.skipReason = 'unsupported';
    }
  }
}

function handleGitDep(
  dep: AnsibleGalaxyPackageDependency,
  nameMatch: RegExpExecArray | null,
): void {
  dep.datasource = GitTagsDatasource.id;

  if (nameMatch?.groups) {
    // if a github.com repository is referenced use github-tags instead of git-tags
    if (nameMatch.groups.hostname === 'github.com') {
      dep.datasource = GithubTagsDatasource.id;
    } else {
      dep.datasource = GitTagsDatasource.id;
    }
    // source definition without version appendix
    const source = nameMatch.groups.source;
    const massagedDepName = nameMatch.groups.depName.replace(
      regEx(/.git$/),
      '',
    );
    dep.depName = `${nameMatch.groups.hostname}/${massagedDepName}`;
    // remove leading `git+` from URLs like `git+https://...`
    dep.packageName = source.replace(regEx(/git\+/), '');

    // if version is declared using version appendix `<source url>,v1.2.0`, use it
    if (nameMatch.groups.version) {
      dep.currentValue = nameMatch.groups.version;
    } else {
      dep.currentValue = dep.managerData.version;
    }
  }
}

function handleGalaxyDep(dep: AnsibleGalaxyPackageDependency): void {
  dep.datasource = GalaxyCollectionDatasource.id;
  dep.depName = dep.managerData.name;
  dep.registryUrls = dep.managerData.source
    ? /* istanbul ignore next: should have test */ [dep.managerData.source]
    : [];
  dep.currentValue = dep.managerData.version;
}

function finalize(dependency: AnsibleGalaxyPackageDependency): boolean {
  const dep = dependency;
  dep.depName = dep.managerData.name;

  const name = dep.managerData.name;
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
      dep.skipReason = 'local-dependency';
      break;
    case null:
      // try to find out type based on source
      if (nameMatch) {
        handleGitDep(dep, nameMatch);
        break;
      }
      if (galaxyDepRegex.exec(dep.managerData.name)) {
        dep.datasource = GalaxyCollectionDatasource.id;
        dep.depName = dep.managerData.name;
        break;
      }
      dep.skipReason = 'no-source-match';
      break;
    default:
      dep.skipReason = 'unsupported';
      return true;
  }

  if (!dependency.currentValue && !dep.skipReason) {
    dep.skipReason = 'unspecified-version';
  }
  return true;
}

export function extractCollections(lines: string[]): PackageDependency[] {
  const deps: PackageDependency[] = [];

  for (let lineNumber = 0; lineNumber < lines.length; lineNumber += 1) {
    let lineMatch = newBlockRegEx.exec(lines[lineNumber]);
    if (lineMatch) {
      const dep: AnsibleGalaxyPackageDependency = {
        depType: 'galaxy-collection',
        managerData: {
          name: null,
          version: null,
          type: null,
          source: null,
        },
      };
      do {
        interpretLine(lineMatch, dep);
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
