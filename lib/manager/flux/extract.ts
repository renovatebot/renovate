import { loadAll } from 'js-yaml';
import { HelmDatasource } from '../../datasource/helm';
import { logger } from '../../logger';
import { readLocalFile } from '../../util/fs';
import type { ExtractConfig, PackageDependency, PackageFile } from '../types';
import type {
  FluxManifest,
  FluxResource,
  HelmRelease,
  HelmRepository,
} from './types';

function readManifest(content: string): FluxManifest | null {
  const manifest: FluxManifest = { releases: [], repositories: [] };
  let resources: FluxResource[];
  try {
    resources = loadAll(content, null, { json: true }) as FluxResource[];
  } catch (err) {
    logger.debug({ err }, 'Failed to parse Flux manifest');
    return null;
  }

  // It's possible there are other non-Flux HelmRelease/HelmRepository CRs out there, so we filter based on apiVersion.
  for (const resource of resources) {
    switch (resource?.kind) {
      case 'HelmRelease':
        if (
          resource.apiVersion?.startsWith('helm.toolkit.fluxcd.io/') &&
          resource.spec?.chart?.spec?.chart
        ) {
          manifest.releases.push(resource);
        }
        break;
      case 'HelmRepository':
        if (
          resource.apiVersion?.startsWith('source.toolkit.fluxcd.io/') &&
          resource.metadata?.name &&
          resource.metadata.namespace &&
          resource.spec?.url
        ) {
          manifest.repositories.push(resource);
        }
        break;
    }
  }

  return manifest;
}

function resolveReleases(
  releases: HelmRelease[],
  repositories: HelmRepository[]
): PackageDependency[] {
  return releases.map((release) => {
    const res: PackageDependency = {
      depName: release.spec.chart.spec.chart,
      currentValue: release.spec.chart.spec.version,
    };

    const matchingRepositories = repositories.filter(
      (rep) =>
        rep.kind === release.spec.chart.spec.sourceRef?.kind &&
        rep.metadata.name === release.spec.chart.spec.sourceRef.name &&
        rep.metadata.namespace ===
          (release.spec.chart.spec.sourceRef.namespace ||
            release.metadata?.namespace)
    );
    if (matchingRepositories.length) {
      res.registryUrls = matchingRepositories.map((repo) => repo.spec.url);
    } else {
      res.skipReason = 'unknown-registry';
    }

    return res;
  });
}

export function extractPackageFile(content: string): PackageFile | null {
  const manifest = readManifest(content);
  if (!manifest) {
    return null;
  }
  const deps = resolveReleases(manifest.releases, manifest.repositories);
  return deps.length ? { deps: deps, datasource: HelmDatasource.id } : null;
}

export async function extractAllPackageFiles(
  _config: ExtractConfig,
  packageFiles: string[]
): Promise<PackageFile[] | null> {
  const releases = new Map<string, HelmRelease[]>();
  const repositories: HelmRepository[] = [];
  const results: PackageFile[] = [];

  for (const file of packageFiles) {
    const content = await readLocalFile(file, 'utf8');
    const manifest = readManifest(content);
    if (manifest) {
      releases.set(file, manifest.releases);
      repositories.push(...manifest.repositories);
    }
  }

  for (const file of releases) {
    const deps = resolveReleases(file[1], repositories);
    if (deps.length) {
      results.push({
        packageFile: file[0],
        deps: deps,
        datasource: HelmDatasource.id,
      });
    }
  }

  return results.length ? results : null;
}
