import type { RangeStrategy } from '../../../types/index.ts';
import { DistroInfo } from '../distro.ts';
import type { GenericVersion } from '../generic.ts';
import { GenericVersioningApi } from '../generic.ts';
import type { NewValueConfig, VersioningApi } from '../types.ts';
import {
  RollingReleasesData,
  getDatedContainerImageCodename,
  getDatedContainerImageSuffix,
  getDatedContainerImageVersion,
  isDatedCodeName,
} from './common.ts';

export const id = 'debian';
export const displayName = 'Debian';
export const urls = [
  'https://debian.pages.debian.net/distro-info-data/debian.csv',
];
export const supportsRanges = true;
export const supportedRangeStrategies: RangeStrategy[] = ['replace'];

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
    let ver: string;
    ver = this._rollingReleases.getVersionByLts(version);
    ver = this._distroInfo.getVersionByCodename(ver);
    return (
      (isValid && this._distroInfo.isCreated(ver)) ||
      isDatedCodeName(version, this._distroInfo)
    );
  }

  override isStable(version: string): boolean {
    if (isDatedCodeName(version, this._distroInfo)) {
      const codename = getDatedContainerImageCodename(version)!;
      const versionByCodename = this._distroInfo.getVersionByCodename(codename);
      return (
        this._distroInfo.isReleased(versionByCodename) &&
        !this._distroInfo.isEolLts(versionByCodename)
      );
    }
    let ver: string;
    ver = this._rollingReleases.getVersionByLts(version);
    ver = this._distroInfo.getVersionByCodename(ver);
    return this._distroInfo.isReleased(ver) && !this._distroInfo.isEolLts(ver);
  }

  override getNewValue({ currentValue, newVersion }: NewValueConfig): string {
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
      // should never `undefined` if it exists
      return this._rollingReleases.schedule(newVersion)!.version;
    }

    return this._distroInfo.getVersionByCodename(newVersion);
  }

  private _getBaseVersion(version: string): string {
    if (isDatedCodeName(version, this._distroInfo)) {
      const codename = getDatedContainerImageCodename(version)!;
      return this._distroInfo.getVersionByCodename(codename);
    }
    return version;
  }

  override equals(version: string, other: string): boolean {
    const verImage = getDatedContainerImageVersion(version);
    const otherImageVer = getDatedContainerImageVersion(other);
    if (verImage !== otherImageVer) {
      return false;
    }

    const verSuffix = getDatedContainerImageSuffix(version);
    const otherSuffix = getDatedContainerImageSuffix(other);
    if (verSuffix !== otherSuffix) {
      return false;
    }

    const ver = this._getBaseVersion(version);
    const otherVer = this._getBaseVersion(other);
    return super.equals(ver, otherVer);
  }

  override isGreaterThan(version: string, other: string): boolean {
    if (
      !isDatedCodeName(version, this._distroInfo) &&
      !isDatedCodeName(other, this._distroInfo)
    ) {
      return super.isGreaterThan(version, other);
    }
    const xMajor = this.getMajor(version) ?? 0;
    const yMajor = this.getMajor(other) ?? 0;
    if (xMajor > yMajor) {
      return true;
    }
    if (xMajor < yMajor) {
      return false;
    }

    const xMinor = this.getMinor(version) ?? 0;
    const yMinor = this.getMinor(other) ?? 0;
    if (xMinor > yMinor) {
      return true;
    }
    if (xMinor < yMinor) {
      return false;
    }

    const xImageVersion = getDatedContainerImageVersion(version) ?? 0;
    const yImageVersion = getDatedContainerImageVersion(other) ?? 0;
    if (xImageVersion > yImageVersion) {
      return true;
    }
    if (xImageVersion < yImageVersion) {
      return false;
    }

    const xSuffixVersion = getDatedContainerImageSuffix(version) ?? 0;
    const ySuffixVersion = getDatedContainerImageSuffix(other) ?? 0;
    if (xSuffixVersion > ySuffixVersion) {
      return true;
    }
    if (xSuffixVersion < ySuffixVersion) {
      return false;
    }

    const xPatch = this.getPatch(version) ?? 0;
    const yPatch = this.getPatch(other) ?? 0;
    return xPatch > yPatch;
  }

  override getMajor(version: string): number | null {
    const ver = this._getBaseVersion(version);
    if (this.isValid(ver)) {
      const parsed = this._parse(ver);
      return parsed!.release[0];
    }
    return null;
  }

  override getMinor(version: string): number | null {
    const ver = this._getBaseVersion(version);
    if (this.isValid(ver)) {
      const parsed = this._parse(ver);
      return parsed?.release[1] ?? null;
    }
    return null;
  }

  override getPatch(version: string): number | null {
    const ver = this._getBaseVersion(version);
    if (this.isValid(ver)) {
      const parsed = this._parse(ver);
      return parsed?.release[2] ?? null;
    }
    return null;
  }

  protected override _parse(version: string): GenericVersion | null {
    let ver: string;
    if (isDatedCodeName(version, this._distroInfo)) {
      const codename = getDatedContainerImageCodename(version)!;
      ver = this._distroInfo.getVersionByCodename(codename);
    } else {
      ver = this._rollingReleases.getVersionByLts(version);
      ver = this._distroInfo.getVersionByCodename(ver);
    }
    if (!this._distroInfo.exists(ver)) {
      return null;
    }
    return { release: ver.split('.').map(Number) };
  }
}

export const api: VersioningApi = new DebianVersioningApi();

export default api;
