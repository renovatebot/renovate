import type { Category } from '../../../constants/index.ts';
import { GithubTagsDatasource } from '../../datasource/github-tags/index.ts';
import { NpmDatasource } from '../../datasource/npm/index.ts';

export { getRangeStrategy, updateDependency } from '../npm/index.ts';
export { updateArtifacts } from './artifacts.ts';
export { extractAllPackageFiles } from './extract.ts';

export const url = 'https://github.com/aubepkg/aube';
export const categories: Category[] = ['js'];

export const supersedesManagers = ['npm'];
export const supportsLockFileMaintenance = true;
export const supportsNpmrc = true;
export const lockFileNames = ['aube-lock.yaml'];
export const lockFileMaintenanceIsDelegatedToPackageManager = true;

export const defaultConfig = {
  managerFilePatterns: ['/(^|/)aube-lock\\.yaml$/', '/(^|/)package\\.json$/'],
  digest: {
    prBodyDefinitions: {
      Change:
        '{{#if displayFrom}}`{{{displayFrom}}}` → {{else}}{{#if currentValue}}`{{{currentValue}}}` → {{/if}}{{/if}}{{#if displayTo}}`{{{displayTo}}}`{{else}}`{{{newValue}}}`{{/if}}',
    },
  },
  prBodyDefinitions: {
    Change:
      "[{{#if displayFrom}}`{{{displayFrom}}}` → {{else}}{{#if currentValue}}`{{{currentValue}}}` → {{/if}}{{/if}}{{#if displayTo}}`{{{displayTo}}}`{{else}}`{{{newValue}}}`{{/if}}]({{#if packageName}}https://renovatebot.com/diffs/npm/{{replace '/' '%2f' packageName}}/{{{currentVersion}}}/{{{newVersion}}}{{/if}})",
  },
};

export const supportedDatasources = [GithubTagsDatasource.id, NpmDatasource.id];
