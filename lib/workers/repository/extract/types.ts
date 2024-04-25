import type { PackageFile } from '../../../modules/manager/types';

export interface ExtractResults {
  manager: string;
  packageFiles?: PackageFile[] | null;
}
