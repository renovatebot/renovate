export interface DenoManagerData extends Record<string, any> {
  packageName?: string;
  workspaces?: string[];
}

export interface LockFile {
  lockedVersions?: Record<string, string>;
  lockfileVersion?: number;
  redirectVersions?: Record<string, string>;
  remoteVersions?: Set<string>;
}
