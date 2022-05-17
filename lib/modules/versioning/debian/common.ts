import type { DistroInfo, DistroInfoRecordWithVersion } from '../distro';

export class RollingReleasesData {
  private ltsToVer = new Map<string, DistroInfoRecordWithVersion>();
  private verToLts = new Map<string, DistroInfoRecordWithVersion>();
  private distroInfo: DistroInfo;

  constructor(distroInfo: DistroInfo) {
    this.distroInfo = distroInfo;
  }

  getVersionByLts(input: string): string {
    this.refresh();
    const schedule = this.ltsToVer.get(input);
    if (schedule) {
      return schedule.version;
    }
    return input;
  }

  getLtsByVersion(input: string): string {
    this.refresh();
    const di = this.verToLts.get(input);
    if (di) {
      return di.series;
    }
    return input;
  }

  has(version: string): boolean {
    this.refresh();
    return this.ltsToVer.has(version);
  }

  schedule(version: string): DistroInfoRecordWithVersion | undefined {
    this.refresh();
    let schedule: DistroInfoRecordWithVersion | undefined = undefined;
    if (this.verToLts.has(version)) {
      schedule = this.verToLts.get(version);
    }
    if (this.ltsToVer.has(version)) {
      schedule = this.ltsToVer.get(version);
    }
    return schedule;
  }

  private refresh(): void {
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
