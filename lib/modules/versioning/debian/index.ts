import type { RangeStrategy } from '../../../types';
import { DistroInfo, DistroInfoRecordWithVersion } from '../distro';
import { GenericVersioningApi } from '../generic';
import type { GenericVersion } from '../generic';
import type { NewValueConfig, VersioningApi } from '../types';

export const id = 'debian';
export const displayName = 'Debian';
export const urls = [
  'https://debian.pages.debian.net/distro-info-data/debian.csv',
];
export const supportsRanges = true;
export const supportedRangeStrategies: RangeStrategy[] = ['pin'];

const RELEASE_PROP = 'release';

export class DebianVersioningApi extends GenericVersioningApi {
  private _distroInfo: DistroInfo;
  private readonly _ltsToVer = new Map<string, DistroInfoRecordWithVersion>();
  private readonly _verToLts = new Map<string, DistroInfoRecordWithVersion>();

  constructor() {
    super();
    this._distroInfo = new DistroInfo('data/debian-distro-info.json');

    this._buildLtsMaps('stable', 0);
    this._buildLtsMaps('oldstable', 1);
    this._buildLtsMaps('oldoldstable', 2);
  }

  private _buildLtsMaps(release: string, n: number): void {
    const di = this._distroInfo.getNLatest(n);
    // istanbul ignore if: should never happen
    if (!di) {
      return;
    }
    di.series = release;
    this._ltsToVer.set(release, di);
    this._verToLts.set(di.version, di);
  }

  private _getVersionByLts(input: string): string {
    const schedule = this._ltsToVer.get(input);
    if (schedule) {
      return schedule.version;
    }
    return input;
  }

  private _getLtsByVersion(input: string): string {
    const di = this._verToLts.get(input);
    if (di) {
      return di.series;
    }
    return input;
  }

  protected override _parse(version: string): GenericVersion | null {
    let ver: string;
    ver = this._getVersionByLts(version);
    ver = this._distroInfo.getVersionByCodename(ver);
    if (!this._distroInfo.exists(ver)) {
      return null;
    }
    return { release: ver.split('.').map(Number) };
  }

  override isValid(version: string): boolean {
    const isValid = super.isValid(version);
    const schedule = this._distroInfo.getSchedule(
      this._getVersionByLts(version)
    );
    return (isValid && schedule && RELEASE_PROP in schedule) ?? false;
  }

  override isStable(version: string): boolean {
    let ver: string;
    ver = this._getVersionByLts(version);
    ver = this._distroInfo.getVersionByCodename(ver);
    return this._distroInfo.isReleased(ver) && !this._distroInfo.isEolLts(ver);
  }

  override getNewValue({
    currentValue,
    rangeStrategy,
    currentVersion,
    newVersion,
  }: NewValueConfig): string {
    if (rangeStrategy === 'pin') {
      let newVer = newVersion;

      // convert newVersion to semVer
      if (this._distroInfo.isCodename(newVersion)) {
        newVer = this._distroInfo.getVersionByCodename(newVersion);
      }
      if (this._ltsToVer.has(newVersion)) {
        newVer = this._getVersionByLts(newVersion);
      }

      // current value is codename or [oldold|old|]stable
      if (
        this._distroInfo.isCodename(currentValue) ||
        this._ltsToVer.has(currentValue)
      ) {
        return newVer;
      }
    }

    // current value is [oldold|old|]stable
    if (this._ltsToVer.has(currentValue)) {
      return this._getLtsByVersion(newVersion);
    }

    if (this._distroInfo.isCodename(currentValue)) {
      const di = this._ltsToVer.get(newVersion);
      let ver = newVersion;
      if (di) {
        ver = di.version;
      }
      return this._distroInfo.getCodenameByVersion(ver);
    }

    // newVersion is [oldold|old|]stable
    // current value is numeric
    if (this._ltsToVer.has(newVersion)) {
      return this._ltsToVer.get(newVersion)?.version ?? newVersion;
    }

    return this._distroInfo.getVersionByCodename(newVersion);
  }
}

export const api: VersioningApi = new DebianVersioningApi();

export default api;
