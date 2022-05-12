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

class RollingReleasesData {
  private ltsToVer = new Map<string, DistroInfoRecordWithVersion>();
  private verToLts = new Map<string, DistroInfoRecordWithVersion>();
  private distroInfo: DistroInfo;

  constructor(distroInfo: DistroInfo) {
    this.distroInfo = distroInfo;
  }

  getVersionByLts(input: string): string {
    this.build();
    const schedule = this.ltsToVer.get(input);
    if (schedule) {
      return schedule.version;
    }
    return input;
  }

  getLtsByVersion(input: string): string {
    this.build();
    const di = this.verToLts.get(input);
    if (di) {
      return di.series;
    }
    return input;
  }

  has(version: string): boolean {
    this.build();
    return this.ltsToVer.has(version);
  }

  schedule(version: string): DistroInfoRecordWithVersion | undefined {
    this.build();
    let schedule: DistroInfoRecordWithVersion | undefined = undefined;
    if (this.verToLts.has(version)) {
      schedule = this.verToLts.get(version);
    }
    if (this.ltsToVer.has(version)) {
      schedule = this.ltsToVer.get(version);
    }
    return schedule;
  }

  private build(): void {
    if (this.ltsToVer.size !== 0 || this.verToLts.size !== 0) {
      return;
    }
    for (let i = 0; i < 3; i++) {
      const di = this.distroInfo.getNLatest(i);
      // istanbul ignore if: should never happen
      if (!di) {
        return;
      }

      let prefix = '';
      for (let j = 0; j < i; j++) {
        prefix += 'old';
      }
      di.series = prefix + 'stable';

      this.ltsToVer.set(di.series, di);
      this.verToLts.set(di.version, di);
    }
  }
}

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
      this._rollingReleases.getVersionByLts(version)
    );
    return (isValid && schedule && RELEASE_PROP in schedule) ?? false;
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
    currentVersion,
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
      return this._rollingReleases.schedule(newVersion)?.version ?? newVersion;
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
