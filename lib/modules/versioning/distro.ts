import dataFiles, { DataFile } from '../../data-files.generated';

export type DistroInfoRecord = Record<string, string>;

export default class DistroInfo {
  private codenameToVersion: Map<string, string>;
  private readonly distroInfo: DistroInfoRecord;

  constructor(distroJsonKey: string) {
    this.codenameToVersion = new Map<string, string>();
    this.distroInfo = JSON.parse(
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      dataFiles.get(<DataFile>distroJsonKey)!
    );
    for (const version of Object.keys(this.distroInfo)) {
      const codename = this.distroInfo[version];
      this.codenameToVersion.set(codename, version);
    }
  }

  public isCodename(input: string): boolean {
    return this.codenameToVersion.has(input);
  }

  public getVersionByCodename(input: string): string {
    const ver = this.codenameToVersion.get(input);
    if (ver) {
      return ver;
    }
    return input;
  }

  public getCodenameByVersion(input: string): string {
    const codename = this.distroInfo[input];
    if (codename) {
      return codename;
    }
    // istanbul ignore next
    return input;
  }
}
