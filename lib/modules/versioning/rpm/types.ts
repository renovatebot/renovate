import type { GenericVersion } from '../types.ts';

export interface RpmVersion extends GenericVersion {
  /**
   * epoch, defaults to 0 if not present, are used to leave version mistakes and previous
   * versioning schemes behind.
   */
  epoch: number;
  /**
   * upstreamVersion is the main version part: it defines the version of origin software
   * that was packaged.
   */
  upstreamVersion: string;
  /**
   * rpmRelease is used to distinguish between different versions of packaging for the
   * same upstream version.
   */
  rpmRelease: string;

  /**
   * rpmPreRelease is used to distinguish versions of prerelease of the same upstream and release version
   * Example: Python 3.12.0-1 > Python 3.12.0-1~a1
   */
  rpmPreRelease: string;

  /**
   * snapshot is an archive taken from upstream's source code control system which is not equivalent to any release version.
   * This field must at minimum consist of the date in eight-digit "YYYYMMDD" format. The packager MAY
   * include up to 17 characters of additional information after the date. The following formats are suggested:
   * YYYYMMDD.<revision>
   * YYYYMMDD<scm><revision>
   */
  snapshot: string;
}
