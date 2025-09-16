export interface DenoManagerData extends Record<string, any> {
  packageName?: string;
  workspaces?: string[];
  /**
   * The file that refers to this import map, typically deno.json or deno.jsonc
   */
  importMapReferrer?: string;
}

export interface LockFile {
  lockedVersions?: Record<string, string>;
  lockfileVersion?: number;
  redirectVersions?: Record<string, string>;
  remoteVersions?: Set<string>;
}
