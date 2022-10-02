import url from 'url';
import is from '@sindresorhus/is';
import { logger } from '../../../logger';
import { ExternalHostError } from '../../../types/errors/external-host-error';
import * as packageCache from '../../../util/cache/package';
import type { Http } from '../../../util/http';
import { joinUrlParts } from '../../../util/url';
import { id } from './common';
import type { NpmDependency, NpmRelease, NpmResponse } from './types';

interface PackageSource {
  sourceUrl?: string;
  sourceDirectory?: string;
}

function getPackageSource(repository: any): PackageSource {
  const res: PackageSource = {};
  if (repository) {
    if (is.nonEmptyString(repository)) {
      res.sourceUrl = repository;
    } else if (is.nonEmptyString(repository.url)) {
      res.sourceUrl = repository.url;
    }
    if (is.nonEmptyString(repository.directory)) {
      res.sourceDirectory = repository.directory;
    }
    // TODO: types (#7154)
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    const sourceUrlCopy = `${res.sourceUrl}`;
    const sourceUrlSplit: string[] = sourceUrlCopy.split('/');
    if (sourceUrlSplit.length > 7 && sourceUrlSplit[2] === 'github.com') {
      // Massage the repository URL for non-compliant strings for github (see issue #4610)
      // Remove the non-compliant segments of path, so the URL looks like "<scheme>://<domain>/<vendor>/<repo>"
      // and add directory to the repository
      res.sourceUrl = sourceUrlSplit.slice(0, 5).join('/');
      res.sourceDirectory ||= sourceUrlSplit
        .slice(7, sourceUrlSplit.length)
        .join('/');
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
      logger.debug({ dependency: packageName }, 'No versions returned');
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
    if (err.statusCode === 401 || err.statusCode === 403) {
      logger.debug(
        {
          packageUrl,
          err,
          statusCode: err.statusCode,
          packageName,
        },
        `Dependency lookup failure: unauthorized`
      );
      return null;
    }
    if (err.statusCode === 402) {
      logger.debug(
        {
          packageUrl,
          err,
          statusCode: err.statusCode,
          packageName,
        },
        `Dependency lookup failure: payment required`
      );
      return null;
    }
    if (err.statusCode === 404 || err.code === 'ENOTFOUND') {
      logger.debug(
        { err, packageName },
        `Dependency lookup failure: not found`
      );
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
