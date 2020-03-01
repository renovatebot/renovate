import delay from 'delay';
import moment from 'moment';
import url from 'url';
import getRegistryUrl from 'registry-auth-token/registry-url';
import registryAuthToken from 'registry-auth-token';
import isBase64 from 'validator/lib/isBase64';
import { OutgoingHttpHeaders } from 'http';
import is from '@sindresorhus/is';
import { logger } from '../../logger';
import got, { GotJSONOptions } from '../../util/got';
import { maskToken } from '../../util/mask';
import { getNpmrc } from './npmrc';
import { DatasourceError, Release, ReleaseResult } from '../common';
import { id } from './common';

let memcache = {};

export function resetMemCache(): void {
  logger.debug('resetMemCache()');
  memcache = {};
}

export function resetCache(): void {
  resetMemCache();
}

export interface NpmRelease extends Release {
  canBeUnpublished?: boolean;
  gitRef?: string;
}
export interface NpmDependency extends ReleaseResult {
  releases: NpmRelease[];
  deprecationSource?: string;
  name: string;
  homepage: string;
  latestVersion: string;
  sourceUrl: string;
  versions: Record<string, any>;
  'dist-tags': string[];
  'renovate-config': any;
  sourceDirectory?: string;
}

export async function getDependency(
  packageName: string,
  retries = 3
): Promise<NpmDependency | null> {
  logger.trace(`npm.getDependency(${packageName})`);

  // This is our datastore cache and is cleared at the end of each repo, i.e. we never requery/revalidate during a "run"
  if (memcache[packageName]) {
    logger.trace('Returning cached result');
    return JSON.parse(memcache[packageName]);
  }

  const scope = packageName.split('/')[0];
  let regUrl: string;
  const npmrc = getNpmrc();
  try {
    regUrl = getRegistryUrl(scope, npmrc);
  } catch (err) {
    regUrl = 'https://registry.npmjs.org';
  }
  const pkgUrl = url.resolve(
    regUrl,
    encodeURIComponent(packageName).replace(/^%40/, '@')
  );
  // Now check the persistent cache
  const cacheNamespace = 'datasource-npm';
  const cachedResult = await renovateCache.get<NpmDependency>(
    cacheNamespace,
    pkgUrl
  );
  // istanbul ignore if
  if (cachedResult) {
    return cachedResult;
  }
  const authInfo = registryAuthToken(regUrl, { npmrc });
  const headers: OutgoingHttpHeaders = {};

  if (authInfo && authInfo.type && authInfo.token) {
    // istanbul ignore if
    if (npmrc && npmrc.massagedAuth && isBase64(authInfo.token)) {
      logger.debug('Massaging authorization type to Basic');
      authInfo.type = 'Basic';
    }
    headers.authorization = `${authInfo.type} ${authInfo.token}`;
    logger.trace(
      { token: maskToken(authInfo.token), npmName: packageName },
      'Using auth for npm lookup'
    );
  } else if (process.env.NPM_TOKEN && process.env.NPM_TOKEN !== 'undefined') {
    headers.authorization = `Bearer ${process.env.NPM_TOKEN}`;
  }

  const uri = url.parse(pkgUrl);

  if (uri.host === 'registry.npmjs.org' && !uri.pathname.startsWith('/@')) {
    // Delete the authorization header for non-scoped public packages to improve http caching
    // Otherwise, authenticated requests are not cacheable until the registry adds "public" to Cache-Control
    // Ref: https://greenbytes.de/tech/webdav/rfc7234.html#caching.authenticated.responses
    delete headers.authorization;
  }

  // This tells our http layer not to serve responses directly from the cache and instead to revalidate them every time
  headers['Cache-Control'] = 'no-cache';

  try {
    const useCache = retries === 3; // Disable cache if we're retrying
    const opts: GotJSONOptions = {
      hostType: id,
      json: true,
      retry: 5,
      headers,
      useCache,
      readableHighWaterMark: 1024 * 1024 * 10, // https://github.com/sindresorhus/got/issues/1062#issuecomment-586580036
    };
    const raw = await got(pkgUrl, opts);
    // istanbul ignore if
    if (retries < 3) {
      logger.debug({ pkgUrl, retries }, 'Recovered from npm error');
    }
    const res = raw.body;
    // eslint-disable-next-line no-underscore-dangle
    const returnedName = res.name ? res.name : res._id || '';
    if (returnedName.toLowerCase() !== packageName.toLowerCase()) {
      logger.warn(
        { lookupName: packageName, returnedName: res.name, regUrl },
        'Returned name does not match with requested name'
      );
      return null;
    }
    if (!res.versions || !Object.keys(res.versions).length) {
      // Registry returned a 200 OK but with no versions
      logger.debug({ dependency: packageName }, 'No versions returned');
      return null;
    }

    const latestVersion = res.versions[res['dist-tags'].latest];
    res.repository = res.repository || latestVersion.repository;
    res.homepage = res.homepage || latestVersion.homepage;

    // Determine repository URL
    let sourceUrl: string;

    if (res.repository) {
      if (is.string(res.repository)) {
        sourceUrl = res.repository;
      } else if (res.repository.url) {
        sourceUrl = res.repository.url;
      }
    }
    // Simplify response before caching and returning
    const dep: NpmDependency = {
      name: res.name,
      homepage: res.homepage,
      latestVersion: res['dist-tags'].latest,
      sourceUrl,
      versions: {},
      releases: null,
      'dist-tags': res['dist-tags'],
      'renovate-config': latestVersion['renovate-config'],
    };
    if (res.repository && res.repository.directory) {
      dep.sourceDirectory = res.repository.directory;
    }
    if (latestVersion.deprecated) {
      dep.deprecationMessage = `On registry \`${regUrl}\`, the "latest" version (v${dep.latestVersion}) of dependency \`${packageName}\` has the following deprecation notice:\n\n\`${latestVersion.deprecated}\`\n\nMarking the latest version of an npm package as deprecated results in the entire package being considered deprecated, so contact the package author you think this is a mistake.`;
      dep.deprecationSource = id;
    }
    dep.releases = Object.keys(res.versions).map(version => {
      const release: NpmRelease = {
        version,
        gitRef: res.versions[version].gitHead,
      };
      if (res.time && res.time[version]) {
        release.releaseTimestamp = res.time[version];
        release.canBeUnpublished =
          moment().diff(moment(release.releaseTimestamp), 'days') === 0;
      }
      if (res.versions[version].deprecated) {
        release.isDeprecated = true;
      }
      return release;
    });
    logger.trace({ dep }, 'dep');
    // serialize first before saving
    memcache[packageName] = JSON.stringify(dep);
    const cacheMinutes = process.env.RENOVATE_CACHE_NPM_MINUTES
      ? parseInt(process.env.RENOVATE_CACHE_NPM_MINUTES, 10)
      : 5;
    if (!packageName.startsWith('@')) {
      await renovateCache.set(cacheNamespace, pkgUrl, dep, cacheMinutes);
    }
    return dep;
  } catch (err) {
    if (err.statusCode === 401 || err.statusCode === 403) {
      logger.debug(
        {
          pkgUrl,
          authInfoType: authInfo ? authInfo.type : undefined,
          authInfoToken: authInfo ? maskToken(authInfo.token) : undefined,
          err,
          statusCode: err.statusCode,
          packageName,
        },
        `Dependency lookup failure: unauthorized`
      );
      return null;
    }
    // istanbul ignore if
    if (err.statusCode === 402) {
      logger.debug(
        {
          pkgUrl,
          authInfoType: authInfo ? authInfo.type : undefined,
          authInfoToken: authInfo ? maskToken(authInfo.token) : undefined,
          err,
          statusCode: err.statusCode,
          packageName,
        },
        `Dependency lookup failure: payent required`
      );
      return null;
    }
    if (err.statusCode === 404 || err.code === 'ENOTFOUND') {
      logger.debug({ packageName }, `Dependency lookup failure: not found`);
      logger.debug({
        err,
        token: authInfo ? maskToken(authInfo.token) : 'none',
      });
      return null;
    }
    if (uri.host === 'registry.npmjs.org') {
      // istanbul ignore if
      if (
        (err.name === 'ParseError' || err.code === 'ECONNRESET') &&
        retries > 0
      ) {
        logger.warn({ pkgUrl, errName: err.name }, 'Retrying npm error');
        await delay(5000);
        return getDependency(packageName, retries - 1);
      }
      // istanbul ignore if
      if (err.name === 'ParseError' && err.body) {
        err.body = 'err.body deleted by Renovate';
      }
      throw new DatasourceError(err);
    }
    // istanbul ignore next
    return null;
  }
}
