import type { UpgradeFingerprintConfig } from '../../types';

type BranchFingerprintFields = keyof UpgradeFingerprintConfig;

export const upgradeFingerprintFields: BranchFingerprintFields[] = [
  'manager',
  'packageFile',
  'lockFile',
  'fixedVersion',
  'currentVersion',
  'lockedVersion',
  'newVersion',
  'newDigest',
  'newName',
  'replaceString',
];
