import is from '@sindresorhus/is';
import { logger } from '../../../logger';
import { coerceArray } from '../../../util/array';
import { readLocalFile } from '../../../util/fs';
import { regEx } from '../../../util/regex';
import { isHttpUrl } from '../../../util/url';
import { parseYaml } from '../../../util/yaml';
import { BitbucketTagsDatasource } from '../../datasource/bitbucket-tags';
import { DockerDatasource } from '../../datasource/docker';
import { GitRefsDatasource } from '../../datasource/git-refs';
import { GitTagsDatasource } from '../../datasource/git-tags';
import { GithubReleasesDatasource } from '../../datasource/github-releases';
import { GithubTagsDatasource } from '../../datasource/github-tags';
import { GitlabTagsDatasource } from '../../datasource/gitlab-tags';
import { HelmDatasource } from '../../datasource/helm';
import { getDep } from '../dockerfile/extract';
import { findDependencies } from '../helm-values/extract';
import { isOCIRegistry, removeOCIPrefix } from '../helmv3/oci';
import { extractImage } from '../kustomize/extract';
import type {
  ExtractConfig,
  PackageDependency,
  PackageFile,
  PackageFileContent,
} from '../types';
import {
  collectHelmRepos,
  isSystemManifest,
  systemManifestHeaderRegex,
} from './common';
import { FluxResource, type HelmRepository } from './schema';
import type {
  FluxManagerData,
  FluxManifest,
  ResourceFluxManifest,
  SystemFluxManifest,
} from './types';

function readManifest(
  content: string,
  packageFile: string,
): FluxManifest | null {
  if (isSystemManifest(packageFile)) {
    const versionMatch = regEx(systemManifestHeaderRegex).exec(content);
    if (!versionMatch) {
      return null;
    }
    return {
      kind: 'system',
      file: packageFile,
      version: versionMatch[1],
      components: versionMatch[2],
    };
  }

  return {
    kind: 'resource',
    file: packageFile,
    resources: parseYaml(content, {
      customSchema: FluxResource,
      failureBehaviour: 'filter',
    }),
  };
}

const githubUrlRegex = regEx(
  /^(?:https:\/\/|git@)github\.com[/:](?<packageName>[^/]+\/[^/]+?)(?:\.git)?$/,
);
const gitlabUrlRegex = regEx(
  /^(?:https:\/\/|git@)gitlab\.com[/:](?<packageName>[^/]+\/[^/]+?)(?:\.git)?$/,
);
const bitbucketUrlRegex = regEx(
  /^(?:https:\/\/|git@)bitbucket\.org[/:](?<packageName>[^/]+\/[^/]+?)(?:\.git)?$/,
);

function resolveGitRepositoryPerSourceTag(
  dep: PackageDependency,
  gitUrl: string,
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
    dep.datasource = BitbucketTagsDatasource.id;
    dep.packageName = bitbucketMatchGroups.packageName;
    dep.sourceUrl = `https://bitbucket.org/${dep.packageName}`;
    return;
  }

  dep.datasource = GitTagsDatasource.id;
  dep.packageName = gitUrl;
  if (isHttpUrl(gitUrl)) {
    dep.sourceUrl = gitUrl.replace(/\.git$/, '');
  }
}

function resolveHelmRepository(
  dep: PackageDependency,
  matchingRepositories: HelmRepository[],
  registryAliases: Record<string, string> | undefined,
): void {
  if (matchingRepositories.length) {
    dep.registryUrls = matchingRepositories
      .map((repo) => {
        if (repo.spec.type === 'oci' || isOCIRegistry(repo.spec.url)) {
          // Change datasource to Docker
          dep.datasource = DockerDatasource.id;
          // Ensure the URL is a valid OCI path
          dep.packageName = getDep(
            `${removeOCIPrefix(repo.spec.url)}/${dep.depName}`,
            false,
            registryAliases,
          ).packageName;
          return null;
        } else {
          return repo.spec.url;
        }
      })
      .filter(is.string);

    // if registryUrls is empty, delete it from dep
    if (!dep.registryUrls?.length) {
      delete dep.registryUrls;
    }
  } else {
    dep.skipReason = 'unknown-registry';
  }
}

