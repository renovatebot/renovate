export interface NpmPackage {
  main?: string;
  private?: boolean;
  workspaces?: any;
  version?: string;
  renovate?: any;
  _from?: any;
  _args?: any;
  _id?: any;
  name?: string;
}

export type LockFileEntry = Record<
  string,
  { version: string; integrity?: boolean }
>;
