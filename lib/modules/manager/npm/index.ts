import type { Category } from '../../../constants';
import { GithubTagsDatasource } from '../../datasource/github-tags';
import { NodeVersionDatasource } from '../../datasource/node-version';
import { NpmDatasource } from '../../datasource/npm';

export { detectGlobalConfig } from './detect';
export { extractAllPackageFiles } from './extract';
export {
  bumpPackageVersion,
  updateDependency,
  updateLockedDependency,
} from './update';
export { getRangeStrategy } from './range';
export { updateArtifacts } from './artifacts';

export const supportsLockFileMaintenance = true;

export const displayName = 'npm';
export const url = 'https://docs.npmjs.com';
export const categories: Category[] = ['js'];

export const defaultConfig = {
  fileMatch: ['(^|/)package\\.json$'],
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

export const supportedDatasources = [
  GithubTagsDatasource.id,
  NpmDatasource.id,
  NodeVersionDatasource.id,
];
