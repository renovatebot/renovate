import url from 'node:url';
import is from '@sindresorhus/is';
import { DateTime } from 'luxon';
import { GlobalConfig } from '../../../config/global';
import { HOST_DISABLED } from '../../../constants/error-messages';
import { logger } from '../../../logger';
import { ExternalHostError } from '../../../types/errors/external-host-error';
import * as packageCache from '../../../util/cache/package';
import * as hostRules from '../../../util/host-rules';
import type { Http } from '../../../util/http';
import type { HttpOptions } from '../../../util/http/types';
import { regEx } from '../../../util/regex';
import { HttpCacheStats } from '../../../util/stats';
import { joinUrlParts } from '../../../util/url';
import type { Release, ReleaseResult } from '../types';
import { NpmResponse } from './schema';
import type { CachedReleaseResult } from './types';

export const CACHE_REVISION = 1;

export async function getDependency(
  http: Http,
  registryUrl: string,
  packageName: string,
): Promise<ReleaseResult | null> {
  logger.trace(`npm.getDependency(${packageName})`);

  const packageUrl = joinUrlParts(registryUrl, packageName.replace('/', '%2F'));

  // Now check the persistent cache
  const cacheNamespace = 'datasource-npm:data';
  const cachedResult = await packageCache.get<CachedReleaseResult>(
    cacheNamespace,
    packageUrl,
  );
  if (cachedResult?.cacheData) {
    if (cachedResult.cacheData.revision === CACHE_REVISION) {
      const softExpireAt = DateTime.fromISO(
        cachedResult.cacheData.softExpireAt,
      );
      if (softExpireAt.isValid && softExpireAt > DateTime.local()) {
        logger.trace('Cached result is not expired - reusing');
        HttpCacheStats.incLocalHits(packageUrl);
        delete cachedResult.cacheData;
        return cachedResult;
      }

      logger.trace('Cached result is soft expired');
      HttpCacheStats.incLocalMisses(packageUrl);
    } else {
      logger.trace(
        `Package cache for npm package "${packageName}" is from an old revision - discarding`,
      );
      delete cachedResult.cacheData;
    }
  }
  const cacheMinutes = 15;
  const softExpireAt = DateTime.local().plus({ minutes: cacheMinutes }).toISO();
  let cacheHardTtlMinutes = GlobalConfig.get('cacheHardTtlMinutes');
  if (
    !(
      is.number(cacheHardTtlMinutes) &&
      /* istanbul ignore next: needs test */ cacheHardTtlMinutes > cacheMinutes
    )
  ) {
    cacheHardTtlMinutes = cacheMinutes;
  }

  const uri = url.parse(packageUrl);

  try {
    const options: HttpOptions = {};
    if (cachedResult?.cacheData?.etag) {
      logger.trace({ packageName }, 'Using cached etag');
      options.headers = { 'If-None-Match': cachedResult.cacheData.etag };
    }

    // set abortOnError for registry.npmjs.org if no hostRule with explicit abortOnError exists
    if (
      registryUrl === 'https://registry.npmjs.org' &&
      hostRules.find({ url: 'https://registry.npmjs.org' })?.abortOnError ===
        undefined
    ) {
      logger.trace(
        { packageName, registry: 'https://registry.npmjs.org' },
        'setting abortOnError hostRule for well known host',
      );
      hostRules.add({
        matchHost: 'https://registry.npmjs.org',
        abortOnError: true,
      });
    }

    const raw = await http.getJson(packageUrl, options, NpmResponse);
    if (cachedResult?.cacheData && raw.statusCode === 304) {
      logger.trace(`Cached npm result for ${packageName} is revalidated`);
      HttpCacheStats.incRemoteHits(packageUrl);
      cachedResult.cacheData.softExpireAt = softExpireAt;
      await packageCache.set(
        cacheNamespace,
        packageUrl,
        cachedResult,
        cacheHardTtlMinutes,
      );
      delete cachedResult.cacheData;
      return cachedResult;
    }
    HttpCacheStats.incRemoteMisses(packageUrl);
    const etag = raw.headers.etag;
    const res = raw.body;
    if (!res.versions || !Object.keys(res.versions).length) {
      // Registry returned a 200 OK but with no versions
      logger.debug(`No versions returned for npm dependency ${packageName}`);
      return null;
    }

    const { latestVersion, tags } = res;

    // Simplify response before caching and returning
    const dep: ReleaseResult = {
      releases: [],
      tags,
      registryUrl,
    };

    const homepage = res.homepage ?? latestVersion?.homepage;
    if (homepage) {
      res.homepage = homepage;
    }

    const repo = res.repository ?? latestVersion?.repository;

    if (repo?.url) {
      dep.sourceUrl = repo.url;
    }

    if (repo?.directory) {
      dep.sourceDirectory = repo.directory;
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
      const nodeConstraint = res.versions?.[version].engines?.node;
      if (is.nonEmptyString(nodeConstraint)) {
        release.constraints = { node: [nodeConstraint] };
      }
      const repo = res.versions?.[version].repository;
      const sourceUrl = repo?.url;
      if (sourceUrl && sourceUrl !== dep.sourceUrl) {
        release.sourceUrl = sourceUrl;
      }
      const sourceDirectory = repo?.directory;
      if (sourceDirectory && sourceDirectory !== dep.sourceDirectory) {
        release.sourceDirectory = sourceDirectory;
      }
      if (dep.deprecationMessage) {
        release.isDeprecated = true;
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
      const cacheData = { revision: CACHE_REVISION, softExpireAt, etag };
      await packageCache.set(
        cacheNamespace,
        packageUrl,
        { ...dep, cacheData },
        etag
          ? /* istanbul ignore next: needs test */ cacheHardTtlMinutes
          : cacheMinutes,
      );
    } else {
      dep.isPrivate = true;
    }
    return dep;
  } catch (err) {
    const actualError = err instanceof ExternalHostError ? err.err : err;
    const ignoredStatusCodes = [401, 402, 403, 404];
    const ignoredResponseCodes = ['ENOTFOUND'];
    if (
      actualError.message === HOST_DISABLED ||
      ignoredStatusCodes.includes(actualError.statusCode) ||
      ignoredResponseCodes.includes(actualError.code)
    ) {
      return null;
    }

    if (err instanceof ExternalHostError) {
      if (cachedResult) {
        logger.warn(
          { err, host: uri.host },
          `npm host error, reusing expired cached result instead`,
        );
        delete cachedResult.cacheData;
        return cachedResult;
      }

      if (actualError.name === 'ParseError' && actualError.body) {
        actualError.body = 'err.body deleted by Renovate';
        err.err = actualError;
      }
      throw err;
    }
    logger.debug({ err }, 'Unknown npm lookup error');
    return null;
  }
}
