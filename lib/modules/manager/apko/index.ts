import type { Category } from '../../../constants';
import { ApkDatasource } from '../../datasource/apk';

export { extractPackageFile } from './extract';
export { updateArtifacts } from './artifacts';
export { updateDependency } from './update';
export { getRangeStrategy } from './range';

export const supportsLockFileMaintenance = true;

export const categories: Category[] = ['alpine'];
export const defaultConfig = {
  managerFilePatterns: ['/(^|/)apko\\.ya?ml$/'],
  lockFiles: ['apko.lock.json'],
  commitMessageTopic: '{{{depName}}} alpine package',
  // Use newValue for version display (without revision if not present in current version)
  commitMessageExtra: 'to v{{{newValue}}}',
  commitMessage:
    '{{{commitMessagePrefix}}} {{{commitMessageAction}}} {{{commitMessageTopic}}}{{#if newValue}} to v{{{newValue}}}{{/if}}',
  prTitle: null, // Use commitMessage for PR title
  prBodyDefinitions: {
    Change: '`{{{currentValue}}}` -> `{{{newValue}}}`',
  },
};

export const supportedDatasources = [ApkDatasource.id];
