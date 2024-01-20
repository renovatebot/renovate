import assert from 'assert';
import { parse as parseToml } from '../../../util/toml';
import type { PackageDependency, PackageFileContent } from '../types';

type GleamToml = {
  name: string;
  dependencies?: Record<string, string>;
  ['dev-dependencies']?: Record<string, string>;
};

function parseGleamToml(gleamTomlString: string): GleamToml {
  const toml = parseToml(gleamTomlString) as GleamToml;
  assert(toml, 'invalid toml');
  assert(typeof toml.name === 'string');
  return toml;
}

function toPackageDep({
  name,
  version,
  dev,
}: {
  name: string;
  version: string;
  dev: boolean;
}): PackageDependency {
  return {
    depName: name,
    depType: dev ? 'devDependencies' : 'dependencies',
    datasource: 'hex',
    currentValue: version,
  };
}

function extractGleamTomlDeps(gleamToml: GleamToml): PackageDependency[] {
  return [
    ...Object.entries(gleamToml.dependencies ?? {}).map(([name, version]) =>
      toPackageDep({ name, version, dev: false }),
    ),
    ...Object.entries(gleamToml['dev-dependencies'] ?? {}).map(
      ([name, version]) => toPackageDep({ name, version, dev: false }),
    ),
  ];
}

export function extractPackageFile(
  content: string,
  packageFile?: string,
): PackageFileContent | null {
  const deps: PackageDependency[] =
    packageFile === 'gleam.toml'
      ? extractGleamTomlDeps(parseGleamToml(content))
      : [];
  return { deps, lockFiles: ['manifest.toml'] };
}
