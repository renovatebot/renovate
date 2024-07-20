import { HexDatasource } from '../../datasource/hex';
import type { PackageDependency, PackageFileContent } from '../types';
import { GleamToml } from './schema';

const dependencySections = ['dependencies', 'dev-dependencies'] as const;

function toPackageDep({
  name,
  sectionKey,
  version,
}: {
  name: string;
  sectionKey: string;
  version: string;
}): PackageDependency {
  return {
    depName: name,
    depType: sectionKey,
    datasource: HexDatasource.id,
    currentValue: version,
  };
}

function toPackageDeps({
  deps,
  sectionKey,
}: {
  deps?: Record<string, string>;
  sectionKey: string;
}): PackageDependency[] {
  return Object.entries(deps ?? {}).map(([name, version]) =>
    toPackageDep({ name, sectionKey, version }),
  );
}

function extractGleamTomlDeps(gleamToml: GleamToml): PackageDependency[] {
  return dependencySections.flatMap((sectionKey) =>
    toPackageDeps({
      deps: gleamToml[sectionKey],
      sectionKey,
    }),
  );
}

export function extractPackageFile(content: string): PackageFileContent | null {
  const deps = extractGleamTomlDeps(GleamToml.parse(content));
  return deps.length ? { deps } : null;
}
