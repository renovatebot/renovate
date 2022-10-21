import type { UpdateType } from '../../../config/types';

export interface UpgradeFingerprintConfig {
  manager: string;
  packageFile?: string;
  lockFile?: string;
  currentDigestShort?: string;
  datasource?: string;
  digestOneAndOnly?: boolean;
  fixedVersion?: string;
  currentVersion?: string;
  lockedVersion?: string | null;
  newVersion?: string;
  newDigest?: string;
  newName?: string;
  updateType?: UpdateType;
  replaceString?: string;
  extractVersion?: string;
}

type K = keyof UpgradeFingerprintConfig;

export const upgradeFingerprintFields: K[] = [
  'manager',
  'packageFile',
  'lockFile',
  'currentDigestShort',
  'datasource',
  'digestOneAndOnly',
  'fixedVersion',
  'currentVersion',
  'lockedVersion',
  'newVersion',
  'newDigest',
  'newName',
  'updateType',
  'replaceString',
  'extractVersion',
];
