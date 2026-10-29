/** The commit which a version embeds. */
export interface VersionCommit {
  /** The UTC commit time, as `yyyymmddhhmmss`. */
  timestamp: string;
  /** The first 12 characters of the commit hash. */
  revision: string;
}
