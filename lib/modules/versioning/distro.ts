import dataFiles, { DataFile } from '../../data-files.generated';

export type DistroInfoRecord = Record<string, string>;

export default class DistroInfo {
  private readonly _codenameToVersion = new Map<string, string>();
  private readonly _distroInfo: DistroInfoRecord;

  constructor(distroJsonKey: string) {
    this._distroInfo = JSON.parse(
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      dataFiles.get(distroJsonKey as DataFile)!
    );
    for (const version of Object.keys(this._distroInfo)) {
      const codename = this._distroInfo[version];
      this._codenameToVersion.set(codename, version);
    }
  }

  public isCodename(input: string): boolean {
    return this._codenameToVersion.has(input);
  }

  public getVersionByCodename(input: string): string {
    const ver = this._codenameToVersion.get(input);
    if (ver) {
      return ver;
    }
    return input;
  }

  public getCodenameByVersion(input: string): string {
    const codename = this._distroInfo[input];
    if (codename) {
      return codename;
    }
    // istanbul ignore next
    return input;
  }
}
