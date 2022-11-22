import { loadAll } from 'js-yaml';
import { logger } from '../../../logger';
import { readLocalFile } from '../../../util/fs';
import { regEx } from '../../../util/regex';
import { BitBucketTagsDatasource } from '../../datasource/bitbucket-tags';
import { DockerDatasource } from '../../datasource/docker';
import { GitRefsDatasource } from '../../datasource/git-refs';
import { GitTagsDatasource } from '../../datasource/git-tags';
import { GithubReleasesDatasource } from '../../datasource/github-releases';
import { GithubTagsDatasource } from '../../datasource/github-tags';
import { GitlabTagsDatasource } from '../../datasource/gitlab-tags';
import { HelmDatasource } from '../../datasource/helm';
import type { ExtractConfig, PackageDependency, PackageFile } from '../types';
import { isSystemManifest } from './common';
import type {
  FluxManagerData,
  FluxManifest,
  FluxResource,
  HelmRepository,
  ResourceFluxManifest,
  SystemFluxManifest,
} from './types';

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
      file,
      version: versionMatch[1],
      components: versionMatch[2],
    };
  }

  const manifest: FluxManifest = {
    kind: 'resource',
    file,
    resources: [],
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
          manifest.resources.push(resource);
        }
        break;
      case 'HelmRepository':
        if (
          resource.apiVersion?.startsWith('source.toolkit.fluxcd.io/') &&
          resource.metadata?.name &&
          resource.metadata.namespace &&
          resource.spec?.url
        ) {
          manifest.resources.push(resource);
        }
        break;
      case 'GitRepository':
        if (
          resource.apiVersion?.startsWith('source.toolkit.fluxcd.io/') &&
          resource.spec?.url
        ) {
          manifest.resources.push(resource);
        }
        break;
      case 'OCIRepository':
        if (
          resource.apiVersion?.startsWith('source.toolkit.fluxcd.io/') &&
          resource.spec?.url
        ) {
          manifest.resources.push(resource);
        }
        break;
    }
  }

  return manifest;
}

const githubUrlRegex = regEx(
  /^(?:https:\/\/|git@)github\.com[/:](?<packageName>[^/]+\/[^/]+?)(?:\.git)?$/
);
const gitlabUrlRegex = regEx(
  /^(?:https:\/\/|git@)gitlab\.com[/:](?<packageName>[^/]+\/[^/]+?)(?:\.git)?$/
);
const bitbucketUrlRegex = regEx(
  /^(?:https:\/\/|git@)bitbucket\.org[/:](?<packageName>[^/]+\/[^/]+?)(?:\.git)?$/
);

function resolveGitRepositoryPerSourceTag(
  dep: PackageDependency,
  gitUrl: string
): void {
  const githubMatchGroups = githubUrlRegex.exec(gitUrl)?.groups;
  if (githubMatchGroups) {
    dep.datasource = GithubTagsDatasource.id;
    dep.packageName = githubMatchGroups.packageName;
    dep.sourceUrl = `https://github.com/${dep.packageName}`;
    return;
  }

  const gitlabMatchGroups = gitlabUrlRegex.exec(gitUrl)?.groups;
  if (gitlabMatchGroups) {
    dep.datasource = GitlabTagsDatasource.id;
    dep.packageName = gitlabMatchGroups.packageName;
    dep.sourceUrl = `https://gitlab.com/${dep.packageName}`;
    return;
  }

  const bitbucketMatchGroups = bitbucketUrlRegex.exec(gitUrl)?.groups;
  if (bitbucketMatchGroups) {
    dep.datasource = BitBucketTagsDatasource.id;
    dep.packageName = bitbucketMatchGroups.packageName;
    dep.sourceUrl = `https://bitbucket.org/${dep.packageName}`;
    return;
  }

  dep.datasource = GitTagsDatasource.id;
  dep.packageName = gitUrl;
  if (gitUrl.startsWith('https://')) {
    dep.sourceUrl = gitUrl.replace(/\.git$/, '');
  }
}

function resolveSystemManifest(
  manifest: SystemFluxManifest
): PackageDependency<FluxManagerData>[] {
  return [
    {
      depName: 'fluxcd/flux2',
      datasource: GithubReleasesDatasource.id,
      currentValue: manifest.version,
      managerData: {
        components: manifest.components,
      },
    },
  ];
}

