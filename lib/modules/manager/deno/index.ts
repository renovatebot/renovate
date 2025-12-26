import type { Category } from '../../../constants';
import { DenoDatasource } from '../../datasource/deno';
import { JsrDatasource } from '../../datasource/jsr';
import { NpmDatasource } from '../../datasource/npm';

export { updateArtifacts } from './artifacts';
export { extractAllPackageFiles } from './extract';
// The reason updateDependency is necessary is that extractPackageFile cannot retrieve the correct lock file
// See: normalizeWorkspace in lib/modules/manager/deno/post.ts
export { updateDependency } from './update';
export { getRangeStrategy } from '../npm'; // for node-compat

export const url =
  'https://docs.deno.com/runtime/getting_started/installation/';
export const categories: Category[] = ['js'];

export const supersedesManagers = ['npm'];
export const supportsLockFileMaintenance = true;
export const supportedDatasources = [
  NpmDatasource.id,
  JsrDatasource.id,
  DenoDatasource.id,
];

export const defaultConfig = {
  managerFilePatterns: [
    '/(^|/)deno\\.lock$/', // for node-compat
    '/(^|/)deno\\.(json|jsonc)$/',
  ],
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