function resolveSystemManifest(
  manifest: SystemFluxManifest,
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
  helmRepositories: HelmRepository[],
  registryAliases: Record<string, string> | undefined,
): PackageDependency[] {
  const deps: PackageDependency[] = [];
  for (const resource of manifest.resources) {
    switch (resource.kind) {
      case 'HelmRelease': {
        if (resource.spec.chartRef) {
          logger.trace(
            'HelmRelease using chartRef was found, skipping as version will be handled via referenced resource directly',
          );
        } else if (resource.spec.chart) {
          const chartSpec = resource.spec.chart.spec;
          const depName = chartSpec.chart;
          const dep: PackageDependency = {
            depName,
            currentValue: resource.spec.chart.spec.version,
            datasource: HelmDatasource.id,
          };

          if (depName.startsWith('./')) {
            dep.skipReason = 'local-chart';
            delete dep.datasource;
          } else {
            const matchingRepositories = helmRepositories.filter(
              (rep) =>
                rep.kind === chartSpec.sourceRef?.kind &&
                rep.metadata.name === chartSpec.sourceRef.name &&
                rep.metadata.namespace ===
                  (chartSpec.sourceRef.namespace ??
                    resource.metadata?.namespace),
            );
            resolveHelmRepository(dep, matchingRepositories, registryAliases);
          }
          deps.push(dep);
        } else {
          logger.debug(
            `invalid or incomplete ${resource.metadata.name} HelmRelease spec, skipping`,
          );
        }

        if (resource.spec.values) {
          logger.trace('detecting dependencies in HelmRelease values');
          deps.push(...findDependencies(resource.spec.values, registryAliases));
        }
        break;
      }

      case 'HelmChart': {
        if (resource.spec.sourceRef.kind === 'GitRepository') {
          logger.trace(
            'HelmChart using GitRepository was found, skipping as version will be handled via referenced resource directly',
          );
          continue;
        }

        const dep: PackageDependency = {
          depName: resource.spec.chart,
        };

        if (resource.spec.sourceRef.kind === 'HelmRepository') {
          dep.currentValue = resource.spec.version;
          dep.datasource = HelmDatasource.id;

          const matchingRepositories = helmRepositories.filter(
            (rep) =>
              rep.kind === resource.spec.sourceRef?.kind &&
              rep.metadata.name === resource.spec.sourceRef.name &&
              rep.metadata.namespace === resource.metadata?.namespace,
          );
          resolveHelmRepository(dep, matchingRepositories, registryAliases);
        } else {
          dep.skipReason = 'unsupported-datasource';
        }
        deps.push(dep);
        break;
      }

      case 'GitRepository': {
        const dep: PackageDependency = {
          depName: resource.metadata.name,
        };

        if (resource.spec.ref?.commit) {
          const gitUrl = resource.spec.url;
          dep.currentDigest = resource.spec.ref.commit;
          dep.datasource = GitRefsDatasource.id;
          dep.packageName = gitUrl;
          dep.replaceString = resource.spec.ref.commit;
          if (isHttpUrl(gitUrl)) {
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
        const container = removeOCIPrefix(resource.spec.url);
        let dep = getDep(container, false, registryAliases);
        if (resource.spec.ref?.digest) {
          dep = getDep(
            `${container}@${resource.spec.ref.digest}`,
            false,
            registryAliases,
          );
          if (resource.spec.ref?.tag) {
            logger.debug('A digest and tag was found, ignoring tag');
          }
        } else if (resource.spec.ref?.tag) {
          dep = getDep(
            `${container}:${resource.spec.ref.tag}`,
            false,
            registryAliases,
          );
          dep.autoReplaceStringTemplate =
            '{{#if newValue}}{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}';
          dep.replaceString = resource.spec.ref.tag;
        } else {
          dep.skipReason = 'unversioned-reference';
        }
        deps.push(dep);
        break;
      }

      case 'Kustomization': {
        for (const image of coerceArray(resource.spec.images)) {
          const dep = extractImage(image, registryAliases);
          if (dep) {
            deps.push(dep);
          }
        }
      }
    }
  }
  return deps;
}

export function extractPackageFile(
  content: string,
  packageFile: string,
  config?: ExtractConfig,
): PackageFileContent<FluxManagerData> | null {
  const manifest = readManifest(content, packageFile);
  if (!manifest) {
    return null;
  }
  const helmRepositories = collectHelmRepos([manifest]);
  let deps: PackageDependency[] | null = null;
  switch (manifest.kind) {
    case 'system':
      deps = resolveSystemManifest(manifest);
      break;
    case 'resource': {
      deps = resolveResourceManifest(
        manifest,
        helmRepositories,
        config?.registryAliases,
      );
      break;
    }
  }
  return deps?.length ? { deps } : null;
}

export async function extractAllPackageFiles(
  config: ExtractConfig,
  packageFiles: string[],
): Promise<PackageFile<FluxManagerData>[] | null> {
  const manifests: FluxManifest[] = [];
  const results: PackageFile<FluxManagerData>[] = [];

  for (const file of packageFiles) {
    const content = await readLocalFile(file, 'utf8');
    // TODO #22198
    const manifest = readManifest(content!, file);
    if (manifest) {
      manifests.push(manifest);
    }
  }

  const helmRepositories = collectHelmRepos(manifests);

  for (const manifest of manifests) {
    let deps: PackageDependency[] | null = null;
    switch (manifest.kind) {
      case 'system':
        deps = resolveSystemManifest(manifest);
        break;
      case 'resource': {
        deps = resolveResourceManifest(
          manifest,
          helmRepositories,
          config.registryAliases,
        );
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
