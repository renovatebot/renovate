import type { GenericVersion } from '../types.ts';

export interface RegExpVersion extends GenericVersion {
  /**
   * compatibility, if present, are treated as a compatibility layer: we will
   * never try to update to a version with a different compatibility.
   */
  compatibility: string;
}
