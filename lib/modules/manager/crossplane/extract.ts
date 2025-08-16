import { logger } from '../../../logger';
import { parseYaml } from '../../../util/yaml';
import { getDep } from '../dockerfile/extract';
import type {
  ExtractConfig,
  PackageDependency,
  PackageFileContent,
} from '../types';
import { XPKG } from './schema';

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

  // not try and catching this as failureBehaviour is set to filter and therefore it will not throw
  const list = parseYaml(content, {
    customSchema: XPKG,
    failureBehaviour: 'filter',
  });

  const deps: PackageDependency[] = [];
  for (const xpkg of list) {
    const dep = getDep(xpkg.spec.package, true, extractConfig?.registryAliases);
    dep.depType = xpkg.kind.toLowerCase();
    deps.push(dep);
  }

  return deps.length ? { deps } : null;
}
