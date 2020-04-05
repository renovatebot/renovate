import is from '@sindresorhus/is';
import * as handlebars from 'handlebars';
import { logger } from '../../logger';

handlebars.registerHelper('encodeURIComponent', encodeURIComponent);

export const exposedConfigOptions = [
  'branchPrefix',
  'branchTopic',
  'commitMessageAction',
  'commitMessageExtra',
  'commitMessagePrefix',
  'commitMessageSuffix',
  'commitMessageTopic',
  'group',
  'groupSlug',
  'groupName',
  'managerBranchPrefix',
  'prBodyColumns',
  'prBodyDefinitions',
  'prBodyNotes',
];

export const allowedFields = {
  currentValue: 'The extracted current value of the dependency being updated',
  datasource: 'The datasource used to look up the upgrade',
  depName: 'The name of the dependency being updated',
  depNameLinked:
    'The dependency name already linked to its home page using markdown',
  depNameSanitized:
    'The depName field sanitized for use in branches after removing spaces and special characters',
  depNameShort: 'Shortened depName',
  depType: 'The dependency type (if extracted - manager-dependent)',
  displayFrom: 'The current value, formatted for display',
  displayTo: 'The to value, formatted for display',
  isLockfileUpdate: 'true if the branch is a lock file update',
  isMajor: 'true if the upgrade is major',
  isPatch: 'true if the upgrade is a patch upgrade',
  isSingleVersion:
    'true if the upgrade is to a single version rather than a range',
  lookupName: 'The full name that was used to look up the dependency.',
  newDigestShort:
    'A shorted version of the new digest, for use when the full digest is too long to be conveniently displayed',
  newMajor:
    'The major version of the new version. e.g. "3" if the new version if "3.1.0"',
  newMinor:
    'The minor version of the new version. e.g. "1" if the new version if "3.1.0"',
  newValue:
    'The new value in the upgrade. Can be a range or version e.g. "^3.0.0" or "3.1.0"',
  newVersion: 'The new version in the upgrade.',
  packageFile: 'The filename that the dependency was found in',
  platform: 'VCS platform in use, e.g. "github", "gitlab", etc.',
  references: 'A list of references for the upgrade',
  repository: 'The current repository',
  toVersion: 'The new version in the upgrade, e.g. "3.1.0"',
  updateType: 'One of digest, pin, rollback, patch, minor, major',
  upgrades: 'An array of upgrade objects in the branch',
};

function getFilteredObject(obj: any): any {
  const res = {};
  const allAllowed = [
    ...Object.keys(allowedFields),
    ...exposedConfigOptions,
  ].sort();
  for (const field of allAllowed) {
    const value = obj[field];
    if (is.array(value)) {
      res[field] = obj[field].map(element => getFilteredObject(element));
    } else if (is.object(value)) {
      res[field] = getFilteredObject(value);
    } else if (!is.undefined(value)) {
      res[field] = value;
    }
  }
  return res;
}

export function compile(
  template: string,
  input: any,
  filterFields = true
): string {
  const filteredInput = filterFields ? getFilteredObject(input) : input;
  logger.debug({ template, filteredInput }, 'Compiling template');
  const res = handlebars.compile(template)(input);
  return res;
}
