import is from '@sindresorhus/is';
import { DateTime } from 'luxon';
import { GlobalConfig } from '../../../config/global';
import { logger } from '../../../logger';
import { Decorator, decorate } from '../../decorator';
import { acquireLock } from '../../mutex';
import type { DecoratorCachedRecord, PackageCacheNamespace } from './types';
import * as packageCache from '.';

type HashFunction<T extends any[] = any[]> = (...args: T) => string;
type BooleanFunction<T extends any[] = any[]> = (...args: T) => boolean;

/**
 * The cache decorator parameters.
 */
interface CacheParameters {
  /**
   * The cache key
   * Either a string or a hash function that generates a string
   */
  key: string | HashFunction;

  /**
   * A function that returns true if a result is cacheable
   * Used to prevent caching of private, sensitive, results
   */
  cacheable?: BooleanFunction;

  /**
   * The TTL (or expiry) of the key in minutes
   */
  ttlMinutes?: number;
}

function getClassName(instance: unknown): string | null {
  if (!is.object(instance)) {
    return null;
  }

  return instance.constructor.name;
}

const namespaceMapping: Record<string, PackageCacheNamespace> = {
  ArtifactoryDatasource: 'datasource-artifactory',
  AwsMachineImageDatasource: 'datasource-aws-machine-image',
  AwsRdsDatasource: 'datasource-aws-rds',
  AzureBicepResourceDatasource: 'datasource-azure-bicep-resource',
  AzurePipelinesTasksDatasource: 'datasource-azure-pipelines-tasks',
  BazelDatasource: 'datasource-bazel',
  BitbucketTagsDatasource: 'datasource-bitbucket-tags',
  BitriseDatasource: 'datasource-bitrise',
  CdnjsDatasource: 'datasource-cdnjs',
  ConanDatasource: 'datasource-conan',
  CondaDatasource: 'datasource-conda',
  CpanDatasource: 'datasource-cpan',
  CrateDatasource: 'datasource-crate',
  DenoDatasource: 'datasource-deno',
  DockerDatasource: 'datasource-docker',
  DotnetVersionDatasource: 'datasource-dotnet-version',
  EndoflifeDatePackagesource: 'datasource-endoflife-date',
  GalaxyDatasource: 'datasource-galaxy',
  GalaxyCollectionDatasource: 'datasource-galaxy-collection',
  GitRefsDatasource: 'datasource-git-refs',
  GitTagsDatasource: 'datasource-git-tags',
  GiteaReleasesDatasource: 'datasource-gitea-releases',
  GiteaTagsDatasource: 'datasource-gitea-tags',
  GithubReleaseAttachmentsDatasource: 'datasource-github-releases',
  GitlabPackagesDatasource: 'datasource-gitlab-packages',
  GitlabReleasesDatasource: 'datasource-gitlab-releases',
  GitlabTagsDatasource: 'datasource-gitlab-tags',
  GlasskubePackagesDatasource: 'datasource-glasskube-packages',
  GoDatasource: 'datasource-go',
  GoDirectDatasource: 'datasource-go-direct',
  GoProxyDatasource: 'datasource-go-proxy',
  GolangVersionDatasource: 'datasource-golang-version',
  GradleVersionDatasource: 'datasource-gradle-version',
  HelmDatasource: 'datasource-helm',
  HermitDatasource: 'datasource-hermit',
  HexDatasource: 'datasource-hex',
  HexpmBobDatasource: 'datasource-hexpm-bob',
  JavaVersionDatasource: 'datasource-java-version',
  JenkinsPluginsDatasource: 'jenkins-plugins',
  NodeVersionDatasource: 'datasource-node-version',
  NugetV3Api: 'datasource-nuget',
  OrbDatasource: 'datasource-orb',
  PackagistDatasource: 'datasource-packagist',
  PodDatasource: 'datasource-pod',
  PythonVersionDatasource: 'datasource-python-version',
  RepologyDatasource: 'datasource-repology-list',
  RubyVersionDatasource: 'datasource-ruby-version',
  RubygemsDatasource: 'datasource-rubygems',
  TerraformDatasource: 'datasource-terraform',
  TerraformModuleDatasource: 'datasource-terraform-module',
  TerraformProviderDatasource: 'datasource-terraform-provider',
  TerraformProviderHash: 'datasource-terraform-provider-build-hashes',
  Unity3dDatasource: 'datasource-unity3d',
  GitDatasource: 'datasource-git',
} satisfies Record<string, PackageCacheNamespace>;

/**
 * caches the result of a decorated method.
 */
export function cache<T>({
  key,
  cacheable = () => true,
  ttlMinutes = 30,
}: CacheParameters): Decorator<T> {
  return decorate(async ({ args, instance, callback, methodName }) => {
    const cachePrivatePackages = GlobalConfig.get(
      'cachePrivatePackages',
      false,
    );
    const isCacheable = cachePrivatePackages || cacheable.apply(instance, args);
    if (!isCacheable) {
      return callback();
    }

    const className = getClassName(instance);
    let finalNamespace: PackageCacheNamespace | undefined;
    if (is.string(className)) {
      finalNamespace = namespaceMapping[className];
    }

    let finalKey: string | undefined;
    if (is.string(key)) {
      finalKey = key;
    } else if (is.function_(key)) {
      finalKey = key.apply(instance, args);
    }

    // istanbul ignore if
    if (!finalNamespace || !finalKey) {
      return callback();
    }

    finalKey = `${packageCache.decoratorKeyPrefix}:${finalKey}`;

    // prevent concurrent processing and cache writes
    const releaseLock = await acquireLock(finalKey, finalNamespace);

    try {
      const oldRecord = await packageCache.get<DecoratorCachedRecord>(
        finalNamespace,
        finalKey,
      );

      const ttlOverride = getTtlOverride(finalNamespace);
      const softTtl = ttlOverride ?? ttlMinutes;

      const cacheHardTtlMinutes = GlobalConfig.get(
        'cacheHardTtlMinutes',
        7 * 24 * 60,
      );
      let hardTtl = softTtl;
      if (methodName === 'getReleases' || methodName === 'getDigest') {
        hardTtl = Math.max(softTtl, cacheHardTtlMinutes);
      }

      let oldData: unknown;
      if (oldRecord) {
        const now = DateTime.local();
        const cachedAt = DateTime.fromISO(oldRecord.cachedAt);

        const softDeadline = cachedAt.plus({ minutes: softTtl });
        if (now < softDeadline) {
          return oldRecord.value;
        }

        const hardDeadline = cachedAt.plus({ minutes: hardTtl });
        if (now < hardDeadline) {
          oldData = oldRecord.value;
        }
      }

      let newData: unknown;
      if (oldData) {
        try {
          newData = (await callback()) as T | undefined;
        } catch (err) {
          logger.debug(
            { err },
            'Package cache decorator: callback error, returning old data',
          );
          return oldData;
        }
      } else {
        newData = (await callback()) as T | undefined;
      }

      if (!is.undefined(newData)) {
        const newRecord: DecoratorCachedRecord = {
          cachedAt: DateTime.local().toISO(),
          value: newData,
        };
        await packageCache.set(finalNamespace, finalKey, newRecord, hardTtl);
      }

      return newData;
    } finally {
      releaseLock();
    }
  });
}

export function getTtlOverride(namespace: string): number | undefined {
  const ttl: unknown = GlobalConfig.get('cacheTtlOverride', {})[namespace];
  if (is.number(ttl)) {
    return ttl;
  }
  return undefined;
}
