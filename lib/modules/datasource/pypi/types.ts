import type { PypiRelease } from './schema.ts';

export type Releases = Record<string, PypiRelease[]>;

export interface PypiIndexCredentials {
  username?: string;
  password?: string;
}
