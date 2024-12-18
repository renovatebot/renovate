import type { Category } from '../../../constants';
import { GithubTagsDatasource } from '../../datasource/github-tags';
import { NpmDatasource } from '../../datasource/npm';

export { updateArtifacts } from './artifacts';
export { extractAllPackageFiles } from './extract';
export { getRangeStrategy, updateDependency } from '../npm';

export const url = 'https://bun.sh/docs/cli/install';
export const categories: Category[] = ['js'];

export const supersedesManagers = ['npm'];
export const supportsLockFileMaintenance = true;

export const defaultConfig = {
  fileMatch: ['(^|/)bun\\.lockb?$'],
  digest: {
    prBodyDefinitions: {
      Change:
        '{{#if displayFrom}}`{{{displayFrom}}}` -> {{else}}{{#if currentValue}}`{{{currentValue}}}` -> {{/if}}{{/if}}{{#if displayTo}}`{{{displayTo}}}`{{else}}`{{{newValue}}}`{{/if}}',
    },
  },
  prBodyDefinitions: {
    Change:
      "[{{#if displayFrom}}`{{{displayFrom}}}` -> {{else}}{{#if currentValue}}`{{{currentValue}}}` -> {{/if}}{{/if}}{{#if displayTo}}`{{{displayTo}}}`{{else}}`{{{newValue}}}`{{/if}}]({{#if depName}}https://renovatebot.com/diffs/npm/{{replace '/' '%2f' depName}}/{{{currentVersion}}}/{{{newVersion}}}{{/if}})",
  },
};

export const supportedDatasources = [GithubTagsDatasource.id, NpmDatasource.id];
