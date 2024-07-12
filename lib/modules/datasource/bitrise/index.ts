import is from '@sindresorhus/is';
import { logger } from '../../../logger';
import { cache } from '../../../util/cache/package/decorator';
import { detectPlatform } from '../../../util/common';
import { parseGitUrl } from '../../../util/git/url';
import { GithubHttp } from '../../../util/http/github';
import { joinUrlParts } from '../../../util/url';
import { parseSingleYaml } from '../../../util/yaml';
import { GithubDirectoryResponse } from '../../platform/github/schema';
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
    // istanbul ignore if
    if (!registryUrl) {
      return null;
    }

    const parsedUrl = parseGitUrl(registryUrl);
    if (detectPlatform(registryUrl) !== 'github') {
      logger.warn(
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

    const response = await this.http.getJson(
      packageUrl,
      GithubDirectoryResponse,
    );

    for (const versionDir of response.body.filter((element) =>
      semver.isValid(element.name),
    )) {
      const stepUrl = joinUrlParts(packageUrl, versionDir.name, 'step.yml');
      const file = await this.http.getRawFile(stepUrl);
      const { published_at, source_code_url } = parseSingleYaml(file.body, {
        customSchema: BitriseStepFile,
      });

      const releaseTimestamp = is.string(published_at)
        ? published_at
        : published_at.toISOString();
      result.releases.push({
        version: versionDir.name,
        releaseTimestamp,
        sourceUrl: source_code_url,
      });
    }

    return result;
  }
}
