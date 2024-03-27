import { HexDatasource } from '../../datasource/hex';
import type { PackageDependency, PackageFileContent } from '../types';
import { GleamToml } from './schema';

function toPackageDep({
  name,
  version,
  dev,
}: {
  name: string;
  version: string;
  dev?: boolean;
}): PackageDependency {
  return {
    depName: name,
    depType: dev ? 'devDependencies' : 'dependencies',
    datasource: HexDatasource.id,
    currentValue: version,
  };
}

function toPackageDeps({
  deps,
  dev,
}: {
  deps?: Record<string, string>;
  dev?: boolean;
}): PackageDependency[] {
  return Object.entries(deps ?? {}).map(([name, version]) =>
    toPackageDep({ name, version, dev }),
  );
}

function extractGleamTomlDeps(gleamToml: GleamToml): PackageDependency[] {
  return [
    ...toPackageDeps({ deps: gleamToml.dependencies }),
    ...toPackageDeps({
      deps: gleamToml['dev-dependencies'],
      dev: true,
    }),
  ];
}

export function extractPackageFile(content: string): PackageFileContent | null {
  const deps = extractGleamTomlDeps(GleamToml.parse(content));
  /* istanbul ignore next reason: static analysis sufficient */
  return deps.length ? { deps } : null;
}
