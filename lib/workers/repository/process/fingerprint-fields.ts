import type { UpgradeFingerprintConfig } from '../../types';

type BranchFingerprintFields = keyof UpgradeFingerprintConfig;

export const upgradeFingerprintFields: BranchFingerprintFields[] = [
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
];
