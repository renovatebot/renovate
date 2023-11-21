import is from '@sindresorhus/is';
import { loadAll } from 'js-yaml';
import { logger } from '../../../logger';
import { getDep } from '../dockerfile/extract';
import type {
  ExtractConfig,
  PackageDependency,
  PackageFileContent,
} from '../types';
import type {
  PackageDefinition,
  PackageSpec,
} from './types';
import { fileTestRegex } from './util';

export function extractPackageFile(
  content: string,
  packageFile: string,
  extractConfig?: ExtractConfig,
): PackageFileContent | null {
  // check for crossplane reference. API version for the kind attribute is used
  if (fileTestRegex.test(content) === false) {
    logger.debug(
      `Skip file ${packageFile} as no pkg.crossplane.io apiVersion could be found in matched file`,
    );
    return null;
  }

  let definitions: PackageDefinition[];
  try {
    definitions = loadAll(content) as PackageDefinition[];
  } catch (err) {
    logger.debug({ err, packageFile }, 'Failed to parse Crossplane definition.');
    return null;
  }

  const deps = definitions.filter(is.plainObject).flatMap((definition) => processPackageSpec(definition, extractConfig?.registryAliases));

  return deps.length ? { deps } : null;
}

function processPackageSpec(
  definition: PackageDefinition,
  registryAliases?: Record<string, string>,
): PackageDependency[] {
  const spec: PackageSpec | null | undefined = definition?.spec

  if (is.nullOrUndefined(spec)) {
    return [];
  }

  const deps: (PackageDependency | null)[] = [];

  const dep = getDep(spec.package, true, registryAliases);
  dep.depType = 'docker';
  deps.push(dep);

  return deps.filter(is.truthy);
}
