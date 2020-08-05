import { safeLoad } from 'js-yaml';
import * as datasourceDart from '../../datasource/dart';
import { logger } from '../../logger';
import { SkipReason } from '../../types';
import { PackageDependency, PackageFile } from '../common';

function getDeps(
  depsObj: { [x: string]: any },
  preset: { depType: string }
): PackageDependency[] {
  if (!depsObj) {
    return [];
  }
  return Object.keys(depsObj).reduce((acc, depName) => {
    if (depName === 'meta') {
      return acc;
    }

    const section = depsObj[depName];

    let currentValue: string | null = null;
    if (section?.version) {
      currentValue = section.version.toString();
    } else if (section) {
      if (typeof section === 'string') {
        currentValue = section;
      }
      if (typeof section === 'number') {
        currentValue = section.toString();
      }
    }

    const dep: PackageDependency = { ...preset, depName, currentValue };
    if (!currentValue) {
      dep.skipReason = SkipReason.NotAVersion;
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
        datasource: datasourceDart.id,
        deps,
      };
    }
  } catch (e) {
    logger.debug({ packageFile }, 'Can not parse dependency');
  }
  return null;
}
