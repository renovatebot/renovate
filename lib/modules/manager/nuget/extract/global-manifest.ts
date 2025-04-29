import { logger } from '../../../../logger';
import { DotnetVersionDatasource } from '../../../datasource/dotnet-version';
import { NugetDatasource } from '../../../datasource/nuget';
import type { PackageDependency, PackageFileContent } from '../../types';
import { GlobalJson } from '../schema';
import type { NugetPackageDependency, Registry } from '../types';
import { applyRegistries } from '../util';

export function extractMsbuildGlobalManifest(
  content: string,
  packageFile: string,
  registries: Registry[] | undefined,
): PackageFileContent | null {
  const deps: PackageDependency[] = [];
  let manifest: GlobalJson;
  let extractedConstraints: Record<string, string> | undefined;
  try {
    manifest = GlobalJson.parse(content);
  } catch {
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

    extractedConstraints = { 'dotnet-sdk': manifest.sdk?.version };
  }

  if (manifest['msbuild-sdks']) {
    for (const depName of Object.keys(manifest['msbuild-sdks'])) {
      const currentValue = manifest['msbuild-sdks'][depName];
      const dep: NugetPackageDependency = {
        depType: 'msbuild-sdk',
        depName,
        currentValue,
        datasource: NugetDatasource.id,
      };

      applyRegistries(dep, registries);

      deps.push(dep);
    }
  }

  return { deps, ...(extractedConstraints && { extractedConstraints }) };
}
