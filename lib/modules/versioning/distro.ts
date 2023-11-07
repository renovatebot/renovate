import { DateTime } from 'luxon';
import dataFiles, { DataFile } from '../../data-files.generated';

export interface DistroSchedule {
  codename: string;
  series: string;
  created: string;
  release: string;
  eol: string;
  eol_server?: string;
  eol_esm?: string;
  eol_lts?: string;
  eol_elts?: string;
}

export type DistroDataFile =
  | 'data/ubuntu-distro-info.json'
  | 'data/debian-distro-info.json';

export type DistroInfoRecord = Record<string, DistroSchedule>;

export type DistroInfoRecordWithVersion = { version: string } & DistroSchedule;

// Days to delay new releases
const delay = 1;

export class DistroInfo {
  private readonly _codenameToVersion = new Map<
    string,
    DistroInfoRecordWithVersion
  >();

  private readonly _sortedInfo: DistroInfoRecordWithVersion[] = [];

  private readonly _distroInfo: DistroInfoRecord;

  constructor(distroJsonKey: DistroDataFile) {
    this._distroInfo = JSON.parse(
      dataFiles.get(distroJsonKey as DataFile)!.replace(/v([\d.]+)\b/gm, '$1'),
    );

    for (const version of Object.keys(this._distroInfo)) {
      const schedule = this._distroInfo[version];
      this._codenameToVersion.set(schedule.series, { version, ...schedule });
    }

    const arr = Object.keys(this._distroInfo).sort(
      (a, b) => parseFloat(a) - parseFloat(b),
    );

    for (const v of arr) {
      const obj = { version: v, ...this._distroInfo[v.toString()] };
      if (!obj.release) {
        // istanbul ignore next
        continue;
      }
      this._sortedInfo.push(obj);
    }
  }

  /**
   * Check if input is a valid release codename
   * @param input A codename
   * @returns true if input is a codename, false otherwise
   */
  public isCodename(input: string): boolean {
    return this._codenameToVersion.has(input);
  }

  /**
   * Checks if given input string is a valid release version
   * @param input A codename/semVer
   * @returns true if release exists, false otherwise
   */
  public exists(input: string): boolean {
    const ver = this.getVersionByCodename(input);
    return !!this._distroInfo[ver];
  }

  /**
   * Get semVer representation of a given codename
   * @param input A codename
   * @returns A semVer if exists, otherwise input string is returned
   */
  public getVersionByCodename(input: string): string {
    const schedule = this._codenameToVersion.get(input);
    if (schedule) {
      return schedule.version;
    }
    return input;
  }

  /**
   * Get codename representation of a given semVer
   * @param input A semVer
   * @returns A codename if exists, otherwise input string is returned
   */
  public getCodenameByVersion(input: string): string {
    const di = this._distroInfo[input];
    if (di) {
      return di.series;
    }
    // istanbul ignore next
    return input;
  }

  /**
   * Get schedule of a given release
   * @param input A codename/semVer
   * @returns A schedule if available, otherwise undefined
   */
  public getSchedule(input: string): DistroSchedule | null {
    const ver = this.getVersionByCodename(input);
    return this._distroInfo[ver] ?? null;
  }

  /**
   * Check if a given release has passed its EOL
   * @param input A codename/semVer
   * @returns false if still supported, true otherwise
   */
  public isEolLts(input: string): boolean {
    const ver = this.getVersionByCodename(input);
    const schedule = this.getSchedule(ver);
    const endLts = schedule?.eol ?? null;
    let end = schedule?.eol_lts ?? null;

    // ubuntu: does not have eol_lts
    // debian: only "Stable" has no eol_lts, old and oldold has both
    if (!end) {
      end = endLts;
    }

    if (end) {
      const now = DateTime.now().toUTC();
      const eol = DateTime.fromISO(end, { zone: 'utc' });
      return eol < now;
    }

    // istanbul ignore next
    return true;
  }

  /**
   * Check if a given version has been released
   * @param input A codename/semVer
   * @returns false if unreleased or has no schedule, true otherwise
   */
  public isReleased(input: string): boolean {
    const ver = this.getVersionByCodename(input);
    const schedule = this.getSchedule(ver);

    if (!schedule) {
      return false;
    }

    const now = DateTime.now().minus({ day: delay }).toUTC();
    const release = DateTime.fromISO(schedule.release, { zone: 'utc' });

    return release < now;
  }

  /**
   * Get distro info for the release that has N other newer releases.
   * Example: n=0 corresponds to the latest available release, n=1 the release before, etc.
   * In Debian terms: N = 0 -> stable, N = 1 -> oldstable, N = 2 -> oldoldstalbe
   * @param n
   * @returns Distro info of the Nth latest release
   */
  public getNLatest(n: number): DistroInfoRecordWithVersion | null {
    const len = this._sortedInfo.length - 1;
    let idx = -1;

    if (n < 0) {
      return null;
    }

    for (let i = len; i >= 0; i--) {
      if (this.isReleased(this._sortedInfo[i].version)) {
        // 'i' holds the latest released version index
        // compensate for the requested 'n'
        idx = i - Math.floor(n);
        break;
      }
    }

    if (idx > len || idx < 0) {
      return null;
    }

    return this._sortedInfo[idx];
  }
}
