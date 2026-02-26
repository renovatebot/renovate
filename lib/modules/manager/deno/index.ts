import type { Category } from '../../../constants/index.ts';
import { DenoDatasource } from '../../datasource/deno/index.ts';
import { JsrDatasource } from '../../datasource/jsr/index.ts';
import { NpmDatasource } from '../../datasource/npm/index.ts';

export { getRangeStrategy } from '../npm/index.ts'; // for node-compat
export { updateArtifacts } from './artifacts.ts';
export { extractAllPackageFiles } from './extract.ts';
// The reason updateDependency is necessary is that extractPackageFile cannot retrieve the correct lock file
// See: normalizeWorkspace in lib/modules/manager/deno/post.ts
export { updateDependency } from './update.ts';

export const url =
  'https://docs.deno.com/runtime/getting_started/installation/';
export const categories: Category[] = ['js'];

export const supersedesManagers = ['npm'];
export const supportsLockFileMaintenance = true;
export const lockFileNames = ['deno.lock'];
export const supportedDatasources = [
  NpmDatasource.id,
  JsrDatasource.id,
  DenoDatasource.id,
];

export const defaultConfig = {
  managerFilePatterns: ['/(^|/)deno\\.lock$/', '/(^|/)deno\\.(json|jsonc)$/'],
  digest: {
    prBodyDefinitions: {
      Change:
        '{{#if displayFrom}}`{{{displayFrom}}}` -> {{else}}{{#if currentValue}}`{{{currentValue}}}` -> {{/if}}{{/if}}{{#if displayTo}}`{{{displayTo}}}`{{else}}`{{{newValue}}}`{{/if}}',
    },
  },
  prBodyDefinitions: {
    // append diff link if its npm datasource
    Change:
      "{{#if (equals datasource \"npm\")}}[{{#if displayFrom}}`{{{displayFrom}}}` -> {{else}}{{#if currentValue}}`{{{currentValue}}}` -> {{/if}}{{/if}}{{#if displayTo}}`{{{displayTo}}}`{{else}}`{{{newValue}}}`{{/if}}]({{#if depName}}https://renovatebot.com/diffs/npm/{{replace '/' '%2f' depName}}/{{{currentVersion}}}/{{{newVersion}}}{{/if}}){{else}}{{#if displayFrom}}`{{{displayFrom}}}` -> {{else}}{{#if currentValue}}`{{{currentValue}}}` -> {{/if}}{{/if}}{{#if displayTo}}`{{{displayTo}}}`{{else}}`{{{newValue}}}`{{/if}}{{/if}}",
  },
};
