import { z } from 'zod/v3';
import { logger } from '../../../logger/index.ts';
import { Json } from '../../../util/schema-utils/index.ts';
import { VcpkgDatasource } from '../../datasource/vcpkg/index.ts';
import * as vcpkgVersioning from '../../versioning/vcpkg/index.ts';
import type { PackageDependency, PackageFileContent } from '../types.ts';

const DependencyObject = z.object({
  name: z.string(),
  'version>=': z.string().optional(),
});

const DependencyEntry = z.union([z.string(), DependencyObject]);

const OverrideEntry = z.object({
  name: z.string(),
  version: z.string().optional(),
  'version-semver': z.string().optional(),
  'version-date': z.string().optional(),
  'version-string': z.string().optional(),
  'port-version': z.number().int().nonnegative().optional(),
});

const VcpkgManifest = Json.pipe(
  z.object({
    version: z.string().optional(),
    'version-semver': z.string().optional(),
    'version-date': z.string().optional(),
    'version-string': z.string().optional(),
    dependencies: z.array(DependencyEntry).optional(),
    overrides: z.array(OverrideEntry).optional(),
  }),
);

export function extractPackageFile(
  content: string,
  packageFile: string,
): PackageFileContent | null {
  const result = VcpkgManifest.safeParse(content);
  if (!result.success) {
    logger.debug(
      { err: result.error, packageFile },
      'vcpkg: failed to parse vcpkg.json',
    );
    return null;
  }
  const manifest = result.data;

  const deps: PackageDependency[] = [];

  for (const entry of manifest.dependencies ?? []) {
    if (typeof entry === 'string') {
      deps.push({
        depName: entry,
        depType: 'dependencies',
        datasource: VcpkgDatasource.id,
        versioning: vcpkgVersioning.id,
        skipReason: 'unspecified-version',
      });
      continue;
    }

    const dep: PackageDependency = {
      depName: entry.name,
      depType: 'dependencies',
      datasource: VcpkgDatasource.id,
      versioning: vcpkgVersioning.id,
    };
    const lowerBound = entry['version>='];
    if (lowerBound) {
      dep.currentValue = lowerBound;
    } else {
      dep.skipReason = 'unspecified-version';
    }
    deps.push(dep);
  }

  for (const entry of manifest.overrides ?? []) {
    const upstream =
      entry.version ??
      entry['version-semver'] ??
      entry['version-date'] ??
      entry['version-string'];
    if (!upstream) {
      continue;
    }
    const portVersion = entry['port-version'] ?? 0;
    const currentValue =
      portVersion > 0 ? `${upstream}#${portVersion}` : upstream;
    deps.push({
      depName: entry.name,
      depType: 'overrides',
      currentValue,
      datasource: VcpkgDatasource.id,
      versioning: vcpkgVersioning.id,
    });
  }

  if (deps.length === 0) {
    return null;
  }

  const packageFileContent: PackageFileContent = { deps };
  const packageFileVersion =
    manifest.version ??
    manifest['version-semver'] ??
    manifest['version-date'] ??
    manifest['version-string'];
  if (packageFileVersion) {
    packageFileContent.packageFileVersion = packageFileVersion;
  }
  return packageFileContent;
}
