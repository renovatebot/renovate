import type { PackageFile } from '../../../modules/manager/types.ts';

export interface ExtractResults {
  manager: string;
  packageFiles?: PackageFile[] | null;
}
