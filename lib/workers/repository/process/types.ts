import type { Osv } from '@renovatebot/osv-offline';
import type { RenovateConfig } from '../../../config/types.ts';
import type { PackageFile } from '../../../modules/manager/types.ts';
import type { VersioningApi } from '../../../modules/versioning/index.ts';

export interface Vulnerability {
  packageFileConfig: RenovateConfig & PackageFile;
  packageName: string;
  depVersion: string;
  fixedVersion: string | null;
  datasource: string;
  vulnerability: Osv.Vulnerability;
  affected: Osv.Affected;
}

export interface DependencyVulnerabilities {
  versioningApi: VersioningApi;
  vulnerabilities: Vulnerability[];
}

export interface SeverityDetails {
  cvssVector: string;
  score: string;
  severityLevel: string;
}
