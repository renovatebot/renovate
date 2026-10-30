import type { Category } from '../../../constants/index.ts';
import { GithubTagsDatasource } from '../../datasource/github-tags/index.ts';
import { NodeVersionDatasource } from '../../datasource/node-version/index.ts';
import { NpmDatasource } from '../../datasource/npm/index.ts';
import type { MinimumReleaseAgeSupport } from '../types.ts';
import {
  minReleaseAgeNpmRange,
  minimumReleaseAgeEnforcedPnpmRange,
  minimumReleaseAgePnpmRange,
} from './minimum-release-age.ts';

export { updateArtifacts } from './artifacts.ts';
export { detectGlobalConfig } from './detect.ts';
export { extractAllPackageFiles } from './extract/index.ts';
export { enforcesMinimumReleaseAge } from './minimum-release-age.ts';
export { getRangeStrategy } from './range.ts';
export {
  bumpPackageVersion,
  updateDependency,
  updateLockedDependency,
} from './update/index.ts';

export const supportsLockFileMaintenance = true;
export const supportsNpmrc = true;
export const lockFileNames = [
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
];
export const lockFileMaintenanceIsDelegatedToPackageManager =
  'Delegated to the underlying package manager CLI - `npm`, `pnpm`, or Yarn - depending on which lock file is present.';

export const displayName = 'npm';
export const url = 'https://docs.npmjs.com';
export const categories: Category[] = ['js'];

export const minimumReleaseAgeSupport: MinimumReleaseAgeSupport = {
  npm: {
    passesMinimumReleaseAge: true,
    readsConfiguredAge: minReleaseAgeNpmRange,
    enforcedInLockFile: true,
    note: 'Passes `--before`, unless the `.npmrc` has `min-release-age`. Reads `before` and `min-release-age` from the repository `.npmrc`; `before` works with every npm version. If only the `.npmrc` sets `min-release-age`, npm enforces it from v11.10.0.',
  },
  pnpm: {
    passesMinimumReleaseAge: minimumReleaseAgePnpmRange,
    readsConfiguredAge: minimumReleaseAgePnpmRange,
    enforcedInLockFile: minimumReleaseAgeEnforcedPnpmRange,
    note: 'Passes `--config.minimum-release-age` with the larger of `minimumReleaseAge` and the pnpm value. Reads `minimumReleaseAge` from the `pnpm-workspace.yaml`, and before pnpm v11 `minimum-release-age` from the `.npmrc`. From pnpm v11, the pnpm default of 1 day counts. pnpm v10.16.0 and v11.0.0 to v11.0.3 do not enforce it in every case.',
  },
  yarn: {},
};

export const defaultConfig = {
  managerFilePatterns: [
    '/(^|/)package\\.json$/',
    '/(^|/)pnpm-workspace\\.yaml$/',
    '/(^|/)\\.yarnrc\\.yml$/',
  ],
  digest: {
    prBodyDefinitions: {
      Change:
        '{{#if displayFrom}}`{{{displayFrom}}}` → {{else}}{{#if currentValue}}`{{{currentValue}}}` → {{/if}}{{/if}}{{#if displayTo}}`{{{displayTo}}}`{{else}}`{{{newValue}}}`{{/if}}',
    },
  },
  prBodyDefinitions: {
    Change:
      "[{{#if displayFrom}}`{{{displayFrom}}}` → {{else}}{{#if currentValue}}`{{{currentValue}}}` → {{/if}}{{/if}}{{#if displayTo}}`{{{displayTo}}}`{{else}}`{{{newValue}}}`{{/if}}]({{#if depName}}https://renovatebot.com/diffs/npm/{{replace '/' '%2f' depName}}/{{{currentVersion}}}/{{{newVersion}}}{{/if}})",
  },
};

export const supportedDatasources = [
  GithubTagsDatasource.id,
  NpmDatasource.id,
  NodeVersionDatasource.id,
];

export { knownDepTypes, supportsDynamicDepTypesNote } from './dep-types.ts';
