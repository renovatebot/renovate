import is from '@sindresorhus/is';
import jsonata from 'jsonata';
import { readLocalFile } from '../../../util/fs';
import { parseUrl } from '../../../util/url';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, ReleaseResult } from '../types';

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
      // TODO add logging
      return null;
    }

    const url = parseUrl(registryUrl);
    if (is.nullOrUndefined(url)) {
      //TODO add logging
      return null;
    }

    let response: string | null = null;
    switch (url.protocol) {
      case 'http':
      case 'https':
        response = (await this.http.get(registryUrl)).body;
        break;
      case 'file':
        response = await readLocalFile(
          registryUrl.replace('file://', ''),
          'utf8'
        );
        break;
      default:
        //TODO logging
        return null;
    }

    if (!is.nonEmptyString(response)) {
      // TODO logging
      return null;
    }

    const expression = jsonata(packageName);

    const parsedResponse = await expression.evaluate(response);
    if (!isReleaseResult(parsedResponse)) {
      //TODO add logging
      return null;
    }

    // manually copy to prevent leaking data into other systems
    const releases = parsedResponse.releases.map((value) => {
      return {
        version: value.version,
        isDeprecated: value.isDeprecated,
        releaseTimestamp: value.releaseTimestamp,
        changelogUrl: value.changelogUrl,
        sourceUrl: value.sourceUrl,
        sourceDirectory: value.sourceDirectory,
      };
    });

    const result: ReleaseResult = {
      sourceUrl: parsedResponse.sourceUrl,
      sourceDirectory: parsedResponse.sourceDirectory,
      changelogUrl: parsedResponse.changelogUrl,
      homepage: parsedResponse.homepage,
      releases,
    };

    return result;
  }
}

function isReleaseResult(input: unknown): input is ReleaseResult {
  return (
    is.plainObject(input) &&
    is.nonEmptyArray(input?.releases) &&
    input.releases.every(
      (release) =>
        is.plainObject(release) && !is.nullOrUndefined(release?.version)
    )
  );
}
