import { isFalsy } from '@sindresorhus/is';
import { readLocalFile } from '../../../util/fs/index.ts';
import { parseYaml } from '../../../util/yaml.ts';
import { GlasskubePackagesDatasource } from '../../datasource/glasskube-packages/index.ts';
import type {
  ExtractConfig,
  PackageDependency,
  PackageFile,
  PackageFileContent,
} from '../types.ts';
import {
  GlasskubeResource,
  type Package,
  type PackageRepository,
} from './schema.ts';
import type { GlasskubeResources } from './types.ts';

function parseResources(
  content: string,
  packageFile: string,
): GlasskubeResources {
  const resources: GlasskubeResource[] = parseYaml(content, {
    customSchema: GlasskubeResource,
    failureBehaviour: 'filter',
  });

  const packages: Package[] = [];
  const repositories: PackageRepository[] = [];

  for (const resource of resources) {
    if (resource.kind === 'PackageRepository') {
      repositories.push(resource);
    } else {
      // the schema parses no kind other than `Package` and `ClusterPackage`
      packages.push(resource);
    }
  }

  return { packageFile, repositories, packages };
}

function resolvePackageDependencies(
  packages: Package[],
  repositories: PackageRepository[],
): PackageDependency[] {
  const deps: PackageDependency[] = [];
  for (const pkg of packages) {
    const dep: PackageDependency = {
      depName: pkg.spec.packageInfo.name,
      currentValue: pkg.spec.packageInfo.version,
      datasource: GlasskubePackagesDatasource.id,
    };

    const repository = findRepository(
      pkg.spec.packageInfo.repositoryName ?? null,
      repositories,
    );

    if (repository === null) {
      dep.skipReason = 'unknown-registry';
    } else {
      dep.registryUrls = [repository.spec.url];
    }

    deps.push(dep);
  }
  return deps;
}

function findRepository(
  name: string | null,
  repositories: PackageRepository[],
): PackageRepository | null {
  for (const repository of repositories) {
    if (name === repository.metadata.name) {
      return repository;
    }
    // v8 ignore else -- needs a manifest whose repositories match no name
    if (isFalsy(name) && isDefaultRepository(repository)) {
      return repository;
    }
  }
  return null;
}

function isDefaultRepository(repository: PackageRepository): boolean {
  return (
    repository.metadata.annotations?.[
      'packages.glasskube.dev/default-repository'
    ] === 'true'
  );
}

export function extractPackageFile(
  content: string,
  packageFile: string,
  _config?: ExtractConfig,
): PackageFileContent | null {
  const { packages, repositories } = parseResources(content, packageFile);
  const deps = resolvePackageDependencies(packages, repositories);
  return { deps };
}

export async function extractAllPackageFiles(
  _config: ExtractConfig,
  packageFiles: string[],
): Promise<PackageFile[] | null> {
  const allRepositories: PackageRepository[] = [];
  const glasskubeResourceFiles: GlasskubeResources[] = [];
  for (const packageFile of packageFiles) {
    const content = await readLocalFile(packageFile, 'utf8');
    // v8 ignore else -- needs a listed package file that cannot be read
    if (content !== null) {
      const resources = parseResources(content, packageFile);
      allRepositories.push(...resources.repositories);
      glasskubeResourceFiles.push(resources);
    }
  }

  const result: PackageFile[] = [];
  for (const file of glasskubeResourceFiles) {
    const deps = resolvePackageDependencies(file.packages, allRepositories);
    if (deps.length > 0) {
      result.push({ packageFile: file.packageFile, deps });
    }
  }
  return result.length ? result : null;
}
