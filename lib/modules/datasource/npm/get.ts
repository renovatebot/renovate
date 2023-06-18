import url from 'node:url';
import is from '@sindresorhus/is';
import { DateTime } from 'luxon';
import { z } from 'zod';
import { GlobalConfig } from '../../../config/global';
import { HOST_DISABLED } from '../../../constants/error-messages';
import { logger } from '../../../logger';
import { ExternalHostError } from '../../../types/errors/external-host-error';
import * as packageCache from '../../../util/cache/package';
import type { Http } from '../../../util/http';
import type { HttpOptions } from '../../../util/http/types';
import { regEx } from '../../../util/regex';
import { joinUrlParts } from '../../../util/url';
import type { Release, ReleaseResult } from '../types';
import type { CachedReleaseResult, NpmResponse } from './types';

const SHORT_REPO_REGEX = regEx(
  /^((?<platform>bitbucket|github|gitlab):)?(?<shortRepo>[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)$/
);

const platformMapping: Record<string, string> = {
  bitbucket: 'https://bitbucket.org/',
  github: 'https://github.com/',
  gitlab: 'https://gitlab.com/',
};

interface PackageSource {
  sourceUrl: string | null;
  sourceDirectory: string | null;
}

const PackageSource = z
  .union([
    z
      .string()
      .nonempty()
      .transform((repository): PackageSource => {
        let sourceUrl: string | null = null;
        const sourceDirectory = null;
        const shortMatch = repository.match(SHORT_REPO_REGEX);
        if (shortMatch?.groups) {
          const { platform = 'github', shortRepo } = shortMatch.groups;
          sourceUrl = platformMapping[platform] + shortRepo;
        } else {
          sourceUrl = repository;
        }
        return { sourceUrl, sourceDirectory };
      }),
    z
      .object({
        url: z.string().nonempty().nullish(),
        directory: z.string().nonempty().nullish(),
      })
      .transform(({ url, directory }) => {
        const res: PackageSource = { sourceUrl: null, sourceDirectory: null };

        if (url) {
          res.sourceUrl = url;
        }

        if (directory) {
          res.sourceDirectory = directory;
        }

        return res;
      }),
  ])
  .catch({ sourceUrl: null, sourceDirectory: null });

export async function getDependency(
  http: Http,
  registryUrl: string,
  packageName: string
): Promise<ReleaseResult | null> {
  logger.trace(`npm.getDependency(${packageName})`);

  const packageUrl = joinUrlParts(registryUrl, packageName.replace('/', '%2F'));

  // Now check the persistent cache
  const cacheNamespace = 'datasource-npm:data';
  const cachedResult = await packageCache.get<CachedReleaseResult>(
    cacheNamespace,
    packageUrl
  );
  if (cachedResult) {
    if (cachedResult.cacheData) {
      const softExpireAt = DateTime.fromISO(
        cachedResult.cacheData.softExpireAt
      );
      if (softExpireAt.isValid && softExpireAt > DateTime.local()) {
        logger.trace('Cached result is not expired - reusing');
        delete cachedResult.cacheData;
        return cachedResult;
      }
      logger.trace('Cached result is soft expired');
    } else {
      logger.trace('Reusing legacy cached result');
      return cachedResult;
    }
  }
  const cacheMinutes = process.env.RENOVATE_CACHE_NPM_MINUTES
    ? parseInt(process.env.RENOVATE_CACHE_NPM_MINUTES, 10)
    : 15;
  const softExpireAt = DateTime.local()
    .plus({ minutes: cacheMinutes })
    .toISO()!;
  let { cacheHardTtlMinutes } = GlobalConfig.get();
  if (!(is.number(cacheHardTtlMinutes) && cacheHardTtlMinutes > cacheMinutes)) {
    cacheHardTtlMinutes = cacheMinutes;
  }

  const uri = url.parse(packageUrl);

  try {
    const options: HttpOptions = {};
    if (cachedResult?.cacheData?.etag) {
      logger.trace({ packageName }, 'Using cached etag');
      options.headers = { 'If-None-Match': cachedResult.cacheData.etag };
    }
    const raw = await http.getJson<NpmResponse>(packageUrl, options);
    if (cachedResult?.cacheData && raw.statusCode === 304) {
      logger.trace(`Cached npm result for ${packageName} is revalidated`);
      cachedResult.cacheData.softExpireAt = softExpireAt;
      await packageCache.set(
        cacheNamespace,
        packageUrl,
        cachedResult,
        cacheHardTtlMinutes
      );
      delete cachedResult.cacheData;
      return cachedResult;
    }
    const etag = raw.headers.etag;
    const res = raw.body;
    if (!res.versions || !Object.keys(res.versions).length) {
      // Registry returned a 200 OK but with no versions
      logger.debug(`No versions returned for npm dependency ${packageName}`);
      return null;
    }

    const latestVersion = res.versions[res['dist-tags']?.latest ?? ''];
    res.repository ??= latestVersion?.repository;
    res.homepage ??= latestVersion?.homepage;

    const { sourceUrl, sourceDirectory } = PackageSource.parse(res.repository);

    // Simplify response before caching and returning
    const dep: ReleaseResult = {
      homepage: res.homepage,
      releases: [],
      tags: res['dist-tags'],
      registryUrl,
    };

    if (sourceUrl) {
      dep.sourceUrl = sourceUrl;
    }

    if (sourceDirectory) {
      dep.sourceDirectory = sourceDirectory;
    }

    if (latestVersion?.deprecated) {
      dep.deprecationMessage = `On registry \`${registryUrl}\`, the "latest" version of dependency \`${packageName}\` has the following deprecation notice:\n\n\`${latestVersion.deprecated}\`\n\nMarking the latest version of an npm package as deprecated results in the entire package being considered deprecated, so contact the package author you think this is a mistake.`;
    }
    dep.releases = Object.keys(res.versions).map((version) => {
      const release: Release = {
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
      const source = PackageSource.parse(res.versions?.[version].repository);
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
    const cacheControl = raw.headers?.['cache-control'];
    if (
      is.nonEmptyString(cacheControl) &&
      regEx(/(^|,)\s*public\s*(,|$)/).test(cacheControl)
    ) {
      dep.isPrivate = false;
      const cacheData = { softExpireAt, etag };
      await packageCache.set(
        cacheNamespace,
        packageUrl,
        { ...dep, cacheData },
        etag ? cacheHardTtlMinutes : cacheMinutes
      );
    } else {
      dep.isPrivate = true;
    }
    return dep;
  } catch (err) {
    const ignoredStatusCodes = [401, 402, 403, 404];
    const ignoredResponseCodes = ['ENOTFOUND'];
    if (
      err.message === HOST_DISABLED ||
      ignoredStatusCodes.includes(err.statusCode) ||
      ignoredResponseCodes.includes(err.code)
    ) {
      return null;
    }
    if (uri.host === 'registry.npmjs.org') {
      if (cachedResult) {
        logger.warn(
          { err },
          'npmjs error, reusing expired cached result instead'
        );
        delete cachedResult.cacheData;
        return cachedResult;
      }
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
