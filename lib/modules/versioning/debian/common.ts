import { DateTime } from 'luxon';
import { logger } from '../../../logger/index.ts';
import { regEx } from '../../../util/regex.ts';
import type { DistroInfo, DistroInfoRecordWithVersion } from '../distro.ts';

const refreshInterval = { days: 1 };

const datedRegex = regEx(
  /^(?<codename>\w+)-(?<date>\d{8})(?<suffix>\.\d{1,2})?$/,
);

export function isDatedCodeName(
  input: string,
  distroInfo: DistroInfo,
): boolean {
  const match = datedRegex.exec(input);
  if (!match?.groups) {
    return false;
  }
  const codename = match.groups.codename;
  return distroInfo.isCodename(codename);
}

export function getDatedContainerImageCodename(version: string): null | string {
  const groups = datedRegex.exec(version);
  if (!groups?.groups) {
    return null;
  }
  return groups.groups.codename;
}

export function getDatedContainerImageVersion(version: string): null | number {
  const groups = datedRegex.exec(version);
  if (!groups?.groups) {
    return null;
  }

  return parseInt(groups.groups.date);
}

export function getDatedContainerImageSuffix(version: string): null | string {
  const groups = datedRegex.exec(version);
  if (!groups?.groups?.suffix) {
    return null;
  }

  return groups.groups.suffix;
}

export class RollingReleasesData {
  private ltsToVer = new Map<string, DistroInfoRecordWithVersion>();
  private verToLts = new Map<string, DistroInfoRecordWithVersion>();
  private timestamp = DateTime.fromMillis(0).toUTC(); // start of epoch
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
    const now = DateTime.now().toUTC();
    if (now < this.timestamp.plus(refreshInterval)) {
      return;
    }
    logger.debug('RollingReleasesData - data written');
    this.timestamp = now;
    for (let i = 0; i < 3; i++) {
      const di = this.distroInfo.getNLatest(i);

      // should never happen, just for type checking
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
