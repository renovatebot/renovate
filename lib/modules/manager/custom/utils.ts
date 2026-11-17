import { isNonEmptyStringAndNotWhitespace } from '@sindresorhus/is';
import { logger } from '../../../logger/index.ts';
import { coerceObject } from '../../../util/object.ts';
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

export function substituteRegistryAlias(
  s: string,
  registryAliases: Record<string, string> | undefined,
): string {
  for (const [original, replace] of Object.entries(
    coerceObject(registryAliases),
  )) {
    const aliasNotSubstring =
      s.length === original.length ||
      s[original.length] === '/' ||
      original.endsWith('/');
    if (s.startsWith(original) && aliasNotSubstring) {
      return `${replace}${s.slice(original.length)}`;
    }
  }
  return s;
}

export function substituteRegistryAliases(
  dep: PackageDependency,
  registryAliases: Record<string, string> | undefined,
): void {
  // packageName and depName are not modified if registryUrls exist
  // because registryUrls will be used instead of dep/packageName
  if (dep.registryUrls) {
    dep.registryUrls = dep.registryUrls.map((s) => {
      return substituteRegistryAlias(s, registryAliases);
    });
  } else if (dep.packageName) {
    dep.packageName = substituteRegistryAlias(dep.packageName, registryAliases);
  } else if (dep.depName) {
    const replace = substituteRegistryAlias(dep.depName, registryAliases);
    if (replace !== dep.depName) {
      dep.packageName = replace;
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
  const hasName =
    isNonEmptyStringAndNotWhitespace(depName) ||
    isNonEmptyStringAndNotWhitespace(packageName);
  const hasVersion =
    isNonEmptyStringAndNotWhitespace(currentDigest) ||
    isNonEmptyStringAndNotWhitespace(currentValue);
  return hasName && hasVersion && isNonEmptyStringAndNotWhitespace(datasource);
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
