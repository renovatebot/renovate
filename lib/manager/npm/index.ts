import { LANGUAGE_JAVASCRIPT } from '../../constants/languages';
import * as npmVersioning from '../../versioning/npm';

export { extractAllPackageFiles } from './extract';
export { updateDependency } from './update';
export { getRangeStrategy } from './range';

export const language = LANGUAGE_JAVASCRIPT;
export const supportsLockFileMaintenance = true;

export const defaultConfig = {
  fileMatch: ['(^|/)package.json$'],
  rollbackPrs: true,
  versioning: npmVersioning.id,
  prBodyDefinitions: {
    Change:
      '[{{#if displayFrom}}`{{{displayFrom}}}` -> {{else}}{{#if currentValue}}`{{{currentValue}}}` -> {{/if}}{{/if}}{{#if displayTo}}`{{{displayTo}}}`{{else}}`{{{newValue}}}`{{/if}}](https://renovatebot.com/diffs/npm/{{{depNameEscaped}}}/{{{fromVersion}}}/{{{toVersion}}})',
  },
};
