import { parse } from '@iarna/toml';
import is from '@sindresorhus/is';
import { logger } from '../../../logger';
import type { SkipReason } from '../../../types';
import {
  getSiblingFileName,
  localPathExists,
  readLocalFile,
} from '../../../util/fs';
import { parseGitUrl } from '../../../util/git/url';
import { regEx } from '../../../util/regex';
import { GithubTagsDatasource } from '../../datasource/github-tags';
import { PypiDatasource } from '../../datasource/pypi';
import * as pep440Versioning from '../../versioning/pep440';
import * as poetryVersioning from '../../versioning/poetry';
import type { PackageDependency, PackageFileContent } from '../types';
import { extractLockFileEntries } from './locked-version';
import type { PoetryDependency, PoetryFile, PoetrySection } from './types';

function extractFromDependenciesSection(
  parsedFile: PoetryFile,
  section: keyof Omit<PoetrySection, 'source' | 'group'>,
  poetryLockfile: Record<string, string>
): PackageDependency[] {
  return extractFromSection(
    parsedFile.tool?.poetry?.[section],
    section,
    poetryLockfile
  );
}

function extractFromDependenciesGroupSection(
  parsedFile: PoetryFile,
  group: string,
  poetryLockfile: Record<string, string>
): PackageDependency[] {
  return extractFromSection(
    parsedFile.tool?.poetry?.group[group]?.dependencies,
    group,
    poetryLockfile
  );
}

function extractFromSection(
  sectionContent: Record<string, PoetryDependency | string> | undefined,
  depType: string,
  poetryLockfile: Record<string, string>
): PackageDependency[] {
  if (!sectionContent) {
    return [];
  }

  const deps: PackageDependency[] = [];

  for (const depName of Object.keys(sectionContent)) {
    if (depName === 'python' || depName === 'source') {
      continue;
    }

    const pep503NormalizeRegex = regEx(/[-_.]+/g);
    let packageName = depName.toLowerCase().replace(pep503NormalizeRegex, '-');
    let skipReason: SkipReason | null = null;
    let currentValue = sectionContent[depName];
    let nestedVersion = false;
    let datasource = PypiDatasource.id;
    let lockedVersion: string | null = null;
    if (packageName in poetryLockfile) {
      lockedVersion = poetryLockfile[packageName];
    }
    if (!is.string(currentValue)) {
      const version = currentValue.version;
      const path = currentValue.path;
      const git = currentValue.git;
      if (version) {
        currentValue = version;
        nestedVersion = true;
        if (!!path || git) {
          skipReason = path ? 'path-dependency' : 'git-dependency';
        }
      } else if (path) {
        currentValue = '';
        skipReason = 'path-dependency';
      } else if (git) {
        if (currentValue.tag) {
          currentValue = currentValue.tag;
          datasource = GithubTagsDatasource.id;
          const githubPackageName = extractGithubPackageName(git);
          if (githubPackageName) {
            packageName = githubPackageName;
          } else {
            skipReason = 'git-dependency';
          }
        } else {
          currentValue = '';
          skipReason = 'git-dependency';
        }
      } else {
        currentValue = '';
        skipReason = 'multiple-constraint-dep';
      }
    }
    const dep: PackageDependency = {
      depName,
      depType,
      currentValue,
      managerData: { nestedVersion },
      datasource,
    };
    if (lockedVersion) {
      dep.lockedVersion = lockedVersion;
    }
    if (depName !== packageName) {
      dep.packageName = packageName;
    }
    if (skipReason) {
      dep.skipReason = skipReason;
    } else if (pep440Versioning.isValid(currentValue)) {
      dep.versioning = pep440Versioning.id;
    } else if (poetryVersioning.isValid(currentValue)) {
      dep.versioning = poetryVersioning.id;
    } else {
      dep.skipReason = 'unspecified-version';
    }
    deps.push(dep);
  }
  return deps;
}

function extractRegistries(pyprojectfile: PoetryFile): string[] | undefined {
  const sources = pyprojectfile.tool?.poetry?.source;

  if (!Array.isArray(sources) || sources.length === 0) {
    return undefined;
  }

  const registryUrls = new Set<string>();
  for (const source of sources) {
    if (source.url) {
      registryUrls.add(source.url);
    }
  }
  registryUrls.add(process.env.PIP_INDEX_URL ?? 'https://pypi.org/pypi/');

  return Array.from(registryUrls);
}

export async function extractPackageFile(
  content: string,
  packageFile: string
): Promise<PackageFileContent | null> {
  logger.trace(`poetry.extractPackageFile(${packageFile})`);
  let pyprojectfile: PoetryFile;
  try {
    pyprojectfile = parse(content);
  } catch (err) {
    logger.debug({ err, packageFile }, 'Error parsing pyproject.toml file');
    return null;
  }
  if (!pyprojectfile.tool?.poetry) {
    logger.debug({ packageFile }, `contains no poetry section`);
    return null;
  }

  // handle the lockfile
  const lockfileName = getSiblingFileName(packageFile, 'poetry.lock');
  // TODO #7154
  const lockContents = (await readLocalFile(lockfileName, 'utf8'))!;

  const lockfileMapping = extractLockFileEntries(lockContents);

  const deps = [
    ...extractFromDependenciesSection(
      pyprojectfile,
      'dependencies',
      lockfileMapping
    ),
    ...extractFromDependenciesSection(
      pyprojectfile,
      'dev-dependencies',
      lockfileMapping
    ),
    ...extractFromDependenciesSection(pyprojectfile, 'extras', lockfileMapping),
    ...Object.keys(pyprojectfile.tool?.poetry?.group ?? []).flatMap((group) =>
      extractFromDependenciesGroupSection(pyprojectfile, group, lockfileMapping)
    ),
  ];

  if (!deps.length) {
    return null;
  }

  const extractedConstraints: Record<string, any> = {};

  if (is.nonEmptyString(pyprojectfile.tool?.poetry?.dependencies?.python)) {
    extractedConstraints.python =
      pyprojectfile.tool?.poetry?.dependencies?.python;
  }

  const res: PackageFileContent = {
    deps,
    registryUrls: extractRegistries(pyprojectfile),
    extractedConstraints,
  };
  // Try poetry.lock first
  let lockFile = getSiblingFileName(packageFile, 'poetry.lock');
  // istanbul ignore next
  if (await localPathExists(lockFile)) {
    res.lockFiles = [lockFile];
  } else {
    // Try pyproject.lock next
    lockFile = getSiblingFileName(packageFile, 'pyproject.lock');
    if (await localPathExists(lockFile)) {
      res.lockFiles = [lockFile];
    }
  }
  return res;
}

function extractGithubPackageName(url: string): string | null {
  const parsedUrl = parseGitUrl(url);
  if (parsedUrl.source !== 'github.com') {
    return null;
  }
  return `${parsedUrl.owner}/${parsedUrl.name}`;
}
