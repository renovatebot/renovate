import type { PypiRelease } from './schema.ts';

export interface PypiJSONRelease {
  requires_python?: string;
  upload_time?: string;
  yanked?: boolean;
}
export type Releases = Record<string, PypiRelease[]>;
