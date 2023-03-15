import is from '@sindresorhus/is';
import jsonata from 'jsonata';
import { logger } from '../../../logger';
import { readLocalFile } from '../../../util/fs';
import { parseUrl } from '../../../util/url';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, ReleaseResult } from '../types';
import { ReleaseResultZod } from './types';

export class JsonDatasource extends Datasource {
  static readonly id = 'json';

  override caching = true;
  override customRegistrySupport = true;

  constructor() {
    super(JsonDatasource.id);
  }

  async getReleases({
    registryUrl,
    packageName,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    if (is.nullOrUndefined(registryUrl)) {
      return null;
    }

    const url = parseUrl(registryUrl);
    if (is.nullOrUndefined(url)) {
      logger.debug(`Failed to parse url ${registryUrl}`);
      return null;
    }

    let response: string | null = null;
    switch (url.protocol) {
      case 'http:':
      case 'https:':
        response = (await this.http.get(registryUrl)).body;
        break;
      case 'file:':
        response = await readLocalFile(
          registryUrl.replace('file://', ''),
          'utf8'
        );
        break;
      default:
        logger.debug(`Scheme ${url.protocol} is not supported`);
        return null;
    }

    if (!is.nonEmptyString(response)) {
      return null;
    }

    const expression = jsonata(packageName);

    const jsonObject = JSON.parse(response);

    // wildcard means same object
    const evaluated =
      packageName === '*' ? jsonObject : await expression.evaluate(jsonObject);

    const parsed = ReleaseResultZod.safeParse(evaluated);
    if (!parsed.success) {
      logger.debug({ err: parsed.error }, 'Response has failed validation');
      return null;
    }

    const cleanedResponse = parsed.data;
    // manually copy to prevent leaking data into other systems
    const releases = cleanedResponse.releases.map((value) => ({
      version: value.version,
      isDeprecated: value.isDeprecated,
      releaseTimestamp: value.releaseTimestamp,
      changelogUrl: value.changelogUrl,
      sourceUrl: value.sourceUrl,
      sourceDirectory: value.sourceDirectory,
    }));

    return {
      sourceUrl: cleanedResponse.sourceUrl,
      sourceDirectory: cleanedResponse.sourceDirectory,
      changelogUrl: cleanedResponse.changelogUrl,
      homepage: cleanedResponse.homepage,
      releases,
    };
  }
}
