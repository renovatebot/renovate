import type { RangeStrategy } from '../../../types';
import { DistroInfo } from '../distro';
import { GenericVersioningApi } from '../generic';
import type { GenericVersion } from '../generic';
import type { NewValueConfig, VersioningApi } from '../types';
import { RollingReleasesData } from './common';

export const id = 'debian';
export const displayName = 'Debian';
export const urls = [
  'https://debian.pages.debian.net/distro-info-data/debian.csv',
];
export const supportsRanges = true;
export const supportedRangeStrategies: RangeStrategy[] = ['pin'];

const RELEASE_PROP = 'release';

export class DebianVersioningApi extends GenericVersioningApi {
  private readonly _distroInfo: DistroInfo;
  private readonly _rollingReleases: RollingReleasesData;

  constructor() {
    super();
    this._distroInfo = new DistroInfo('data/debian-distro-info.json');
    this._rollingReleases = new RollingReleasesData(this._distroInfo);
  }

  override isValid(version: string): boolean {
    const isValid = super.isValid(version);
    const schedule = this._distroInfo.getSchedule(
      this._rollingReleases.getVersionByLts(version),
    );
    return isValid && schedule !== null && RELEASE_PROP in schedule;
  }

  override isStable(version: string): boolean {
    let ver: string;
    ver = this._rollingReleases.getVersionByLts(version);
    ver = this._distroInfo.getVersionByCodename(ver);
    return this._distroInfo.isReleased(ver) && !this._distroInfo.isEolLts(ver);
  }

  override getNewValue({
    currentValue,
    rangeStrategy,
    newVersion,
  }: NewValueConfig): string {
    if (rangeStrategy === 'pin') {
      let newVer = newVersion;

      // convert newVersion to semVer
      if (this._distroInfo.isCodename(newVersion)) {
        newVer = this._distroInfo.getVersionByCodename(newVersion);
      }
      if (this._rollingReleases.has(newVersion)) {
        newVer = this._rollingReleases.getVersionByLts(newVersion);
      }

      // current value is codename or [oldold|old|]stable
      if (
        this._distroInfo.isCodename(currentValue) ||
        this._rollingReleases.has(currentValue)
      ) {
        return newVer;
      }
    }

    // current value is [oldold|old|]stable
    if (this._rollingReleases.has(currentValue)) {
      return this._rollingReleases.getLtsByVersion(newVersion);
    }

    if (this._distroInfo.isCodename(currentValue)) {
      const di = this._rollingReleases.schedule(newVersion);
      let ver = newVersion;
      if (di) {
        ver = di.version;
      }
      return this._distroInfo.getCodenameByVersion(ver);
    }

    // newVersion is [oldold|old|]stable
    // current value is numeric
    if (this._rollingReleases.has(newVersion)) {
      return (
        this._rollingReleases.schedule(newVersion)?.version ??
        /* istanbul ignore next: should never happen */ newVersion
      );
    }

    return this._distroInfo.getVersionByCodename(newVersion);
  }

  protected override _parse(version: string): GenericVersion | null {
    let ver: string;
    ver = this._rollingReleases.getVersionByLts(version);
    ver = this._distroInfo.getVersionByCodename(ver);
    if (!this._distroInfo.exists(ver)) {
      return null;
    }
    return { release: ver.split('.').map(Number) };
  }
}

export const api: VersioningApi = new DebianVersioningApi();

export default api;
