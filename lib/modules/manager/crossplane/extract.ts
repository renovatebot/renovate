import { logger } from '../../../logger/index.ts';
import { parseYaml } from '../../../util/yaml.ts';
import { getDep } from '../dockerfile/extract.ts';
import type {
  ExtractConfig,
  PackageDependency,
  PackageFileContent,
} from '../types.ts';
import type { CrossplaneDepType } from './dep-types.ts';
import { XPKG } from './schema.ts';

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

  const deps: PackageDependency<Record<string, any>, CrossplaneDepType>[] = [];
  for (const xpkg of list) {
    const dep: PackageDependency<Record<string, any>, CrossplaneDepType> = {
      ...getDep(xpkg.spec.package, true, extractConfig?.registryAliases),
      depType: xpkg.kind.toLowerCase() as CrossplaneDepType,
    };
    deps.push(dep);
  }

  return deps.length ? { deps } : null;
}
