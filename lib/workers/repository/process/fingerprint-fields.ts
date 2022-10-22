import type { UpgradeFingerprintConfig } from '../../types';

type BranchFingerprintFields = keyof UpgradeFingerprintConfig;

export const upgradeFingerprintFields: BranchFingerprintFields[] = [
  'autoReplaceStringTemplate',
  'currentDigest',
  'currentValue',
  'currentVersion',
  'datasource',
  'depName',
  'lockFile',
  'lockedVersion',
  'manager',
  'newName',
  'newDigest',
  'newValue',
  'newVersion',
  'packageFile',
  'replaceString',
];
