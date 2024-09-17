import is from '@sindresorhus/is';
import { readLocalFile } from '../../../util/fs';
import { parseYaml } from '../../../util/yaml';
import { GlasskubePackagesDatasource } from '../../datasource/glasskube-packages';
import type {
  ExtractConfig,
  PackageDependency,
  PackageFile,
  PackageFileContent,
} from '../types';
import {
  GlasskubeResource,
  type Package,
  type PackageRepository,
} from './schema';
import type { GlasskubeResources } from './types';

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
    if (resource.kind === 'ClusterPackage' || resource.kind === 'Package') {
      packages.push(resource);
    } else if (resource.kind === 'PackageRepository') {
      repositories.push(resource);
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
    if (is.falsy(name) && isDefaultRepository(repository)) {
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
  config?: ExtractConfig,
): PackageFileContent | null {
  const { packages, repositories } = parseResources(content, packageFile);
  const deps = resolvePackageDependencies(packages, repositories);
  return { deps };
}

export async function extractAllPackageFiles(
  config: ExtractConfig,
  packageFiles: string[],
): Promise<PackageFile[] | null> {
  const allRepositories: PackageRepository[] = [];
  const glasskubeResourceFiles: GlasskubeResources[] = [];
  for (const packageFile of packageFiles) {
    const content = await readLocalFile(packageFile, 'utf8');
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
