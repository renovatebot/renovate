import { LANGUAGE_JAVASCRIPT } from '../../constants/languages';
import { VERSION_SCHEME_NPM } from '../../constants/version-schemes';

export { extractAllPackageFiles } from './extract';
export { updateDependency } from './update';
export { getRangeStrategy } from './range';

export const language = LANGUAGE_JAVASCRIPT;
export const supportsLockFileMaintenance = true;

export const defaultConfig = {
  fileMatch: ['(^|/)package.json$'],
  rollbackPrs: true,
  versionScheme: VERSION_SCHEME_NPM,
  prBodyDefinitions: {
    Change:
      '[{{#if displayFrom}}`{{{displayFrom}}}` -> {{else}}{{#if currentValue}}`{{{currentValue}}}` -> {{/if}}{{/if}}{{#if displayTo}}`{{{displayTo}}}`{{else}}`{{{newValue}}}`{{/if}}](https://renovatebot.com/diffs/npm/{{{depNameEscaped}}}/{{{fromVersion}}}/{{{toVersion}}})',
  },
};
