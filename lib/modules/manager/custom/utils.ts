import { isNonEmptyStringAndNotWhitespace } from '@sindresorhus/is';
import { logger } from '../../../logger/index.ts';
import { escapeRegExp, regEx } from '../../../util/regex.ts';
import type { PackageDependency } from '../types.ts';

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

export function substituteRegistryAliases(
  dep: PackageDependency,
  registryAliases: Record<string, string> | undefined,
): void {
  for (const [original, replace] of Object.entries(registryAliases ?? {})) {
    const re = regEx(`^${escapeRegExp(original)}`);
    if (dep.registryUrls) {
      dep.registryUrls = dep.registryUrls.map((s) => {
        return s.replace(re, replace);
      });
    } else if (dep.packageName) {
      dep.packageName = dep.packageName.replace(re, replace);
    } else if (dep.depName) {
      dep.packageName = dep.depName.replace(re, replace);
    }
  }
}

export function isValidDependency({
  depName,
  currentValue,
  currentDigest,
  packageName,
  datasource,
}: PackageDependency): boolean {
  // check if all the fields are set
  return (
    (isNonEmptyStringAndNotWhitespace(depName) ||
      isNonEmptyStringAndNotWhitespace(packageName)) &&
    (isNonEmptyStringAndNotWhitespace(currentDigest) ||
      isNonEmptyStringAndNotWhitespace(currentValue)) &&
    isNonEmptyStringAndNotWhitespace(datasource)
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