function resolveResourceManifest(
  manifest: ResourceFluxManifest,
  helmRepositories: HelmRepository[]
): PackageDependency<FluxManagerData>[] {
  const deps: PackageDependency<FluxManagerData>[] = [];
  for (const resource of manifest.resources) {
    switch (resource.kind) {
      case 'HelmRelease': {
        const dep: PackageDependency<FluxManagerData> = {
          depName: resource.spec.chart.spec.chart,
          currentValue: resource.spec.chart.spec.version,
          datasource: HelmDatasource.id,
        };

        const matchingRepositories = helmRepositories.filter(
          (rep) =>
            rep.kind === resource.spec.chart.spec.sourceRef?.kind &&
            rep.metadata.name === resource.spec.chart.spec.sourceRef.name &&
            rep.metadata.namespace ===
              (resource.spec.chart.spec.sourceRef.namespace ??
                resource.metadata?.namespace)
        );
        if (matchingRepositories.length) {
          dep.registryUrls = matchingRepositories.map((repo) => repo.spec.url);
        } else {
          dep.skipReason = 'unknown-registry';
        }
        deps.push(dep);
        break;
      }
      case 'GitRepository': {
        const dep: PackageDependency<FluxManagerData> = {
          depName: resource.metadata.name,
        };

        if (resource.spec.ref?.commit) {
          const gitUrl = resource.spec.url;
          dep.currentDigest = resource.spec.ref.commit;
          dep.datasource = GitRefsDatasource.id;
          dep.packageName = gitUrl;
          dep.replaceString = resource.spec.ref.commit;
          if (gitUrl.startsWith('https://')) {
            dep.sourceUrl = gitUrl.replace(/\.git$/, '');
          }
        } else if (resource.spec.ref?.tag) {
          dep.currentValue = resource.spec.ref.tag;
          resolveGitRepositoryPerSourceTag(dep, resource.spec.url);
        } else {
          dep.skipReason = 'unversioned-reference';
        }
        deps.push(dep);
        break;
      }
      case 'OCIRepository': {
        const containerRegistry = resource.spec.url?.replace('oci://', '');
        const dep: PackageDependency<FluxManagerData> = {
          depName: containerRegistry,
        };
        if (resource.spec.ref?.digest) {
          dep.currentDigest = resource.spec.ref.digest;
          dep.datasource = DockerDatasource.id;
        } else if (resource.spec.ref?.tag) {
          dep.currentValue = resource.spec.ref.tag;
          dep.datasource = DockerDatasource.id;
        } else {
          dep.skipReason = 'unversioned-reference';
        }
        deps.push(dep);
        break;
      }
    }
  }
  return deps;
}

export function extractPackageFile(
  content: string,
  packageFile: string
): PackageFile<FluxManagerData> | null {
  const manifest = readManifest(content, packageFile);
  if (!manifest) {
    return null;
  }
  const helmRepositories: HelmRepository[] = [];
  if (manifest.kind === 'resource') {
    for (const resource of manifest.resources) {
      if (resource.kind === 'HelmRepository') {
        helmRepositories.push(resource);
      }
    }
  }
  let deps: PackageDependency<FluxManagerData>[] | null = null;
  switch (manifest.kind) {
    case 'system':
      deps = resolveSystemManifest(manifest);
      break;
    case 'resource': {
      deps = resolveResourceManifest(manifest, helmRepositories);
      break;
    }
  }
  return deps?.length ? { deps } : null;
}

export async function extractAllPackageFiles(
  _config: ExtractConfig,
  packageFiles: string[]
): Promise<PackageFile<FluxManagerData>[] | null> {
  const manifests: FluxManifest[] = [];
  const results: PackageFile<FluxManagerData>[] = [];

  for (const file of packageFiles) {
    const content = await readLocalFile(file, 'utf8');
    // TODO #7154
    const manifest = readManifest(content!, file);
    if (manifest) {
      manifests.push(manifest);
    }
  }

  const helmRepositories: HelmRepository[] = [];
  for (const manifest of manifests) {
    if (manifest.kind === 'resource') {
      for (const resource of manifest.resources) {
        if (resource.kind === 'HelmRepository') {
          helmRepositories.push(resource);
        }
      }
    }
  }

  for (const manifest of manifests) {
    let deps: PackageDependency<FluxManagerData>[] | null = null;
    switch (manifest.kind) {
      case 'system':
        deps = resolveSystemManifest(manifest);
        break;
      case 'resource': {
        deps = resolveResourceManifest(manifest, helmRepositories);
        break;
      }
    }
    if (deps?.length) {
      results.push({
        packageFile: manifest.file,
        deps,
      });
    }
  }

  return results.length ? results : null;
}
