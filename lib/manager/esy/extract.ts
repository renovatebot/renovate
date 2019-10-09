import { logger } from '../../logger';
import { PackageDependency, PackageFile } from '../common';
import { EsySection } from './types';

export function extractPackageFile(
  content: string,
  fileName: string
): PackageFile | null {
  logger.trace(`extractPackageFile()`);
  try {
    const doc = JSON.parse(content);
    if (doc.esy) {
      logger.info('esy field is present');
    }
    const deps = [
      ...extractFromSection(doc, 'dependencies'),
      ...extractFromSection(doc, 'devDependencies'),
      ...extractFromSection(doc, 'buildDependencies'),
    ];
    if (deps.length === 0) {
      return null;
    }
    return { deps };
  } catch (err) {
    return null;
  }
}

function extractFromSection(
  parsedContent: EsySection,
  section: keyof EsySection
): PackageDependency[] {
  const deps: PackageDependency[] = [];
  const sectionContent = parsedContent[section];
  if (!sectionContent) {
    return [];
  }
  Object.keys(sectionContent).forEach(depName => {
    const parsedDepName = parseDepName(depName);
    const currentValue = sectionContent[depName];
    if (currentValue) {
      const npmScope = parsedDepName.npmScope;
      const dep: PackageDependency = {
        depName,
        currentValue,
        depType: section,
        datasource: npmScope === 'opam' ? 'opam' : 'npm',
      };
      deps.push(dep);
    }
  });
  return deps;
}

export function parseDepName(depName) {
  const strs = depName.split('/');
  if (strs.length === 1) {
    return {
      depName: strs[0],
    };
  }
  if (strs.length === 2) {
    if (strs[0][0] === '@') {
      strs[0] = strs[0].substring(1);
    } else {
      return null;
    }
    return {
      npmScope: strs[0],
      depName: strs[1],
    };
  }
  return null;
}
