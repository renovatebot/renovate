import { load } from 'js-yaml';
import { logger } from '../../../logger';
import { DartDatasource } from '../../datasource/dart';
import type { PackageDependency, PackageFile } from '../types';

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

    return [...acc, dep];
  }, [] as PackageDependency[]);
}

export function extractPackageFile(
  content: string,
  packageFile: string
): PackageFile | null {
  try {
    // TODO: fix me (#9610)
    const doc = load(content, { json: true }) as any;
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
        datasource: DartDatasource.id,
        deps,
      };
    }
  } catch (e) {
    logger.debug(`Could not parse dependency from ${packageFile}`);
  }
  return null;
}
