import { RenovateConfig, ValidationMessage } from '../../../../config/common';
import { Release } from '../../../../datasource/common';
import { LookupUpdate, RangeConfig } from '../../../../manager/common';
import { SkipReason } from '../../../../types';

export interface FilterConfig {
  allowedVersions?: string;
  depName?: string;
  followTag?: string;
  ignoreDeprecated?: boolean;
  ignoreUnstable?: boolean;
  respectLatest?: boolean;
  versioning: string;
}

export interface RollbackConfig {
  currentValue?: string;
  depName?: string;
  packageFile?: string;
  versioning: string;
}

export interface UpdateResult {
  sourceDirectory?: string;
  dockerRepository?: string;
  dockerRegistry?: string;
  changelogUrl?: string;
  dependencyUrl?: string;
  homepage?: string;
  deprecationMessage?: string;
  sourceUrl?: string;
  skipReason: SkipReason;
  releases: Release[];
  fixedVersion?: string;
  updates: LookupUpdate[];
  warnings: ValidationMessage[];
}

export interface LookupUpdateConfig
  extends RollbackConfig,
    FilterConfig,
    RangeConfig,
    RenovateConfig {
  separateMinorPatch?: boolean;
  digestOneAndOnly?: boolean;
  pinDigests?: boolean;
  rollbackPrs?: boolean;
  currentDigest?: string;
  lockedVersion?: string;
  vulnerabilityAlert?: boolean;
  separateMajorMinor?: boolean;
  separateMultipleMajor?: boolean;
  datasource: string;
  depName: string;
}
