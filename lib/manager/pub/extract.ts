import { safeLoad } from 'js-yaml';
import { isValid } from '../../versioning/npm/index';
import { logger } from '../../logger';
import { PackageDependency, PackageFile } from '../common';

function getDeps(
  depsObj: { [x: string]: any },
  preset: { depType: string }
): PackageDependency[] {
  if (!depsObj) return [];
  return Object.keys(depsObj).reduce((acc, depName) => {
    if (depName === 'meta') return acc;

    const section = depsObj[depName];
    let currentValue = null;

    if (section && isValid(section.toString())) {
      currentValue = section.toString();
    }

    if (section.version && isValid(section.version.toString())) {
      currentValue = section.version.toString();
    }

    const dep: PackageDependency = { ...preset, depName, currentValue };
    if (!currentValue) {
      dep.skipReason = 'not-a-version';
    }

    return [...acc, dep];
  }, []);
}

export function extractPackageFile(
  content: string,
  packageFile: string
): PackageFile | null {
  try {
    const doc = safeLoad(content);
    const deps = [
      ...getDeps(doc.dependencies, {
        depType: 'dependencies',
      }),
      ...getDeps(doc.dev_dependencies, {
        depType: 'dev_dependencies',
      }),
    ];

    if (deps.length) {
      return {
        packageFile,
        manager: 'pub',
        datasource: 'dart',
        deps,
      };
    }
  } catch (e) {
    logger.info({ packageFile }, 'Can not parse dependency');
  }
  return null;
}
