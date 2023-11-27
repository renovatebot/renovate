import { logger } from '../../../../logger';
import { DotnetVersionDatasource } from '../../../datasource/dotnet-version';
import { NugetDatasource } from '../../../datasource/nuget';
import type { PackageDependency, PackageFileContent } from '../../types';
import type { MsbuildGlobalManifest } from '../types';

export function extractMsbuildGlobalManifest(
  content: string,
  packageFile: string,
): PackageFileContent | null {
  const deps: PackageDependency[] = [];
  let manifest: MsbuildGlobalManifest;

  try {
    manifest = JSON.parse(content);
  } catch (err) {
    logger.debug({ packageFile }, `Invalid JSON`);
    return null;
  }

  if (!manifest['msbuild-sdks'] && !manifest.sdk?.version) {
    logger.debug({ packageFile }, 'This global.json is not a Nuget file');
    return null;
  }

  if (manifest.sdk?.version) {
    deps.push({
      depType: 'dotnet-sdk',
      depName: 'dotnet-sdk',
      currentValue: manifest.sdk?.version,
      datasource: DotnetVersionDatasource.id,
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
