import { ProgrammingLanguage } from '../../../constants';
import { GithubTagsDatasource } from '../../datasource/github-tags';
import { NpmDatasource } from '../../datasource/npm';
import * as npmVersioning from '../../versioning/npm';

export { detectGlobalConfig } from './detect';
export { extractAllPackageFiles } from './extract';
export {
  bumpPackageVersion,
  updateDependency,
  updateLockedDependency,
} from './update';
export { getRangeStrategy } from './range';

export const language = ProgrammingLanguage.JavaScript;
export const supportsLockFileMaintenance = true;

export const defaultConfig = {
  fileMatch: ['(^|/)package\\.json$'],
  rollbackPrs: true,
  versioning: npmVersioning.id,
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
