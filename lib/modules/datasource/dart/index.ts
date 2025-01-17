import type { HttpResponse } from '../../../util/http/types';
import { ensureTrailingSlash } from '../../../util/url';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, ReleaseResult } from '../types';
import type { DartResult } from './types';

export class DartDatasource extends Datasource {
  static readonly id = 'dart';

  constructor() {
    super(DartDatasource.id);
  }

  override readonly customRegistrySupport = true;

  override readonly defaultRegistryUrls = ['https://pub.dartlang.org/'];

  override readonly releaseTimestampSupport = true;
  override readonly releaseTimestampNote =
    'The release timestamp is determined from the `published` field in the results.';
  override readonly sourceUrlSupport = 'package';
  override readonly sourceUrlNote =
    'The source URL is determined from the `repository` field of the latest release object in the results.';

  async getReleases({
    packageName,
    registryUrl,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    // istanbul ignore if
    if (!registryUrl) {
      return null;
    }
    let result: ReleaseResult | null = null;
    const pkgUrl = `${ensureTrailingSlash(
      registryUrl,
    )}api/packages/${packageName}`;

    let raw: HttpResponse<DartResult> | null = null;
    try {
      raw = await this.http.getJsonUnchecked<DartResult>(pkgUrl);
    } catch (err) {
      this.handleGenericErrors(err);
    }

    const body = raw?.body;
    if (body) {
      const { versions, latest } = body;
      const releases = versions
        ?.filter(({ retracted }) => !retracted)
        ?.map(({ version, published }) => ({
          version,
          releaseTimestamp: published,
        }));
      if (releases && latest) {
        result = { releases };

        const pubspec = latest.pubspec;
        if (pubspec) {
          if (pubspec.homepage) {
            result.homepage = pubspec.homepage;
          }

          if (pubspec.repository) {
            result.sourceUrl = pubspec.repository;
          }
        }
      }
    }
    return result;
  }
}
