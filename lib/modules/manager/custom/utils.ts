import is from '@sindresorhus/is';
import { logger } from '../../../logger';
import type { PackageDependency } from '../types';

export const validMatchFields = [
  'depName',
  'packageName',
  'currentValue',
  'currentDigest',
  'datasource',
  'versioning',
  'extractVersion',
  'registryUrl',
  'depType',
  'indentation',
] as const;

export type ValidMatchFields = (typeof validMatchFields)[number];

export function isValidDependency({
  depName,
  currentValue,
  currentDigest,
  packageName,
  datasource,
}: PackageDependency): boolean {
  // check if all the fields are set
  return (
    (is.nonEmptyStringAndNotWhitespace(depName) ||
      is.nonEmptyStringAndNotWhitespace(packageName)) &&
    (is.nonEmptyStringAndNotWhitespace(currentDigest) ||
      is.nonEmptyStringAndNotWhitespace(currentValue)) &&
    is.nonEmptyStringAndNotWhitespace(datasource)
  );
}

export function checkIsValidDependency(
  dep: PackageDependency,
  packageFile: string,
  manager: string,
): boolean {
  const isValid = isValidDependency(dep);
  if (!isValid) {
    const meta = {
      packageDependency: dep,
      packageFile,
      manager,
    };
    logger.trace(
      meta,
      'Discovered a package dependency, but it did not pass validation. Discarding',
    );
    return isValid;
  }

  return isValid;
}
