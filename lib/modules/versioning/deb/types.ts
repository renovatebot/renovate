import type { GenericVersion } from '../types.ts';

export interface DebVersion extends GenericVersion {
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
   * debianRevision is used to distinguish between different versions of packaging for the
   * same upstream version.
   */
  debianRevision: string;
}
