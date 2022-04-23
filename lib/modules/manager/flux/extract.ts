import { loadAll } from 'js-yaml';
import { logger } from '../../../logger';
import { readLocalFile } from '../../../util/fs';
import { regEx } from '../../../util/regex';
import { GithubReleasesDatasource } from '../../datasource/github-releases';
import { HelmDatasource } from '../../datasource/helm';
import type { ExtractConfig, PackageDependency, PackageFile } from '../types';
import { isSystemManifest } from './common';
import type { FluxManifest, FluxResource, ResourceFluxManifest } from './types';

function readManifest(content: string, file: string): FluxManifest | null {
  if (isSystemManifest(file)) {
    const versionMatch = regEx(
      /#\s*Flux\s+Version:\s*(\S+)(?:\s*#\s*Components:\s*([A-Za-z,-]+))?/
    ).exec(content);
    if (!versionMatch) {
      return null;
    }
    return {
      kind: 'system',
      file: file,
      version: versionMatch[1],
      components: versionMatch[2],
    };
  }

  const manifest: FluxManifest = {
    kind: 'resource',
    file: file,
    releases: [],
    repositories: [],
  };
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

function resolveManifest(
  manifest: FluxManifest,
  context: FluxManifest[]
): PackageDependency[] | null {
  const resourceManifests = context.filter(
    (manifest) => manifest.kind === 'resource'
  ) as ResourceFluxManifest[];
  const repositories = resourceManifests.flatMap(
    (manifest) => manifest.repositories
  );
  let res: PackageDependency[] | null = null;
  switch (manifest.kind) {
    case 'system':
      res = [
        {
          depName: 'fluxcd/flux2',
          datasource: GithubReleasesDatasource.id,
          currentValue: manifest.version,
          managerData: {
            components: manifest.components,
          },
        },
      ];
      break;
    case 'resource':
      res = manifest.releases.map((release) => {
        const dep: PackageDependency = {
          depName: release.spec.chart.spec.chart,
          currentValue: release.spec.chart.spec.version,
          datasource: HelmDatasource.id,
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
          dep.registryUrls = matchingRepositories.map((repo) => repo.spec.url);
        } else {
          dep.skipReason = 'unknown-registry';
        }

        return dep;
      });
      break;
  }

  return res;
}

export function extractPackageFile(
  content: string,
  packageFile: string
): PackageFile | null {
  const manifest = readManifest(content, packageFile);
  if (!manifest) {
    return null;
  }
  const deps = resolveManifest(manifest, [manifest]);
  return deps?.length ? { deps: deps } : null;
}

export async function extractAllPackageFiles(
  _config: ExtractConfig,
  packageFiles: string[]
): Promise<PackageFile[] | null> {
  const manifests: FluxManifest[] = [];
  const results: PackageFile[] = [];

  for (const file of packageFiles) {
    const content = await readLocalFile(file, 'utf8');
    const manifest = readManifest(content, file);
    if (manifest) {
      manifests.push(manifest);
    }
  }

  for (const manifest of manifests) {
    const deps = resolveManifest(manifest, manifests);
    if (deps?.length) {
      results.push({
        packageFile: manifest.file,
        deps: deps,
      });
    }
  }

  return results.length ? results : null;
}
