import is from '@sindresorhus/is';
import { loadAll } from 'js-yaml';
import { logger } from '../../../logger';
import { getDep } from '../dockerfile/extract';
import type {
  ExtractConfig,
  PackageDependency,
  PackageFileContent,
} from '../types';
import type { XPKG } from './schema';

export function extractPackageFile(
  content: string,
  packageFile: string,
  extractConfig?: ExtractConfig,
): PackageFileContent | null {
  let definitions: XPKG[];
  try {
    definitions = loadAll(content) as XPKG[];
  } catch (err) {
    logger.debug(
      { err, packageFile },
      'Failed to parse Crossplane definition.',
    );
    return null;
  }

  const deps = definitions
    .filter(is.plainObject)
    .flatMap((definition) =>
      processPackageSpec(definition, extractConfig?.registryAliases),
    );

  return deps.length ? { deps } : null;
}

function processPackageSpec(
  xpkg: XPKG,
  registryAliases?: Record<string, string>,
): PackageDependency[] {
  const source = xpkg.spec?.package;
  if (!source) {
    return [];
  }

  const deps: (PackageDependency | null)[] = [];

  const dep = getDep(source, true, registryAliases);
  dep.depType = 'docker';
  deps.push(dep);

  return deps.filter(is.truthy);
}
