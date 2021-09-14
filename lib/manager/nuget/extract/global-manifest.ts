import * as datasourceNuget from '../../../datasource/nuget';
import { logger } from '../../../logger';
import { SkipReason } from '../../../types';
import type { PackageDependency, PackageFile } from '../../types';
import type { MsbuildGlobalManifest } from '../types';

export function extractMsbuildGlobalManifest(
  content: string,
  packageFile: string
): PackageFile | null {
  const deps: PackageDependency[] = [];
  let manifest: MsbuildGlobalManifest;

  try {
    manifest = JSON.parse(content);
  } catch (err) {
    logger.debug({ fileName: packageFile }, 'Invalid JSON');
    return null;
  }

  if (!manifest['msbuild-sdks'] && (!manifest.sdk || !manifest.sdk.version)) {
    logger.debug(
      { fileName: packageFile },
      'This global.json is not a Nuget file'
    );
    return null;
  }

  for (const depName of Object.keys(manifest['msbuild-sdks'])) {
    const sdk = manifest['msbuild-sdks'][depName];
    const currentValue = sdk[0];
    const dep: PackageDependency = {
      depType: 'nuget',
      depName,
      currentValue,
      datasource: datasourceNuget.id,
      skipReason: SkipReason.UnsupportedDatasource,
    };

    deps.push(dep);
  }

  return { deps };
}
