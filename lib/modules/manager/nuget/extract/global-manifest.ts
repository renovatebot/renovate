import { logger } from '../../../../logger';
import { DotnetDatasource } from '../../../datasource/dotnet';
import { NugetDatasource } from '../../../datasource/nuget';
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
    logger.debug(`Invalid JSON in ${packageFile}`);
    return null;
  }

  if (!manifest['msbuild-sdks'] && !manifest.sdk?.version) {
    logger.debug(
      { fileName: packageFile },
      'This global.json is not a Nuget file'
    );
    return null;
  }

  if (manifest.sdk?.version) {
    deps.push({
      depType: 'dotnet-sdk',
      depName: 'dotnet-sdk',
      currentValue: manifest.sdk?.version,
      datasource: DotnetDatasource.id,
    });
  }

  if (manifest['msbuild-sdks']) {
    for (const depName of Object.keys(manifest['msbuild-sdks'])) {
      const currentValue = manifest['msbuild-sdks'][depName];
      const dep: PackageDependency = {
        depType: 'msbuild-sdk',
        depName,
        currentValue,
        datasource: NugetDatasource.id,
      };

      deps.push(dep);
    }
  }

  return { deps };
}
