import { DateTime } from 'luxon';
import dataFiles, { DataFile } from '../../data-files.generated';

interface DistroSchedule {
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

export type DistroDataFile = 'data/ubuntu-distro-info.json';

export type DistroInfoRecord = Record<string, DistroSchedule>;

export type DistroInfoRecordWithVersion = { version: string } & DistroSchedule;

export class DistroInfo {
  private readonly _codenameToVersion = new Map<
    string,
    DistroInfoRecordWithVersion
  >();

  private readonly _sortedInfo = new Array<DistroInfoRecordWithVersion>();

  private readonly _distroInfo: DistroInfoRecord;

  constructor(distroJsonKey: DistroDataFile) {
    this._distroInfo = JSON.parse(
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      dataFiles.get(distroJsonKey as DataFile)!.replace(/v([\d.]+)\b/gm, '$1')
    );

    for (const version of Object.keys(this._distroInfo)) {
      const schedule = this._distroInfo[version];
      this._codenameToVersion.set(schedule.series, { version, ...schedule });
    }

    const arr = Object.keys(this._distroInfo).sort(
      (a, b) => parseFloat(a) - parseInt(b)
    );

    for (const v of arr) {
      const obj = { version: v, ...this._distroInfo[v.toString()] };
      if (!obj.eol) {
        // istanbul ignore next
        continue;
      }
      this._sortedInfo.push(obj);
    }
  }

  public isCodename(input: string): boolean {
    return this._codenameToVersion.has(input);
  }

  public exists(input: string): boolean {
    const ver = this.getVersionByCodename(input);
    return !!this._distroInfo[ver];
  }

  public getVersionByCodename(input: string): string {
    const schedule = this._codenameToVersion.get(input);
    if (schedule) {
      return schedule.version;
    }
    return input;
  }

  public getCodenameByVersion(input: string): string {
    const di = this._distroInfo[input];
    if (di) {
      return di.series;
    }
    // istanbul ignore next
    return input;
  }

  public getSchedule(input: string): DistroSchedule {
    return this._distroInfo[input];
  }

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
      const now = DateTime.now();
      const eol = DateTime.fromISO(end);
      return eol < now;
    }

    // istanbul ignore next
    return true;
  }

  public getNLatest(n: number): DistroInfoRecordWithVersion | null {
    const len = this._sortedInfo.length - 1;
    const i = len - n;

    if (len >= i && i >= 0) {
      return this._sortedInfo[i];
    }

    // istanbul ignore next
    return null;
  }
}
