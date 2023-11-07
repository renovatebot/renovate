import is from '@sindresorhus/is';
import { load } from 'js-yaml';
import { logger } from '../../../logger';
import { cache } from '../../../util/cache/package/decorator';
import { GithubHttp } from '../../../util/http/github';
import { ensureTrailingSlash, joinUrlParts } from '../../../util/url';
import * as allVersioning from '../../versioning';
import { Datasource } from '../datasource';
import type {
  DigestConfig,
  GetReleasesConfig,
  Release,
  ReleaseResult,
} from '../types';
import { isArtifactoryServer } from '../util';
import {
  conanDatasourceRegex,
  datasource,
  defaultRegistryUrl,
  getConanPackage,
} from './common';
import type {
  ConanJSON,
  ConanProperties,
  ConanRevisionJSON,
  ConanRevisionsJSON,
  ConanYAML,
} from './types';

export class ConanDatasource extends Datasource {
  static readonly id = datasource;

  override readonly defaultRegistryUrls = [defaultRegistryUrl];

  override readonly caching = true;

  override readonly registryStrategy = 'merge';

  githubHttp: GithubHttp;

  constructor(id = ConanDatasource.id) {
    super(id);
    this.githubHttp = new GithubHttp(id);
  }

  async getConanCenterReleases(
    conanName: string,
    userAndChannel: string,
  ): Promise<ReleaseResult | null> {
    if (userAndChannel && userAndChannel !== '@_/_') {
      logger.debug(
        { conanName, userAndChannel },
        'User/channel not supported for Conan Center lookups',
      );
      return null;
    }
    const url = `https://api.github.com/repos/conan-io/conan-center-index/contents/recipes/${conanName}/config.yml`;
    const res = await this.githubHttp.get(url, {
      headers: { accept: 'application/vnd.github.v3.raw' },
    });
    const doc = load(res.body, {
      json: true,
    }) as ConanYAML;
    return {
      releases: Object.keys(doc?.versions ?? {}).map((version) => ({
        version,
      })),
    };
  }

  @cache({
    namespace: `datasource-${datasource}-revisions`,
    key: ({ registryUrl, packageName }: DigestConfig, newValue?: string) =>
      // TODO: types (#22198)
      `${registryUrl!}:${packageName}:${newValue!}`,
  })
  override async getDigest(
    { registryUrl, packageName }: DigestConfig,
    newValue?: string,
  ): Promise<string | null> {
    if (is.undefined(newValue) || is.undefined(registryUrl)) {
      return null;
    }
    const url = ensureTrailingSlash(registryUrl);
    const conanPackage = getConanPackage(packageName);
    const revisionLookUp = joinUrlParts(
      url,
      'v2/conans/',
      conanPackage.conanName,
      newValue,
      conanPackage.userAndChannel,
      '/revisions',
    );
    const revisionRep =
      await this.http.getJson<ConanRevisionsJSON>(revisionLookUp);
    const revisions = revisionRep?.body.revisions;
    return revisions?.[0].revision ?? null;
  }

  @cache({
    namespace: `datasource-${datasource}`,
    key: ({ registryUrl, packageName }: GetReleasesConfig) =>
      // TODO: types (#22198)
      `${registryUrl}:${packageName}`,
  })
  async getReleases({
    registryUrl,
    packageName,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    const conanPackage = getConanPackage(packageName);
    const userAndChannel = '@' + conanPackage.userAndChannel;
    if (
      is.string(registryUrl) &&
      ensureTrailingSlash(registryUrl) === defaultRegistryUrl
    ) {
      return this.getConanCenterReleases(
        conanPackage.conanName,
        userAndChannel,
      );
    }

    logger.trace(
      { packageName, registryUrl },
      'Looking up conan api dependency',
    );

    if (registryUrl) {
      const url = ensureTrailingSlash(registryUrl);
      const lookupUrl = joinUrlParts(
        url,
        `v2/conans/search?q=${conanPackage.conanName}`,
      );

      try {
        const rep = await this.http.getJson<ConanJSON>(lookupUrl);
        const versions = rep?.body;
        if (versions) {
          logger.trace({ lookupUrl }, 'Got conan api result');
          const dep: ReleaseResult = { releases: [] };

          for (const resultString of Object.values(versions.results ?? {})) {
            conanDatasourceRegex.lastIndex = 0;
            const fromMatch = conanDatasourceRegex.exec(resultString);
            if (fromMatch?.groups?.version && fromMatch?.groups?.userChannel) {
              const version = fromMatch.groups.version;
              if (fromMatch.groups.userChannel === userAndChannel) {
                const result: Release = {
                  version,
                };
                dep.releases.push(result);
              }
            }
          }

          try {
            if (isArtifactoryServer(rep)) {
              const conanApiRegexp =
                /(?<host>.*)\/artifactory\/api\/conan\/(?<repo>[^/]+)/;
              const groups = url.match(conanApiRegexp)?.groups;
              if (!groups) {
                return dep;
              }
              const semver = allVersioning.get('semver');

              const sortedReleases = dep.releases
                .filter((release) => semver.isVersion(release.version))
                .sort((a, b) => semver.sortVersions(a.version, b.version));

              const latestVersion = sortedReleases.at(-1)?.version;

              if (!latestVersion) {
                return dep;
              }
              logger.debug(
                `Conan package ${packageName} has latest version ${latestVersion}`,
              );

              const latestRevisionUrl = joinUrlParts(
                url,
                `v2/conans/${conanPackage.conanName}/${latestVersion}/${conanPackage.userAndChannel}/latest`,
              );
              const revResp =
                await this.http.getJson<ConanRevisionJSON>(latestRevisionUrl);
              const packageRev = revResp.body.revision;

              const [user, channel] = conanPackage.userAndChannel.split('/');
              const packageUrl = joinUrlParts(
                `${groups.host}/artifactory/api/storage/${groups.repo}`,
                `${user}/${conanPackage.conanName}/${latestVersion}/${channel}/${packageRev}/export/conanfile.py?properties=conan.package.url`,
              );
              const packageUrlResp =
                await this.http.getJson<ConanProperties>(packageUrl);

              if (
                packageUrlResp.body.properties &&
                'conan.package.url' in packageUrlResp.body.properties
              ) {
                const conanPackageUrl =
                  packageUrlResp.body.properties['conan.package.url'][0];
                dep.sourceUrl = conanPackageUrl;
              }
            }
          } catch (err) {
            logger.debug({ err }, "Couldn't determine Conan package url");
          }
          return dep;
        }
      } catch (err) {
        this.handleGenericErrors(err);
      }
    }

    return null;
  }
}
