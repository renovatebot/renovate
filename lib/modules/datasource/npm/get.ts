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
import { LooseRecord } from '../../../util/schema-utils';
import { joinUrlParts } from '../../../util/url';
import type { Release, ReleaseResult } from '../types';
import type { CachedReleaseResult } from './types';

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

const DepResponse = z
  .object({
    versions: LooseRecord(
      z.object({
        repository: PackageSource,
        homepage: z.string().nullish().catch(null),
        deprecated: z.string().nullish().catch('Unknown deprecation reason'),
        gitHead: z.string().nullish().catch(null),
        dependencies: LooseRecord(z.string()).nullish().catch(null),
        devDependencies: LooseRecord(z.string()).nullish().catch(null),
      })
    ).catch({}),
    repository: PackageSource,
    homepage: z.string().nullish().catch(null),
    time: LooseRecord(z.string()).catch({}),
    'dist-tags': LooseRecord(z.string()).nullish().catch(null),
  })
  .transform((body) => {
    const { time, versions, 'dist-tags': tags, repository } = body;

    const latestTag = tags?.latest;
    const latestVersion = latestTag ? versions[latestTag] : undefined;

    const homepage = body.homepage ?? latestVersion?.homepage;

    const latestVersionRepository = latestVersion?.repository ?? repository;
    const sourceUrl = repository.sourceUrl ?? latestVersionRepository.sourceUrl;
    const sourceDirectory =
      repository.sourceDirectory ?? latestVersionRepository.sourceDirectory;

    const deprecationMessage = latestVersion?.deprecated;

    return {
      time,
      versions,
      tags,
      latestTag,
      latestVersion,
      homepage,
      sourceUrl,
      sourceDirectory,
      deprecationMessage,
    };
  })
  .transform(
    ({
      homepage,
      sourceUrl,
      sourceDirectory,
      tags,
      versions,
      time,
      deprecationMessage,
    }): ReleaseResult | null => {
      if (is.emptyObject(versions)) {
        return null;
      }

      const result: ReleaseResult = { releases: [] };

      if (homepage) {
        result.homepage = homepage;
      }

      if (sourceUrl) {
        result.sourceUrl = sourceUrl;
      }

      if (sourceDirectory) {
        result.sourceDirectory = sourceDirectory;
      }

      if (tags) {
        result.tags = tags;
      }

      if (deprecationMessage) {
        result.deprecationMessage = deprecationMessage;
      }

      for (const [version, versionInfo] of Object.entries(versions)) {
        const {
          gitHead: gitRef,
          dependencies,
          devDependencies,
          deprecated,
          repository: src,
        } = versionInfo;

        const release: Release = { version };

        if (gitRef) {
          release.gitRef = gitRef;
        }

        if (dependencies) {
          release.dependencies = dependencies;
        }

        if (devDependencies) {
          release.devDependencies = devDependencies;
        }

        if (deprecated) {
          release.isDeprecated = true;
        }

        const releaseTimestamp = time[version];
        if (releaseTimestamp) {
          release.releaseTimestamp = releaseTimestamp;
        }

        if (src.sourceUrl && src.sourceUrl !== sourceUrl) {
          release.sourceUrl = src.sourceUrl;
        }

        if (src.sourceDirectory && src.sourceDirectory !== sourceDirectory) {
          release.sourceDirectory = src.sourceDirectory;
        }

        result.releases.push(release);
      }

      return result;
    }
  )
  .catch(null);

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

  try {
    const options: HttpOptions = {};
    if (cachedResult?.cacheData?.etag) {
      logger.trace({ packageName }, 'Using cached etag');
      options.headers = { 'If-None-Match': cachedResult.cacheData.etag };
    }
    const res = await http.getJson(packageUrl, options, DepResponse);
    if (cachedResult?.cacheData && res.statusCode === 304) {
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
    const etag = res.headers.etag;
    const dep = res.body;
    if (!dep) {
      // Registry returned a 200 OK but with no versions
      logger.debug(`No versions returned for npm dependency ${packageName}`);
      return null;
    }

    dep.registryUrl = registryUrl;
    if (dep.deprecationMessage) {
      dep.deprecationMessage = `On registry \`${registryUrl}\`, the "latest" version of dependency \`${packageName}\` has the following deprecation notice:\n\n\`${dep.deprecationMessage}\`\n\nMarking the latest version of an npm package as deprecated results in the entire package being considered deprecated, so contact the package author you think this is a mistake.`;
    }
    logger.trace({ dep }, 'dep');
    const cacheControl = res.headers?.['cache-control'];
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
    const uri = url.parse(packageUrl);
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
