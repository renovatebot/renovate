import { parse } from '@iarna/toml';
import is from '@sindresorhus/is';
import * as datasourcePypi from '../../datasource/pypi';
import { logger } from '../../logger';
import { SkipReason } from '../../types';
import {
  getSiblingFileName,
  localPathExists,
  readLocalFile,
} from '../../util/fs';
import * as pep440Versioning from '../../versioning/pep440';
import * as poetryVersioning from '../../versioning/poetry';
import type { PackageDependency, PackageFile } from '../types';
import type {
  PoetryFile,
  PoetryLock,
  PoetryLockSection,
  PoetrySection,
} from './types';

function extractFromSection(
  parsedFile: PoetryFile,
  section: keyof PoetrySection,
  poetryLockfile: Record<string, PoetryLockSection>
): PackageDependency[] {
  const deps = [];
  const sectionContent = parsedFile.tool.poetry[section];
  if (!sectionContent) {
    return [];
  }

  Object.keys(sectionContent).forEach((depName) => {
    if (depName === 'python') {
      return;
    }
    let skipReason: SkipReason;
    let currentValue = sectionContent[depName];
    let nestedVersion = false;
    if (typeof currentValue !== 'string') {
      const version = currentValue.version;
      const path = currentValue.path;
      const git = currentValue.git;
      if (version) {
        currentValue = version;
        nestedVersion = true;
        if (path) {
          skipReason = SkipReason.PathDependency;
        }
        if (git) {
          skipReason = SkipReason.GitDependency;
        }
      } else if (path) {
        currentValue = '';
        skipReason = SkipReason.PathDependency;
      } else if (git) {
        currentValue = '';
        skipReason = SkipReason.GitDependency;
      } else {
        currentValue = '';
        skipReason = SkipReason.MultipleConstraintDep;
      }
    }
    const dep: PackageDependency = {
      depName,
      depType: section,
      currentValue: currentValue as string,
      managerData: { nestedVersion },
      datasource: datasourcePypi.id,
    };
    if (dep.depName in poetryLockfile) {
      dep.lockedVersion = poetryLockfile[dep.depName].version;
    }
    if (skipReason) {
      dep.skipReason = skipReason;
    } else if (pep440Versioning.isValid(dep.currentValue)) {
      dep.versioning = pep440Versioning.id;
    } else if (poetryVersioning.isValid(dep.currentValue)) {
      dep.versioning = poetryVersioning.id;
    } else {
      dep.skipReason = SkipReason.UnknownVersion;
    }
    deps.push(dep);
  });
  return deps;
}

function extractRegistries(pyprojectfile: PoetryFile): string[] {
  const sources = pyprojectfile.tool?.poetry?.source;

  if (!Array.isArray(sources) || sources.length === 0) {
    return null;
  }

  const registryUrls = new Set<string>();
  for (const source of sources) {
    if (source.url) {
      registryUrls.add(source.url);
    }
  }
  registryUrls.add(process.env.PIP_INDEX_URL || 'https://pypi.org/pypi/');

  return Array.from(registryUrls);
}

export async function extractPackageFile(
  content: string,
  fileName: string
): Promise<PackageFile | null> {
  logger.trace(`poetry.extractPackageFile(${fileName})`);
  let pyprojectfile: PoetryFile;
  try {
    pyprojectfile = parse(content);
  } catch (err) {
    logger.debug({ err }, 'Error parsing pyproject.toml file');
    return null;
  }
  if (!pyprojectfile.tool?.poetry) {
    logger.debug(`${fileName} contains no poetry section`);
    return null;
  }

  // handle the lockfile
  const lockfileName = getSiblingFileName(fileName, 'poetry.lock');
  const lockContents = await readLocalFile(lockfileName, 'utf8');

  let poetryLockfile: PoetryLock;
  try {
    poetryLockfile = parse(lockContents);
  } catch (err) {
    logger.debug({ err }, 'Error parsing pyproject.toml file');
  }

  const lockfileMapping: Record<string, PoetryLockSection> = {};
  if (poetryLockfile?.package) {
    // Create a package->PoetryLockSection mapping
    for (const poetryPackage of poetryLockfile.package) {
      lockfileMapping[poetryPackage.name] = poetryPackage;
    }
  }

  const deps = [
    ...extractFromSection(pyprojectfile, 'dependencies', lockfileMapping),
    ...extractFromSection(pyprojectfile, 'dev-dependencies', lockfileMapping),
    ...extractFromSection(pyprojectfile, 'extras', lockfileMapping),
  ];
  if (!deps.length) {
    return null;
  }

  const constraints: Record<string, any> = {};

  // https://python-poetry.org/docs/pyproject/#poetry-and-pep-517
  if (
    pyprojectfile['build-system']?.['build-backend'] === 'poetry.masonry.api'
  ) {
    constraints.poetry = pyprojectfile['build-system']?.requires.join(' ');
  }

  if (is.nonEmptyString(pyprojectfile.tool?.poetry?.dependencies?.python)) {
    constraints.python = pyprojectfile.tool?.poetry?.dependencies?.python;
  }

  const res: PackageFile = {
    deps,
    registryUrls: extractRegistries(pyprojectfile),
    constraints,
  };
  // Try poetry.lock first
  let lockFile = getSiblingFileName(fileName, 'poetry.lock');
  // istanbul ignore next
  if (await localPathExists(lockFile)) {
    res.lockFiles = [lockFile];
  } else {
    // Try pyproject.lock next
    lockFile = getSiblingFileName(fileName, 'pyproject.lock');
    if (await localPathExists(lockFile)) {
      res.lockFiles = [lockFile];
    }
  }
  return res;
}
