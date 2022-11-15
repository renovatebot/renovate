import type { HttpResponse } from '../../../util/http/types';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, ReleaseResult } from '../types';
import type { DartResult } from './types';

export class DartDatasource extends Datasource {
  static readonly id = 'dart';

  constructor() {
    super(DartDatasource.id);
  }

  override readonly customRegistrySupport = false;

  override readonly defaultRegistryUrls = ['https://pub.dartlang.org/'];

  async getReleases({
    packageName,
    registryUrl,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    // istanbul ignore if
    if (!registryUrl) {
      return null;
    }
    let result: ReleaseResult | null = null;
    const pkgUrl = `${registryUrl}api/packages/${packageName}`;

    let raw: HttpResponse<DartResult> | null = null;
    try {
      raw = await this.http.getJson<DartResult>(pkgUrl);
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
