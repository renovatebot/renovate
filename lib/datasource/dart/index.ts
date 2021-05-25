import { HttpResponse } from '../../util/http';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, ReleaseResult } from '../types';
import type { DartResult } from './types';

export class DartDatasource extends Datasource {
  static readonly id = 'dart';

  constructor() {
    super(DartDatasource.id);
  }

  readonly customRegistrySupport = false;

  readonly defaultRegistryUrls = ['https://pub.dartlang.org/'];

  async getReleases({
    lookupName,
    registryUrl,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    let result: ReleaseResult = null;
    const pkgUrl = `${registryUrl}api/packages/${lookupName}`;

    let raw: HttpResponse<DartResult> = null;
    try {
      raw = await this.http.getJson<DartResult>(pkgUrl);
    } catch (err) {
      this.handleGenericErrors(err);
    }

    const body = raw?.body;
    if (body) {
      const { versions, latest } = body;
      if (versions && latest) {
        result = {
          releases: body.versions.map(({ version, published }) => ({
            version,
            releaseTimestamp: published,
          })),
        };

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
