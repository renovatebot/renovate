import { parse } from 'toml';
import { logger } from '../../logger';
import { isValid } from '../../versioning/cargo';
import { PackageDependency, PackageFile } from '../common';
import { CargoConfig, CargoSection } from './types';

function extractFromSection(
  parsedContent: CargoSection,
  section: keyof CargoSection,
  target?: string
): PackageDependency[] {
  const deps: PackageDependency[] = [];
  const sectionContent = parsedContent[section];
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
          skipReason = 'path-dependency';
        }
        if (git) {
          skipReason = 'git-dependency';
        }
      } else if (path) {
        currentValue = '';
        skipReason = 'path-dependency';
      } else if (git) {
        currentValue = '';
        skipReason = 'git-dependency';
      } else {
        currentValue = '';
        skipReason = 'invalid-dependency-specification';
      }
    }
    const dep: PackageDependency = {
      depName,
      depType: section,
      currentValue: currentValue as any,
      managerData: { nestedVersion },
      datasource: 'cargo',
    };
    if (skipReason) {
      dep.skipReason = skipReason;
    } else if (!isValid(dep.currentValue)) {
      dep.skipReason = 'unknown-version';
    }
    if (target) {
      dep.target = target;
    }
    deps.push(dep);
  });
  return deps;
}

export function extractPackageFile(
  content: string,
  fileName: string
): PackageFile | null {
  logger.trace(`cargo.extractPackageFile(${fileName})`);
  let parsedContent: CargoConfig;
  try {
    parsedContent = parse(content);
  } catch (err) {
    logger.debug({ err }, 'Error parsing Cargo.toml file');
    return null;
  }
  /*
    There are the following sections in Cargo.toml:
    [dependencies]
    [dev-dependencies]
    [build-dependencies]
    [target.*.dependencies]
  */
  const targetSection = parsedContent.target;
  // An array of all dependencies in the target section
  let targetDeps: PackageDependency[] = [];
  if (targetSection) {
    const targets = Object.keys(targetSection);
    targets.forEach(target => {
      const targetContent = parsedContent.target[target];
      // Dependencies for `${target}`
      const deps = [
        ...extractFromSection(targetContent, 'dependencies', target),
        ...extractFromSection(targetContent, 'dev-dependencies', target),
        ...extractFromSection(targetContent, 'build-dependencies', target),
      ];
      targetDeps = targetDeps.concat(deps);
    });
  }
  const deps = [
    ...extractFromSection(parsedContent, 'dependencies'),
    ...extractFromSection(parsedContent, 'dev-dependencies'),
    ...extractFromSection(parsedContent, 'build-dependencies'),
    ...targetDeps,
  ];
  if (!deps.length) {
    return null;
  }
  return { deps };
}
