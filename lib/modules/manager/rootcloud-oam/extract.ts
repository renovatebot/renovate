import { load } from 'js-yaml';
import { logger } from '../../../logger';
import { NpmDatasource } from '../../datasource/npm';
import type { PackageDependency, PackageFile } from '../types';

export function extractPackageFile(content: string): PackageFile | null {
  let deps: PackageDependency[] = [];
  let npmDepends = null;
  try {
    const parsedContent: any = load(content);
    npmDepends = parsedContent.spec.services;
  } catch (err) {
    logger.error({ err }, 'Failed to parse apps/versions.yaml.');
    return null;
  }

  if (!npmDepends) {
    return null;
  }
  try {
    deps = Object.entries(npmDepends)
      .filter(
        (elem) =>
          (elem[1] as any).packageName &&
          (elem[1] as any).image &&
          (elem[1] as any).image.tag
      )
      .map((elem) => {
        return {
          depName: (elem[1] as any).packageName,
          currentValue: (elem[1] as any).image.tag,
          datasource: NpmDatasource.id,
        };
      });
  } catch (err) /* istanbul ignore next */ {
    logger.warn({ content }, 'Failed to parse meteor package.js');
  }
  // istanbul ignore if
  if (!deps.length) {
    return null;
  }
  return { deps };
}
