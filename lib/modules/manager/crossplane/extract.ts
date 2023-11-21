import is from '@sindresorhus/is';
import { loadAll } from 'js-yaml';
import { logger } from '../../../logger';
import { getDep } from '../dockerfile/extract';
import type {
  ExtractConfig,
  PackageDependency,
  PackageFileContent,
} from '../types';
import { XPKGSchema } from './schema';
import type { XPKG } from './schema';

export function extractPackageFile(
  content: string,
  packageFile: string,
  extractConfig?: ExtractConfig,
): PackageFileContent | null {
  let list = [];
  try {
    list = loadAll(content);
  } catch (err) {
    logger.debug(
      { err, packageFile },
      'Failed to parse Crossplane package file.',
    );
    return null;
  }

  const xpkgs: XPKG[] = [];
  for (const item of list) {
    const parsed = XPKGSchema.safeParse(item);
    if (!parsed.success) {
      continue;
    }
    xpkgs.push(parsed.data);
  }

  const deps = xpkgs
    .filter(is.plainObject)
    .flatMap((xpkg) =>
      processPackageSpec(xpkg, extractConfig?.registryAliases),
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
