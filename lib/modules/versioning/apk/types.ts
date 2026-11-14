import type { GenericVersion } from '../types.ts';

export interface ApkVersion extends GenericVersion {
  /**
   * version is the main version part: it defines the version of origin software
   * that was packaged.
   */
  version: string;
  /**
   * releaseString is used to distinguish between different versions of packaging for the
   * same upstream version.
   */
  releaseString: string;
}
