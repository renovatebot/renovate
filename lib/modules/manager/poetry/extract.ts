import { parse } from '@iarna/toml';
import is from '@sindresorhus/is';
import { logger } from '../../../logger';
import type { SkipReason } from '../../../types';
import {
  getSiblingFileName,
  localPathExists,
  readLocalFile,
} from '../../../util/fs';
import { PypiDatasource } from '../../datasource/pypi';
import * as pep440Versioning from '../../versioning/pep440';
import * as poetryVersioning from '../../versioning/poetry';
import type { PackageDependency, PackageFile } from '../types';
import { extractLockFileEntries } from './locked-version';
import type { PoetryDependency, PoetryFile, PoetrySection } from './types';

function extractFromSection(
  parsedFile: PoetryFile,
  section: keyof PoetrySection,
  poetryLockfile: Record<string, string>
): PackageDependency[] {
  const deps: PackageDependency[] = [];
  const sectionContent = parsedFile.tool?.poetry[section];
  if (!sectionContent) {
    return [];
  }

  for (const depName of Object.keys(sectionContent)) {
    if (depName === 'python') {
      continue;
    }

    let skipReason: SkipReason = null;
    let currentValue: string | PoetryDependency = sectionContent[depName];
    let nestedVersion = false;
    if (!is.string(currentValue)) {
      const version = currentValue.version;
      const path = currentValue.path;
      const git = currentValue.git;
      if (version) {
        currentValue = version;
        nestedVersion = true;
        if (path || git) {
          skipReason = path ? 'path-dependency' : 'git-dependency';
        }
      } else if (path) {
        currentValue = '';
        skipReason = 'path-dependency';
      } else if (git) {
        currentValue = '';
        skipReason = 'git-dependency';
      } else {
        currentValue = '';
        skipReason = 'multiple-constraint-dep';
      }
    }
    const dep: PackageDependency = {
      depName,
      depType: section,
      currentValue: currentValue,
      managerData: { nestedVersion },
      datasource: PypiDatasource.id,
    };
    if (dep.depName in poetryLockfile) {
      dep.lockedVersion = poetryLockfile[dep.depName];
    }
    if (skipReason) {
      dep.skipReason = skipReason;
    } else if (pep440Versioning.isValid(dep.currentValue)) {
      dep.versioning = pep440Versioning.id;
    } else if (poetryVersioning.isValid(dep.currentValue)) {
      dep.versioning = poetryVersioning.id;
    } else {
      dep.skipReason = 'unknown-version';
    }
    deps.push(dep);
  }
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

  const lockfileMapping = extractLockFileEntries(lockContents);

  const deps = [
    ...extractFromSection(pyprojectfile, 'dependencies', lockfileMapping),
    ...extractFromSection(pyprojectfile, 'dev-dependencies', lockfileMapping),
    ...extractFromSection(pyprojectfile, 'extras', lockfileMapping),
  ];
  if (!deps.length) {
    return null;
  }

  const constraints: Record<string, any> = {};

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
