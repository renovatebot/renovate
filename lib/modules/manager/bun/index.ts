import type { Category } from '../../../constants/index.ts';
import { GithubTagsDatasource } from '../../datasource/github-tags/index.ts';
import { NpmDatasource } from '../../datasource/npm/index.ts';

export { getRangeStrategy, updateDependency } from '../npm/index.ts';
export { updateArtifacts } from './artifacts.ts';
export { extractAllPackageFiles } from './extract.ts';

export const url = 'https://bun.sh/docs/cli/install';
export const categories: Category[] = ['js'];

export const supersedesManagers = ['npm'];
export const supportsLockFileMaintenance = true;
export const lockFileNames = ['bun.lockb', 'bun.lock'];

export const defaultConfig = {
  managerFilePatterns: ['/(^|/)bun\\.lockb?$/', '/(^|/)package\\.json$/'],
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

export const supportedDatasources = [GithubTagsDatasource.id, NpmDatasource.id];
