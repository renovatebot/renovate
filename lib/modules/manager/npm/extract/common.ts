import is from '@sindresorhus/is';
import validateNpmPackageName from 'validate-npm-package-name';
import { logger } from '../../../../logger';
import { regEx } from '../../../../util/regex';
import { GithubTagsDatasource } from '../../../datasource/github-tags';
import { NpmDatasource } from '../../../datasource/npm';
import * as nodeVersioning from '../../../versioning/node';
import { api, isValid, isVersion } from '../../../versioning/npm';
import type { PackageDependency } from '../../types';
import type { NpmManagerData } from '../types';

const RE_REPOSITORY_GITHUB_SSH_FORMAT = regEx(
  /(?:git@)github.com:([^/]+)\/([^/.]+)(?:\.git)?/
);

export function setNodeCommitTopic(
  dep: PackageDependency<NpmManagerData>
): void {
  // This is a special case for Node.js to group it together with other managers
  if (dep.depName === 'node') {
    dep.commitMessageTopic = 'Node.js';
  }
}

export function parseDepName(depType: string, key: string): string {
  if (depType !== 'resolutions') {
    return key;
  }

  const [, depName] = regEx(/((?:@[^/]+\/)?[^/@]+)$/).exec(key) ?? [];
  return depName;
}

export function extractDependency(
  depType: string,
  depName: string,
  input: string
): PackageDependency {
  const dep: PackageDependency = {};
  if (!validateNpmPackageName(depName).validForOldPackages) {
    dep.skipReason = 'invalid-name';
    return dep;
  }
  if (typeof input !== 'string') {
    dep.skipReason = 'invalid-value';
    return dep;
  }
  dep.currentValue = input.trim();
  if (depType === 'engines' || depType === 'packageManager') {
    if (depName === 'node') {
      dep.datasource = GithubTagsDatasource.id;
      dep.packageName = 'nodejs/node';
      dep.versioning = nodeVersioning.id;
    } else if (depName === 'yarn') {
      dep.datasource = NpmDatasource.id;
      dep.commitMessageTopic = 'Yarn';
      const major =
        isVersion(dep.currentValue) && api.getMajor(dep.currentValue);
      if (major && major > 1) {
        dep.packageName = '@yarnpkg/cli';
      }
    } else if (depName === 'npm') {
      dep.datasource = NpmDatasource.id;
      dep.commitMessageTopic = 'npm';
    } else if (depName === 'pnpm') {
      dep.datasource = NpmDatasource.id;
      dep.commitMessageTopic = 'pnpm';
    } else if (depName === 'vscode') {
      dep.datasource = GithubTagsDatasource.id;
      dep.packageName = 'microsoft/vscode';
    } else {
      dep.skipReason = 'unknown-engines';
    }
    if (!isValid(dep.currentValue)) {
      dep.skipReason = 'unspecified-version';
    }
    return dep;
  }

  // support for volta
  if (depType === 'volta') {
    if (depName === 'node') {
      dep.datasource = GithubTagsDatasource.id;
      dep.packageName = 'nodejs/node';
      dep.versioning = nodeVersioning.id;
    } else if (depName === 'yarn') {
      dep.datasource = NpmDatasource.id;
      dep.commitMessageTopic = 'Yarn';
      const major =
        isVersion(dep.currentValue) && api.getMajor(dep.currentValue);
      if (major && major > 1) {
        dep.packageName = '@yarnpkg/cli';
      }
    } else if (depName === 'npm') {
      dep.datasource = NpmDatasource.id;
    } else if (depName === 'pnpm') {
      dep.datasource = NpmDatasource.id;
      dep.commitMessageTopic = 'pnpm';
    } else {
      dep.skipReason = 'unknown-volta';
    }
    if (!isValid(dep.currentValue)) {
      dep.skipReason = 'unspecified-version';
    }
    return dep;
  }

  if (dep.currentValue.startsWith('npm:')) {
    dep.npmPackageAlias = true;
    const valSplit = dep.currentValue.replace('npm:', '').split('@');
    if (valSplit.length === 2) {
      dep.packageName = valSplit[0];
      dep.currentValue = valSplit[1];
    } else if (valSplit.length === 3) {
      dep.packageName = valSplit[0] + '@' + valSplit[1];
      dep.currentValue = valSplit[2];
    } else {
      logger.debug('Invalid npm package alias: ' + dep.currentValue);
    }
  }
  if (dep.currentValue.startsWith('file:')) {
    dep.skipReason = 'file';
    return dep;
  }
  if (isValid(dep.currentValue)) {
    dep.datasource = NpmDatasource.id;
    if (dep.currentValue === '') {
      dep.skipReason = 'empty';
    }
    return dep;
  }
  const hashSplit = dep.currentValue.split('#');
  if (hashSplit.length !== 2) {
    dep.skipReason = 'unspecified-version';
    return dep;
  }
  const [depNamePart, depRefPart] = hashSplit;

  let githubOwnerRepo: string;
  let githubOwner: string;
  let githubRepo: string;
  const matchUrlSshFormat = RE_REPOSITORY_GITHUB_SSH_FORMAT.exec(depNamePart);
  if (matchUrlSshFormat === null) {
    githubOwnerRepo = depNamePart
      .replace(regEx(/^github:/), '')
      .replace(regEx(/^git\+/), '')
      .replace(regEx(/^https:\/\/github\.com\//), '')
      .replace(regEx(/\.git$/), '');
    const githubRepoSplit = githubOwnerRepo.split('/');
    if (githubRepoSplit.length !== 2) {
      dep.skipReason = 'unspecified-version';
      return dep;
    }
    [githubOwner, githubRepo] = githubRepoSplit;
  } else {
    githubOwner = matchUrlSshFormat[1];
    githubRepo = matchUrlSshFormat[2];
    githubOwnerRepo = `${githubOwner}/${githubRepo}`;
  }
  const githubValidRegex = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i; // TODO #12872 lookahead
  if (
    !githubValidRegex.test(githubOwner) ||
    !githubValidRegex.test(githubRepo)
  ) {
    dep.skipReason = 'unspecified-version';
    return dep;
  }
  if (isVersion(depRefPart)) {
    dep.currentRawValue = dep.currentValue;
    dep.currentValue = depRefPart;
    dep.datasource = GithubTagsDatasource.id;
    dep.packageName = githubOwnerRepo;
    dep.pinDigests = false;
  } else if (
    regEx(/^[0-9a-f]{7}$/).test(depRefPart) ||
    regEx(/^[0-9a-f]{40}$/).test(depRefPart)
  ) {
    dep.currentRawValue = dep.currentValue;
    dep.currentValue = null;
    dep.currentDigest = depRefPart;
    dep.datasource = GithubTagsDatasource.id;
    dep.packageName = githubOwnerRepo;
  } else {
    dep.skipReason = 'unversioned-reference';
    return dep;
  }
  dep.sourceUrl = `https://github.com/${githubOwnerRepo}`;
  dep.gitRef = true;
  return dep;
}

/**
 * Used when there is a json object as a value in overrides block.
 * @param parents
 * @param child
 * @returns PackageDependency array
 */
export function extractOverrideDepsRec(
  parents: string[],
  child: NpmManagerData
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
