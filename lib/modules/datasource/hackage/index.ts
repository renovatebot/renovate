import is from '@sindresorhus/is';
import { joinUrlParts } from '../../../util/url';
import * as pvpVersioning from '../../versioning/pvp';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, Release, ReleaseResult } from '../types';
import { HackagePackageMetadata } from './schema';

export class HackageDatasource extends Datasource {
  static readonly id = 'hackage';

  constructor() {
    super(HackageDatasource.id);
  }

  override readonly defaultVersioning = pvpVersioning.id;
  override readonly customRegistrySupport = false;
  override readonly defaultRegistryUrls = ['https://hackage.haskell.org/'];

  async getReleases(config: GetReleasesConfig): Promise<ReleaseResult | null> {
    if (!is.nonEmptyString(config.registryUrl)) {
      return null;
    }
    const massagedPackageName = encodeURIComponent(config.packageName);
    const url = joinUrlParts(
      config.registryUrl,
      'package',
      `${massagedPackageName}.json`,
    );
    const res = await this.http.getJson(url, HackagePackageMetadata);
    const keys = Object.keys(res.body);
    return {
      releases: keys.map((version) =>
        versionToRelease(version, config.packageName, config.registryUrl),
      ),
    };
  }
}

export function versionToRelease(
  version: string,
  packageName: string,
  registryUrl: string,
): Release {
  return {
    version,
    releaseTimestamp: null,
    isStable: true,
    changelogUrl: joinUrlParts(
      registryUrl,
      'package',
      `${packageName}-${version}`,
      'changelog',
    ),
    sourceUrl: joinUrlParts(
      registryUrl,
      'package',
      `${packageName}-${version}`,
      'src',
    ),
  };
}
