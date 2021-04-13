import * as fs from 'fs';
import URL from 'url';
import pMap from 'p-map';
import { logger } from '../../logger';
import * as packageCache from '../../util/cache/package';
import { Http } from '../../util/http';
import * as hashicorpVersioning from '../../versioning/hashicorp';
import { getTerraformServiceDiscoveryResult } from '../terraform-module';
import type { GetReleasesConfig, Release, ReleaseResult } from '../types';
import { hashOfZipContent } from './hash';
import type {
  TerraformBuild,
  TerraformProvider,
  TerraformProviderReleaseBackend,
} from './types';

export const id = 'terraform-provider';
export const customRegistrySupport = true;
export const defaultRegistryUrls = [
  'https://registry.terraform.io',
  'https://releases.hashicorp.com',
];
export const defaultVersioning = hashicorpVersioning.id;
export const registryStrategy = 'hunt';

const http = new Http(id);

async function getReleaseBackendIndex(): Promise<TerraformProviderReleaseBackend> {
  return (
    await http.getJson<TerraformProviderReleaseBackend>(
      `${defaultRegistryUrls[1]}/index.json`
    )
  ).body;
}

export function getHashes(
  builds: TerraformBuild[]
): Promise<Record<string, string>[]> {
  // TODO replace hard coded cache
  const cacheDir = '/tmp/download';

  // for each build download ZIP, extract content and generate hash for all containing files
  return pMap(
    builds,
    async (build) => {
      const downloadPath = `${cacheDir}/${build.filename}`;
      // TODO implement download
      const hash = await hashOfZipContent(downloadPath);
      const buildName = `${build.os}_${build.arch}`;
      const record: Record<string, string> = { [buildName]: hash };
      return record;
    },
    { concurrency: 2 } // allow to look up 2 builds for this version in parallel
  );
}

export async function createReleases(
  lookupName: string,
  registryURL: string,
  repository: string,
  versions: string[]
): Promise<Release[]> {
  const backendLookUpName = `terraform-provider-${lookupName}`;
  const res = await getReleaseBackendIndex();

  // allow to look up 2 builds for this version in parallel
  return pMap(
    versions,
    async (version) => {
      // check cache
      const cacheKey = `${registryURL}/${repository}/${lookupName}-${version}`;
      const cachedRelease = await packageCache.get<Release>(
        'terraform-provider-release',
        cacheKey
      );
      if (cachedRelease) {
        return cachedRelease;
      }

      const versionsBackend = res[backendLookUpName].versions;
      const versionReleaseBackend = versionsBackend[version];
      if (versionReleaseBackend == null) {
        logger.debug(
          { versions: versionsBackend },
          `Could not find find ${version}`
        );
        return null;
      }
      const builds = versionReleaseBackend.builds;
      // TODO implement hash caching
      const hashes = await getHashes(builds);
      const release: Release = {
        version,
        hashes,
      };

      // save to cache
      await packageCache.set(
        'terraform-provider-release',
        cacheKey,
        release,
        10080
      ); // cache for a week
      return release;
    },
    { concurrency: 2 }
  ); // allow to look up builds for 2 versions in parallel
}

async function queryRegistry(
  lookupName: string,
  registryURL: string,
  repository: string
): Promise<ReleaseResult> {
  const serviceDiscovery = await getTerraformServiceDiscoveryResult(
    registryURL
  );
  const backendURL = `${registryURL}${serviceDiscovery['providers.v1']}${repository}`;
  const res = (await http.getJson<TerraformProvider>(backendURL)).body;
  const dep: ReleaseResult = {
    releases: null,
  };
  if (res.source) {
    dep.sourceUrl = res.source;
  }
  dep.releases = res.versions.map((version) => ({
    version,
  }));
  // add a release per version with build hashes
  dep.releases = await createReleases(
    lookupName,
    registryURL,
    repository,
    res.versions
  );

  // set published date for latest release
  const latestVersion = dep.releases.find(
    (release) => res.version === release.version
  );
  // istanbul ignore else
  if (latestVersion) {
    latestVersion.releaseTimestamp = res.published_at;
  }
  dep.homepage = `${registryURL}/providers/${repository}`;
  logger.trace({ dep }, 'dep');
  return dep;
}

// TODO: add long term cache
async function queryReleaseBackend(
  lookupName: string,
  registryURL: string,
  repository: string
): Promise<ReleaseResult> {
  const backendLookUpName = `terraform-provider-${lookupName}`;
  const res = await getReleaseBackendIndex();

  if (!res[backendLookUpName]) {
    return null;
  }

  const dep: ReleaseResult = {
    releases: null,
    sourceUrl: `https://github.com/terraform-providers/${backendLookUpName}`,
  };
  // get list of all versions
  const versions = Object.keys(res[backendLookUpName].versions);
  // add a release per version with build hashes
  dep.releases = await createReleases(
    lookupName,
    registryURL,
    repository,
    versions
  );
  logger.trace({ dep }, 'dep');
  return dep;
}

/**
 * terraform-provider.getReleases
 *
 * This function will fetch a provider from the public Terraform registry and return all semver versions.
 */
export async function getReleases({
  lookupName,
  registryUrl,
}: GetReleasesConfig): Promise<ReleaseResult | null> {
  const repository = lookupName.includes('/')
    ? lookupName
    : `hashicorp/${lookupName}`;

  const cacheNamespace = 'terraform-provider';
  const pkgUrl = `${registryUrl}/${repository}`;
  const cachedResult = await packageCache.get<ReleaseResult>(
    cacheNamespace,
    pkgUrl
  );
  // istanbul ignore if
  if (cachedResult) {
    return cachedResult;
  }

  logger.debug({ lookupName }, 'terraform-provider.getDependencies()');
  let dep: ReleaseResult = null;
  const registryHost = URL.parse(registryUrl).host;
  if (registryHost === 'releases.hashicorp.com') {
    dep = await queryReleaseBackend(lookupName, registryUrl, repository);
  } else {
    dep = await queryRegistry(lookupName, registryUrl, repository);
  }
  const cacheMinutes = 30;
  await packageCache.set(cacheNamespace, pkgUrl, dep, cacheMinutes);
  return dep;
}
