import is from '@sindresorhus/is';
import * as handlebars from 'handlebars';
import { logger } from '../../logger';

handlebars.registerHelper('encodeURIComponent', encodeURIComponent);

export const allowedFields = {
  datasource: 'The datasource used to look up the upgrade',
  depName: 'The name of the dependency being updated',
  depNameSanitized:
    'The depName field sanitized for use in branches after removing spaces and special characters',
  isMajor: 'true if the upgrade is major',
  isSingleVersion:
    'true if the upgrade is to a single version rather than a range',
  lookupName: 'The full name that was used to look up the dependency.',
  newDigestShort:
    'A shorted version of the new digest, for use when the full digest is too long to be conveniently displayed',
  newMajor:
    'The major version of the new version. e.g. "3" if the new version if "3.1.0"',
  newValue:
    'The new value in the upgrade. Can be a range or version e.g. "^3.0.0" or "3.1.0"',
  platform: 'VCS platform in use, e.g. "github", "gitlab", etc.',
  repository: 'The current repository',
  toVersion: 'The new version in the upgrade, e.g. "3.1.0"',
  upgrades: 'An array of upgrade objects in the branch',
};

function getFilteredObject(obj: any): any {
  const res = {};
  for (const field of Object.keys(allowedFields)) {
    const value = obj[field];
    if (is.array(value)) {
      res[field] = obj[field].map(element => getFilteredObject(element));
    } else if (is.object(value)) {
      res[field] = getFilteredObject(value);
    } else if (!is.undefined(value)) {
      res[field] = obj[field];
    }
  }
}

export function compile(
  template: string,
  input: any,
  filterFields?: boolean
): string {
  const filteredInput = filterFields ? getFilteredObject(input) : input;
  logger.trace({ template, filteredInput }, 'Compiling template');
  return handlebars.compile(template)(filteredInput);
}
