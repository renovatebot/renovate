import type { UpgradeFingerprintConfig } from '../../types';

type CommitFingerprintFields = keyof UpgradeFingerprintConfig;

export const upgradeFingerprintFields: CommitFingerprintFields[] = [
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
