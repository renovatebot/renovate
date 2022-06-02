import type {
  RenovateConfig,
  ValidationMessage,
} from '../../../../config/types';
import type { Release } from '../../../../modules/datasource/types';
import type {
  LookupUpdate,
  RangeConfig,
} from '../../../../modules/manager/types';
import type { SkipReason } from '../../../../types';

export interface FilterConfig {
  allowedVersions?: string;
  depName?: string;
  followTag?: string;
  ignoreDeprecated?: boolean;
  ignoreUnstable?: boolean;
  respectLatest?: boolean;
  updatePinnedDependencies?: boolean;
  versioning: string;
}

export interface RollbackConfig {
  currentValue?: string;
  depName?: string;
  packageFile?: string;
  versioning: string;
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
  isVulnerabilityAlert?: boolean;
  separateMajorMinor?: boolean;
  separateMultipleMajor?: boolean;
  datasource: string;
  depName: string;
  minimumConfidence?: string;
}

export interface UpdateResult {
  sourceDirectory?: string;
  changelogUrl?: string;
  dependencyUrl?: string;
  homepage?: string;
  deprecationMessage?: string;
  sourceUrl?: string;
  currentVersion?: string;
  isSingleVersion?: boolean;
  skipReason: SkipReason;
  releases: Release[];
  fixedVersion?: string;
  updates: LookupUpdate[];
  warnings: ValidationMessage[];
  versioning?: string;
}
