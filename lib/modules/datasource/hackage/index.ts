import { joinUrlParts } from '../../../util/url';
import * as pvpVersioning from '../../versioning/pvp';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, Release, ReleaseResult } from '../types';

export class HackageDatasource extends Datasource {
  static readonly id = 'hackage';

  constructor() {
    super(HackageDatasource.id);
  }

  override readonly defaultVersioning = pvpVersioning.id;
  override readonly customRegistrySupport = false;
  override readonly defaultRegistryUrls = ['https://hackage.haskell.org/'];

  async getReleases(config: GetReleasesConfig): Promise<ReleaseResult | null> {
    // istanbul ignore if
    if (typeof config.registryUrl === 'undefined') {
      return null;
    }
    const massagedPackageName = encodeURIComponent(config.packageName);
    const url = joinUrlParts(
      config.registryUrl,
      `package/${massagedPackageName}.json`,
    );
    const res = await this.http.getJson(url);
    const keys = Object.keys(res.body as object);
    return {
      releases: keys.map((version) =>
        versionToRelease(version, config.packageName),
      ),
    };
  }
}

export function versionToRelease(
  version: string,
  packageName: string,
): Release {
  return {
    version,
    releaseTimestamp: null,
    isStable: true,
    changelogUrl:
      'https://hackage.haskell.org/package/' +
      packageName +
      '-' +
      version +
      '/changelog',
  };
}
