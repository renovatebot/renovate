import { PuppetDatasource } from '../../datasource/puppet';
import type { ExtractConfig, PackageDependency, PackageFile } from '../types';

export async function extractAllPackageFiles(
  _config: ExtractConfig,
  packageFiles: string[]
): Promise<PackageFile[]> {
  const dep: PackageDependency = {
    depName: 'test',
    currentRawValue: '1.0.0',
    currentVersion: '1.0.0',
    datasource: PuppetDatasource.id,
    packageName: 'test.package',
    currentValue: '1.0.0',
    extractVersion: '1.0.0',
    registryUrls: ['https://forgeapi.puppet.com'],
    fileReplacePosition: 13,
  };

  const deps: PackageDependency[] = [];
  deps.push(dep);

  const packageFile: PackageFile = {
    deps,
    packageFile: 'Puppetfile',
  };

  const f: PackageFile[] = [];
  f.push(packageFile);

  return f;
}
