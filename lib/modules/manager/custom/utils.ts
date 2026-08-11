import { isNonEmptyStringAndNotWhitespace } from '@sindresorhus/is';
import { logger } from '../../../logger/index.ts';
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
  // packageName and depName are not modified if registryUrls exist
  // because registryUrls will be used instead of dep/packageName
  if (dep.registryUrls) {
    dep.registryUrls = dep.registryUrls.map((s) => {
      for (const [original, replace] of Object.entries(registryAliases ?? {})) {
        if (s.startsWith(original)) {
          return replace + s.slice(original.length);
        }
      }
      return s;
    });
  } else if (dep.packageName) {
    for (const [original, replace] of Object.entries(registryAliases ?? {})) {
      if (dep.packageName.startsWith(original)) {
        dep.packageName = replace + dep.packageName.slice(original.length);
        break;
      }
    }
  } else if (dep.depName) {
    for (const [original, replace] of Object.entries(registryAliases ?? {})) {
      if (dep.depName?.startsWith(original)) {
        dep.packageName = replace + dep.depName.slice(original.length);
        break;
      }
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
