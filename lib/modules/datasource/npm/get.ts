import url from 'url';
import is from '@sindresorhus/is';
import { logger } from '../../../logger';
import { ExternalHostError } from '../../../types/errors/external-host-error';
import * as packageCache from '../../../util/cache/package';
import type { Http } from '../../../util/http';
import { regEx } from '../../../util/regex';
import { joinUrlParts } from '../../../util/url';
import { id } from './common';
import type { NpmDependency, NpmRelease, NpmResponse } from './types';

interface PackageSource {
  sourceUrl?: string;
  sourceDirectory?: string;
}

const SHORT_REPO_REGEX = regEx(
  /^((?<platform>bitbucket|github|gitlab):)?(?<shortRepo>[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)$/
);

const platformMapping: Record<string, string> = {
  bitbucket: 'https://bitbucket.org/',
  github: 'https://github.com/',
  gitlab: 'https://gitlab.com/',
};

function getPackageSource(repository: any): PackageSource {
  const res: PackageSource = {};
  if (repository) {
    if (is.nonEmptyString(repository)) {
      const shortMatch = repository.match(SHORT_REPO_REGEX);
      if (shortMatch?.groups) {
        const { platform = 'github', shortRepo } = shortMatch.groups;
        res.sourceUrl = platformMapping[platform] + shortRepo;
      } else {
        res.sourceUrl = repository;
      }
    } else if (is.nonEmptyString(repository.url)) {
      res.sourceUrl = repository.url;
    }
    if (is.nonEmptyString(repository.directory)) {
      res.sourceDirectory = repository.directory;
    }
  }
  return res;
}

export async function getDependency(
  http: Http,
  registryUrl: string,
  packageName: string
): Promise<NpmDependency | null> {
  logger.trace(`npm.getDependency(${packageName})`);

  const packageUrl = joinUrlParts(registryUrl, packageName.replace('/', '%2F'));

  // Now check the persistent cache
  const cacheNamespace = 'datasource-npm';
  const cachedResult = await packageCache.get<NpmDependency>(
    cacheNamespace,
    packageUrl
  );
  // istanbul ignore if
  if (cachedResult) {
    return cachedResult;
  }

  const uri = url.parse(packageUrl);

  try {
    const raw = await http.getJson<NpmResponse>(packageUrl);
    const res = raw.body;
    if (!res.versions || !Object.keys(res.versions).length) {
      // Registry returned a 200 OK but with no versions
      logger.debug(`No versions returned for npm dependency ${packageName}`);
      return null;
    }

    const latestVersion = res.versions[res['dist-tags']?.latest ?? ''];
    res.repository ??= latestVersion?.repository;
    res.homepage ??= latestVersion?.homepage;

    const { sourceUrl, sourceDirectory } = getPackageSource(res.repository);

    // Simplify response before caching and returning
    const dep: NpmDependency = {
      name: res.name,
      homepage: res.homepage,
      sourceUrl,
      sourceDirectory,
      versions: {},
      releases: [],
      'dist-tags': res['dist-tags'],
      registryUrl,
    };

    if (latestVersion?.deprecated) {
      dep.deprecationMessage = `On registry \`${registryUrl}\`, the "latest" version of dependency \`${packageName}\` has the following deprecation notice:\n\n\`${latestVersion.deprecated}\`\n\nMarking the latest version of an npm package as deprecated results in the entire package being considered deprecated, so contact the package author you think this is a mistake.`;
      dep.deprecationSource = id;
    }
    dep.releases = Object.keys(res.versions).map((version) => {
      const release: NpmRelease = {
        version,
        gitRef: res.versions?.[version].gitHead,
        dependencies: res.versions?.[version].dependencies,
        devDependencies: res.versions?.[version].devDependencies,
      };
      if (res.time?.[version]) {
        release.releaseTimestamp = res.time[version];
      }
      if (res.versions?.[version].deprecated) {
        release.isDeprecated = true;
      }
      const source = getPackageSource(res.versions?.[version].repository);
      if (source.sourceUrl && source.sourceUrl !== dep.sourceUrl) {
        release.sourceUrl = source.sourceUrl;
      }
      if (
        source.sourceDirectory &&
        source.sourceDirectory !== dep.sourceDirectory
      ) {
        release.sourceDirectory = source.sourceDirectory;
      }
      return release;
    });
    logger.trace({ dep }, 'dep');
    // serialize first before saving
    const cacheMinutes = process.env.RENOVATE_CACHE_NPM_MINUTES
      ? parseInt(process.env.RENOVATE_CACHE_NPM_MINUTES, 10)
      : 15;
    // TODO: use dynamic detection of public repos instead of a static list (#9587)
    const whitelistedPublicScopes = [
      '@graphql-codegen',
      '@storybook',
      '@types',
      '@typescript-eslint',
    ];
    if (
      !raw.authorization &&
      (whitelistedPublicScopes.includes(packageName.split('/')[0]) ||
        !packageName.startsWith('@'))
    ) {
      await packageCache.set(cacheNamespace, packageUrl, dep, cacheMinutes);
    }
    return dep;
  } catch (err) {
    const ignoredStatusCodes = [401, 402, 403, 404];
    const ignoredResponseCodes = ['ENOTFOUND'];
    if (
      ignoredStatusCodes.includes(err.statusCode) ||
      ignoredResponseCodes.includes(err.code)
    ) {
      return null;
    }
    if (uri.host === 'registry.npmjs.org') {
      // istanbul ignore if
      if (err.name === 'ParseError' && err.body) {
        err.body = 'err.body deleted by Renovate';
      }
      throw new ExternalHostError(err);
    }
    logger.debug({ err }, 'Unknown npm lookup error');
    return null;
  }
}
