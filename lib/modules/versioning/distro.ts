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

type DistroDataFile = 'data/ubuntu-distro-info.json';

export type DistroInfoRecord = Record<string, DistroSchedule>;

export type DistroInfoRecordWithVersion = { version: string } & DistroSchedule;

export class DistroInfo {
  private readonly _codenameToVersion = new Map<
    string,
    DistroInfoRecordWithVersion
  >();
  private readonly _distroInfo: DistroInfoRecord;

  constructor(distroJsonKey: DistroDataFile) {
    this._distroInfo = JSON.parse(
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      dataFiles.get(distroJsonKey as DataFile)!
    );
    for (const version of Object.keys(this._distroInfo)) {
      const schedule = this._distroInfo[version];
      this._codenameToVersion.set(schedule.series, { version, ...schedule });
    }
  }

  public isCodename(input: string): boolean {
    return this._codenameToVersion.has(input);
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
}
