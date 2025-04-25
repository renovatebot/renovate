import is from '@sindresorhus/is';
import { logger } from '../../../logger';
import { cache } from '../../../util/cache/package/decorator';
import { detectPlatform } from '../../../util/common';
import { parseGitUrl } from '../../../util/git/url';
import { GithubHttp } from '../../../util/http/github';
import { fromBase64 } from '../../../util/string';
import { joinUrlParts } from '../../../util/url';
import { GithubContentResponse } from '../../platform/github/schema';
import semver from '../../versioning/semver';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, ReleaseResult } from '../types';
import { BitriseStepFile } from './schema';

export class BitriseDatasource extends Datasource {
  static readonly id = 'bitrise';

  override readonly http: GithubHttp;

  constructor() {
    super(BitriseDatasource.id);

    this.http = new GithubHttp(this.id);
  }

  override readonly customRegistrySupport = true;

  override readonly defaultRegistryUrls = [
    'https://github.com/bitrise-io/bitrise-steplib.git',
  ];

  override readonly releaseTimestampSupport = true;
  override readonly releaseTimestampNote =
    'The release timestamp is determined from the `published_at` field in the results.';
  override readonly sourceUrlSupport = 'release';
  override readonly sourceUrlNote =
    'The source URL is determined from the `source_code_url` field of the release object in the results.';

  @cache({
    namespace: `datasource-${BitriseDatasource.id}`,
    key: ({ packageName, registryUrl }: GetReleasesConfig) =>
      `${registryUrl}/${packageName}`,
  })
  async getReleases({
    packageName,
    registryUrl,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    /* v8 ignore next 3 -- should never happen */
    if (!registryUrl) {
      return null;
    }

    const parsedUrl = parseGitUrl(registryUrl);
    if (detectPlatform(registryUrl) !== 'github') {
      logger.once.warn(
        `${parsedUrl.source} is not a supported Git hoster for this datasource`,
      );
      return null;
    }

    const result: ReleaseResult = {
      releases: [],
    };

    const massagedPackageName = encodeURIComponent(packageName);
    const baseApiURL =
      parsedUrl.resource === 'github.com'
        ? 'https://api.github.com'
        : `https://${parsedUrl.resource}/api/v3`;
    const packageUrl = joinUrlParts(
      baseApiURL,
      'repos',
      parsedUrl.full_name,
      'contents/steps',
      massagedPackageName,
    );

    const { body: packageRaw } = await this.http.getJson(
      packageUrl,
      GithubContentResponse,
    );

    if (!is.array(packageRaw)) {
      logger.warn(
        { data: packageRaw, url: packageUrl },
        'Got unexpected response for Bitrise package location',
      );
      return null;
    }

    for (const versionDir of packageRaw.filter((element) =>
      semver.isValid(element.name),
    )) {
      const stepUrl = joinUrlParts(packageUrl, versionDir.name, 'step.yml');
      // TODO use getRawFile when ready #30155
      const { body } = await this.http.getJson(stepUrl, GithubContentResponse);
      if (!('content' in body)) {
        logger.warn(
          { data: body, url: stepUrl },
          'Got unexpected response for Bitrise step location',
        );
        return null;
      }
      if (body.encoding !== 'base64') {
        logger.warn(
          { encoding: body.encoding, data: body, url: stepUrl },
          `Got unexpected encoding for Bitrise step location`,
        );
        return null;
      }

      const content = fromBase64(body.content);
      const { published_at, source_code_url } = BitriseStepFile.parse(content);

      result.releases.push({
        version: versionDir.name,
        releaseTimestamp: published_at,
        sourceUrl: source_code_url,
      });
    }

    // if we have no releases return null
    if (!result.releases.length) {
      return null;
    }

    return {
      ...result,
      homepage: `https://bitrise.io/integrations/steps/${packageName}`,
    };
  }
}
