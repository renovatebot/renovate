import { parse } from 'toml';
import { isValid } from '../../versioning/poetry';
import { logger } from '../../logger';
import { PackageFile, PackageDependency } from '../common';
import { PoetryFile, PoetrySection } from './types';
import * as datasourcePypi from '../../datasource/pypi';
import { SkipReason } from '../../types';

function extractFromSection(
  parsedFile: PoetryFile,
  section: keyof PoetrySection
): PackageDependency[] {
  const deps = [];
  const sectionContent = parsedFile.tool.poetry[section];
  if (!sectionContent) {
    return [];
  }
  Object.keys(sectionContent).forEach(depName => {
    let skipReason: string;
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
          skipReason = SkipReason.PATH_DEPENDENCY;
        }
        if (git) {
          skipReason = SkipReason.GIT_DEPENDENCY;
        }
      } else if (path) {
        currentValue = '';
        skipReason = SkipReason.PATH_DEPENDENCY;
      } else if (git) {
        currentValue = '';
        skipReason = SkipReason.GIT_DEPENDENCY;
      } else {
        currentValue = '';
        skipReason = SkipReason.MULTIPLE_CONSTRAINT_DEP;
      }
    }
    const dep: PackageDependency = {
      depName,
      depType: section,
      currentValue: currentValue as string,
      managerData: { nestedVersion },
      datasource: datasourcePypi.id,
    };
    if (skipReason) {
      dep.skipReason = skipReason;
    } else if (!isValid(dep.currentValue)) {
      dep.skipReason = SkipReason.UNKNOWN_VERSION;
    }
    deps.push(dep);
  });
  return deps;
}

function extractRegistries(pyprojectfile: PoetryFile): string[] {
  const sources =
    pyprojectfile.tool &&
    pyprojectfile.tool.poetry &&
    pyprojectfile.tool.poetry.source;

  if (!Array.isArray(sources) || sources.length === 0) {
    return null;
  }

  const registryUrls = new Set<string>();
  for (const source of sources) {
    if (source.url) {
      registryUrls.add(source.url);
    }
  }
  registryUrls.add('https://pypi.org/pypi/');

  return Array.from(registryUrls);
}

export function extractPackageFile(
  content: string,
  fileName: string
): PackageFile | null {
  logger.trace(`poetry.extractPackageFile(${fileName})`);
  let pyprojectfile: PoetryFile;
  try {
    pyprojectfile = parse(content);
  } catch (err) {
    logger.debug({ err }, 'Error parsing pyproject.toml file');
    return null;
  }
  if (!(pyprojectfile.tool && pyprojectfile.tool.poetry)) {
    logger.debug(`${fileName} contains no poetry section`);
    return null;
  }
  const deps = [
    ...extractFromSection(pyprojectfile, 'dependencies'),
    ...extractFromSection(pyprojectfile, 'dev-dependencies'),
    ...extractFromSection(pyprojectfile, 'extras'),
  ];
  if (!deps.length) {
    return null;
  }

  return { deps, registryUrls: extractRegistries(pyprojectfile) };
}
