import { loadAll } from 'js-yaml';
import { logger } from '../../../logger';
import { getDep } from '../dockerfile/extract';
import type {
  ExtractConfig,
  PackageDependency,
  PackageFileContent,
} from '../types';
import { XPKGSchema } from './schema';

export function extractPackageFile(
  content: string,
  packageFile: string,
  extractConfig?: ExtractConfig,
): PackageFileContent | null {
  // avoid parsing the whole file if it doesn't contain any resource having any pkg.crossplane.io/v*
  if (!/apiVersion:\s+["']?pkg\.crossplane\.io\/v.+["']?/.test(content)) {
    logger.trace({ packageFile }, 'No Crossplane package found in file.');
    return null;
  }

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

  const deps: PackageDependency[] = [];
  for (const item of list) {
    const parsed = XPKGSchema.safeParse(item);
    if (!parsed.success) {
      logger.trace(
        { item, errors: parsed.error },
        'Invalid Crossplane package',
      );
      continue;
    }
    const xpkg = parsed.data;
    const dep = getDep(xpkg.spec.package, true, extractConfig?.registryAliases);
    dep.depType = xpkg.kind.toLowerCase();
    deps.push(dep);
  }

  return deps.length ? { deps } : null;
}
