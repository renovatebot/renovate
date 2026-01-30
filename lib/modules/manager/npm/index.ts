import type { Category } from '../../../constants/index.ts';
import { GithubTagsDatasource } from '../../datasource/github-tags/index.ts';
import { NodeVersionDatasource } from '../../datasource/node-version/index.ts';
import { NpmDatasource } from '../../datasource/npm/index.ts';

export { detectGlobalConfig } from './detect.ts';
export { extractAllPackageFiles } from './extract/index.ts';
export {
  bumpPackageVersion,
  updateDependency,
  updateLockedDependency,
} from './update/index.ts';
export { getRangeStrategy } from './range.ts';
export { updateArtifacts } from './artifacts.ts';

export const supportsLockFileMaintenance = true;

export const displayName = 'npm';
export const url = 'https://docs.npmjs.com';
export const categories: Category[] = ['js'];

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
