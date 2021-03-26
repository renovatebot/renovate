import is from '@sindresorhus/is';
import * as handlebars from 'handlebars';
import { getAdminConfig } from '../../config/admin';
import { logger } from '../../logger';
import { clone } from '../clone';

handlebars.registerHelper('encodeURIComponent', encodeURIComponent);

// istanbul ignore next
handlebars.registerHelper('replace', (find, replace, context) =>
  context.replace(new RegExp(find, 'g'), replace)
);

export const exposedConfigOptions = [
  'additionalBranchPrefix',
  'addLabels',
  'branchName',
  'branchPrefix',
  'branchTopic',
  'commitMessage',
  'commitMessageAction',
  'commitMessageExtra',
  'commitMessagePrefix',
  'commitMessageSuffix',
  'commitMessageTopic',
  'gitAuthor',
  'group',
  'groupName',
  'groupSlug',
  'labels',
  'prBodyColumns',
  'prBodyDefinitions',
  'prBodyNotes',
  'prTitle',
  'semanticCommitScope',
  'semanticCommitType',
];

export const allowedFields = {
  baseBranch: 'The baseBranch for this branch/PR',
  body: 'The body of the release notes',
  currentValue: 'The extracted current value of the dependency being updated',
  currentVersion:
    'The version that would be currently installed. For example, if currentValue is ^3.0.0 then currentVersion might be 3.1.0.',
  datasource: 'The datasource used to look up the upgrade',
  depName: 'The name of the dependency being updated',
  depNameLinked:
    'The dependency name already linked to its home page using markdown',
  depNameSanitized:
    'The depName field sanitized for use in branches after removing spaces and special characters',
  depType: 'The dependency type (if extracted - manager-dependent)',
  displayFrom: 'The current value, formatted for display',
  displayTo: 'The to value, formatted for display',
  hasReleaseNotes: 'true if the upgrade has release notes',
  isLockfileUpdate: 'true if the branch is a lock file update',
  isMajor: 'true if the upgrade is major',
  isPatch: 'true if the upgrade is a patch upgrade',
  isPin: 'true if the upgrade is pinning dependencies',
  isRollback: 'true if the upgrade is a rollback PR',
  isRange: 'true if the new value is a range',
  isSingleVersion:
    'true if the upgrade is to a single version rather than a range',
  logJSON: 'ChangeLogResult object for the upgrade',
  lookupName: 'The full name that was used to look up the dependency.',
  newDigest: 'The new digest value',
  newDigestShort:
    'A shorted version of newDigest, for use when the full digest is too long to be conveniently displayed',
  newMajor:
    'The major version of the new version. e.g. "3" if the new version if "3.1.0"',
  newMinor:
    'The minor version of the new version. e.g. "1" if the new version if "3.1.0"',
  newValue:
    'The new value in the upgrade. Can be a range or version e.g. "^3.0.0" or "3.1.0"',
  newVersion: 'The new version in the upgrade, e.g. "3.1.0"',
  packageFile: 'The filename that the dependency was found in',
  packageFileDir:
    'The directory with full path where the packageFile was found',
  parentDir:
    'The name of the directory that the dependency was found in, without full path',
  platform: 'VCS platform in use, e.g. "github", "gitlab", etc.',
  prettyDepType: 'Massaged depType',
  project: 'ChangeLogProject object',
  recreateClosed: 'If true, this PR will be recreated if closed',
  references: 'A list of references for the upgrade',
  releases: 'An array of releases for an upgrade',
  releaseNotes: 'A ChangeLogNotes object for the release',
  repository: 'The current repository',
  semanticPrefix: 'The fully generated semantic prefix for commit messages',
  sourceUrl: 'The source URL for the package',
  updateType: 'One of digest, pin, rollback, patch, minor, major',
  upgrades: 'An array of upgrade objects in the branch',
  url: 'The url of the release notes',
  version: 'The version number of the changelog',
  versioning: 'The versioning scheme in use',
  versions: 'An array of ChangeLogRelease objects in the upgrade',
};

const prBodyFields = [
  'header',
  'table',
  'notes',
  'changelogs',
  'configDescription',
  'controls',
  'footer',
];

const handlebarsUtilityFields = ['else'];

const allowedFieldsList = Object.keys(allowedFields)
  .concat(exposedConfigOptions)
  .concat(prBodyFields)
  .concat(handlebarsUtilityFields);

type CompileInput = Record<string, unknown>;

function getFilteredObject(input: CompileInput): any {
  const obj = clone(input);
  const res = {};
  const allAllowed = [
    ...Object.keys(allowedFields),
    ...exposedConfigOptions,
  ].sort();
  for (const field of allAllowed) {
    const value = obj[field];
    if (is.array(value)) {
      res[field] = value.map((element) =>
        getFilteredObject(element as CompileInput)
      );
    } else if (is.plainObject(value)) {
      res[field] = getFilteredObject(value);
    } else if (!is.undefined(value)) {
      res[field] = value;
    }
  }
  return res;
}

const templateRegex = /{{(#(if|unless) )?([a-zA-Z]+)}}/g;

export function compile(
  template: string,
  input: CompileInput,
  filterFields = true
): string {
  const data = { ...getAdminConfig(), ...input };
  const filteredInput = filterFields ? getFilteredObject(data) : data;
  logger.trace({ template, filteredInput }, 'Compiling template');
  if (filterFields) {
    const matches = template.matchAll(templateRegex);
    for (const match of matches) {
      const varName = match[3];
      if (!allowedFieldsList.includes(varName)) {
        logger.info(
          { varName, template },
          'Disallowed variable name in template'
        );
      }
    }
  }
  return handlebars.compile(template)(filteredInput);
}
