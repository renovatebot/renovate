import { isString } from '@sindresorhus/is';
import { logger } from '../../../logger/index.ts';
import { coerceArray } from '../../../util/array.ts';
import { readLocalFile } from '../../../util/fs/index.ts';
import { escapeRegExp, regEx } from '../../../util/regex.ts';
import { isHttpUrl } from '../../../util/url.ts';
import { parseYaml } from '../../../util/yaml.ts';
import { BitbucketTagsDatasource } from '../../datasource/bitbucket-tags/index.ts';
import { DockerDatasource } from '../../datasource/docker/index.ts';
import { GitRefsDatasource } from '../../datasource/git-refs/index.ts';
import { GitTagsDatasource } from '../../datasource/git-tags/index.ts';
import { GithubReleasesDatasource } from '../../datasource/github-releases/index.ts';
import { GithubTagsDatasource } from '../../datasource/github-tags/index.ts';
import { GitlabTagsDatasource } from '../../datasource/gitlab-tags/index.ts';
import { HelmDatasource } from '../../datasource/helm/index.ts';
import { getDep } from '../dockerfile/extract.ts';
import { findDependencies } from '../helm-values/extract.ts';
import { isOCIRegistry, removeOCIPrefix } from '../helmv3/oci.ts';
import { extractImage } from '../kustomize/extract.ts';
import type {
  ExtractConfig,
  PackageDependency,
  PackageFile,
  PackageFileContent,
} from '../types.ts';
import {
  collectHelmRepos,
  isSystemManifest,
  systemManifestHeaderRegex,
} from './common.ts';
import { FluxResource, type HelmRepository } from './schema.ts';
import type {
  FluxManagerData,
  FluxManifest,
  ResourceFluxManifest,
  SystemFluxManifest,
} from './types.ts';

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
      content,
      version: versionMatch[1],
      components: versionMatch[2],
    };
  }

  return {
    kind: 'resource',
    file: packageFile,
    content,
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
  sourceRefName?: string,
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
      .filter(isString);

    // if registryUrls is empty, delete it from dep
    if (!dep.registryUrls?.length) {
      delete dep.registryUrls;
    }
    return;
  }

  if (sourceRefName && registryAliases) {
    const aliasUrl = registryAliases[sourceRefName];
    if (aliasUrl) {
      if (isOCIRegistry(aliasUrl)) {
        // Treat alias value as an OCI registry URL
        dep.datasource = DockerDatasource.id;
        dep.packageName = getDep(
          `${removeOCIPrefix(aliasUrl)}/${dep.depName}`,
          false,
          registryAliases,
        ).packageName;
      } else {
        dep.registryUrls = [aliasUrl];
      }
      return;
    }
  }

  dep.skipReason = 'unknown-registry';
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
  content: string,
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
            const sourceRef = chartSpec.sourceRef;
            const matchingRepositories = helmRepositories.filter(
              (rep) =>
                rep.kind === sourceRef?.kind &&
                rep.metadata.name === sourceRef.name &&
                rep.metadata.namespace ===
                  (sourceRef?.namespace ?? resource.metadata?.namespace),
            );
            resolveHelmRepository(
              dep,
              matchingRepositories,
              registryAliases,
              sourceRef?.name,
            );
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

          const sourceRef = resource.spec.sourceRef;
          const matchingRepositories = helmRepositories.filter(
            (rep) =>
              rep.kind === sourceRef?.kind &&
              rep.metadata.name === sourceRef.name &&
              rep.metadata.namespace === resource.metadata?.namespace,
          );
          resolveHelmRepository(
            dep,
            matchingRepositories,
            registryAliases,
            sourceRef?.name,
          );
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
        if (resource.spec.ref?.digest && resource.spec.ref?.tag) {
          const combinedDep = getDep(
            `${container}@${resource.spec.ref.digest}`,
            false,
            registryAliases,
          );
          // Set currentValue to the tag so the docker datasource can look up the image's new digest
          combinedDep.currentValue = resource.spec.ref.tag;

          // Attempt to find the exact block spanning `tag: ...` to `digest: ...` (or vice-versa) in the source content
          const escapedTag = escapeRegExp(resource.spec.ref.tag);
          const escapedDigest = escapeRegExp(resource.spec.ref.digest);
          const tagFirstRegex = regEx(
            `ref\\s*:[\\s\\S]+?tag\\s*:\\s*["']?${escapedTag}["']?[\\s\\S]+?digest\\s*:\\s*["']?${escapedDigest}["']?`,
          );
          const digestFirstRegex = regEx(
            `ref\\s*:[\\s\\S]+?digest\\s*:\\s*["']?${escapedDigest}["']?[\\s\\S]+?tag\\s*:\\s*["']?${escapedTag}["']?`,
          );

          const tagFirstMatch = tagFirstRegex.exec(content);
          const digestFirstMatch = digestFirstRegex.exec(content);
          const match = tagFirstMatch ?? digestFirstMatch;

          if (match) {
            combinedDep.replaceString = match[0];
            // We use the literals directly for replacement to preserve any surrounding quotes if they exist in the match
            if (tagFirstMatch) {
              // tag came first
              combinedDep.autoReplaceStringTemplate = match[0]
                .replace(resource.spec.ref.tag, '{{newValue}}')
                .replace(resource.spec.ref.digest, '{{newDigest}}');
            } else {
              // digest came first
              combinedDep.autoReplaceStringTemplate = match[0]
                .replace(resource.spec.ref.digest, '{{newDigest}}')
                .replace(resource.spec.ref.tag, '{{newValue}}');
            }
          } else {
            logger.debug(
              { file: manifest.file, name: resource.metadata.name },
              'Could not find exact tag/digest block in content, auto-replace might fail',
            );
            // fallback (will likely fail auto-replace if not formatted this way, but avoids breaking tests outright)
            combinedDep.replaceString = `${resource.spec.ref.tag}@${resource.spec.ref.digest}`;
            combinedDep.autoReplaceStringTemplate =
              '{{newValue}}@{{newDigest}}';
          }

          deps.push(combinedDep);
        } else if (resource.spec.ref?.digest) {
          const dep = getDep(
            `${container}@${resource.spec.ref.digest}`,
            false,
            registryAliases,
          );
          deps.push(dep);
        } else if (resource.spec.ref?.tag) {
          const dep = getDep(
            `${container}:${resource.spec.ref.tag}`,
            false,
            registryAliases,
          );
          dep.autoReplaceStringTemplate =
            '{{#if newValue}}{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}';
          dep.replaceString = resource.spec.ref.tag;
          deps.push(dep);
        } else {
          const dep = getDep(container, false, registryAliases);
          dep.skipReason = 'unversioned-reference';
          deps.push(dep);
        }
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
        content,
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
    if (content) {
      // TODO #22198
      const manifest = readManifest(content, file);
      if (manifest) {
        manifests.push(manifest);
      }
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
          manifest.content,
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
