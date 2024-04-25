import type {
  RenovateConfig,
  ValidationMessage,
} from '../../../../config/types';
import type {
  LookupUpdate,
  RangeConfig,
} from '../../../../modules/manager/types';
import type { SkipReason } from '../../../../types';
import type { MergeConfidence } from '../../../../util/merge-confidence/types';

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
  separateMultipleMinor?: boolean;
  datasource: string;
  packageName: string;
  minimumConfidence?: MergeConfidence | undefined;
  replacementName?: string;
  replacementNameTemplate?: string;
  replacementVersion?: string;
  extractVersion?: string;
}

export interface UpdateResult {
  sourceDirectory?: string;
  changelogUrl?: string;
  dependencyUrl?: string;
  homepage?: string;
  deprecationMessage?: string;
  sourceUrl?: string | null;
  currentVersion?: string;
  isSingleVersion?: boolean;
  lookupName?: string;
  skipReason?: SkipReason;
  registryUrl?: string;
  fixedVersion?: string;
  updates: LookupUpdate[];
  warnings: ValidationMessage[];
  versioning?: string;
  currentVersionTimestamp?: string;
}
