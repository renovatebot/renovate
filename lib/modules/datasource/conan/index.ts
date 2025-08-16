import is from '@sindresorhus/is';
import { logger } from '../../../logger';
import { cache } from '../../../util/cache/package/decorator';
import { GithubHttp } from '../../../util/http/github';
import { regEx } from '../../../util/regex';
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
import { datasource, defaultRegistryUrl, getConanPackage } from './common';
import {
  ConanCenterReleases,
  ConanJSON,
  ConanLatestRevision,
  ConanProperties,
  ConanRevisionJSON,
} from './schema';

export class ConanDatasource extends Datasource {
  static readonly id = datasource;

  override readonly defaultRegistryUrls = [defaultRegistryUrl];

  override readonly caching = true;

  override readonly registryStrategy = 'merge';

  githubHttp: GithubHttp;

  override readonly sourceUrlSupport = 'package';
  override readonly sourceUrlNote =
    'The source URL is supported only if the package is served from the Artifactory servers. In which case we determine it from the `properties[conan.package.url]` field in the results.';

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
    const { body: result } = await this.githubHttp.getYaml(
      url,
      { headers: { accept: 'application/vnd.github.v3.raw' } },
      ConanCenterReleases,
    );
    return result;
  }

  @cache({
    namespace: `datasource-${datasource}`,
    key: ({ registryUrl, packageName }: DigestConfig, newValue?: string) =>
      // TODO: types (#22198)
      `getDigest:${registryUrl!}:${packageName}:${newValue!}`,
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
    const { body: digest } = await this.http.getJson(
      revisionLookUp,
      ConanLatestRevision,
    );
    return digest;
  }

  @cache({
    namespace: `datasource-${datasource}`,
    key: ({ registryUrl, packageName }: GetReleasesConfig) =>
      // TODO: types (#22198)
      `getReleases:${registryUrl}:${packageName}`,
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
        const rep = await this.http.getJsonUnchecked(lookupUrl);
        const conanJson = ConanJSON.parse(rep.body);
        if (conanJson) {
          logger.trace({ lookupUrl }, 'Got conan api result');
          const dep: ReleaseResult = { releases: [] };

          const conanJsonReleases: Release[] = conanJson
            .filter(({ userChannel }) => userChannel === userAndChannel)
            .map(({ version }) => ({ version }));
          dep.releases.push(...conanJsonReleases);

          try {
            if (isArtifactoryServer(rep)) {
              const conanApiRegexp = regEx(
                /(?<host>.*)\/artifactory\/api\/conan\/(?<repo>[^/]+)/,
              );
              const groups = conanApiRegexp.exec(url)?.groups;
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
              const {
                body: { revision: packageRev },
              } = await this.http.getJson(latestRevisionUrl, ConanRevisionJSON);

              const [user, channel] = conanPackage.userAndChannel.split('/');
              const packageUrl = joinUrlParts(
                `${groups.host}/artifactory/api/storage/${groups.repo}`,
                `${user}/${conanPackage.conanName}/${latestVersion}/${channel}/${packageRev}/export/conanfile.py?properties=conan.package.url`,
              );
              const { body: conanProperties } = await this.http.getJson(
                packageUrl,
                ConanProperties,
              );
              const { sourceUrl } = conanProperties;
              if (sourceUrl) {
                dep.sourceUrl = sourceUrl;
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
