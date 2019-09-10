import { logger } from '../../logger';
import { PackageDependency, PackageFile } from '../common';
import { EsyDeps, EsySection } from './types';

// NOTE: It looks like esy uses the same dependencies, devDependencies,
// buildDependencies fields in package.json as npm. But package.json also can
// have esy field. Also it uses both npm and opam, so a new datasource might
// be necessary.
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
    const dependencies = doc.dependencies;
    const devDependencies = doc.devDependencies;
    const buildDependencies = doc.buildDependencies;
    const deps = [
      ...extractFromSection(doc, 'dependencies'),
      ...extractFromSection(doc, 'devDependencies'),
      ...extractFromSection(doc, 'buildDependencies'),
    ];
    if (deps.length == 0) {
      return null;
    }
    return { deps };
  } catch (err) {
    return null;
  }
  return null;
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
    const currentValue = sectionContent[depName];
    if (currentValue) {
      const dep: PackageDependency = {
        depName,
        depType: section,
        currentValue: currentValue as any,
        datasource: 'esy',
      };
      deps.push(dep);
    }
  });
  return deps;
}
