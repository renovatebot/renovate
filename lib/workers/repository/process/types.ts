import type { Osv } from '@renovatebot/osv-offline';
import type { RenovateConfig } from '../../../config/types';
import type { PackageFile } from '../../../modules/manager/types';

export interface Vulnerability {
  packageFileConfig: RenovateConfig & PackageFile;
  packageName: string;
  depVersion: string;
  fixedVersion: string | null;
  datasource: string;
  vulnerability: Osv.Vulnerability;
  affected: Osv.Affected;
}
