import is from '@sindresorhus/is';
import handlebars from 'handlebars';
import { GlobalConfig } from '../../config/global';
import { logger } from '../../logger';

handlebars.registerHelper('encodeURIComponent', encodeURIComponent);

handlebars.registerHelper('stringToPrettyJSON', (input: string): string =>
  JSON.stringify(JSON.parse(input), null, 2)
);

// istanbul ignore next
handlebars.registerHelper(
  'replace',
  (find, replace, context) =>
    (context || '').replace(new RegExp(find, 'g'), replace) // TODO #12873
);

handlebars.registerHelper('lowercase', (str: string) => str?.toLowerCase());

handlebars.registerHelper('containsString', (str, subStr) =>
  str?.includes(subStr)
);

handlebars.registerHelper({
  and(...args) {
    // Need to remove the 'options', as last parameter
    // https://handlebarsjs.com/api-reference/helpers.html
    args.pop();
    return args.every(Boolean);
  },
  or(...args) {
    // Need to remove the 'options', as last parameter
    // https://handlebarsjs.com/api-reference/helpers.html
    args.pop();
    return args.some(Boolean);
  },
});

export const exposedConfigOptions = [
  'additionalBranchPrefix',
  'addLabels',
  'branchName',
  'branchPrefix',
  'branchTopic',
  'commitBody',
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
  'separateMajorMinor',
  'separateMinorPatch',
];

export const allowedFields = {
  baseBranch: 'The baseBranch for this branch/PR',
  body: 'The body of the release notes',
  currentValue: 'The extracted current value of the dependency being updated',
  currentVersion:
    'The version that would be currently installed. For example, if currentValue is ^3.0.0 then currentVersion might be 3.1.0.',
  currentDigest: 'The extracted current digest of the dependency being updated',
  currentDigestShort:
    'The extracted current short digest of the dependency being updated',
  datasource: 'The datasource used to look up the upgrade',
  depName: 'The name of the dependency being updated',
  depNameLinked:
    'The dependency name already linked to its home page using markdown',
  depNameSanitized:
    'The depName field sanitized for use in branches after removing spaces and special characters',
  depType: 'The dependency type (if extracted - manager-dependent)',
  displayFrom: 'The current value, formatted for display',
  displayPending: 'Latest pending update, if internalChecksFilter is in use',
  displayTo: 'The to value, formatted for display',
  hasReleaseNotes: 'true if the upgrade has release notes',
  isLockfileUpdate: 'true if the branch is a lock file update',
  isMajor: 'true if the upgrade is major',
  isPatch: 'true if the upgrade is a patch upgrade',
  isPin: 'true if the upgrade is pinning dependencies',
  isPinDigest: 'true if the upgrade is pinning digests',
  isRollback: 'true if the upgrade is a rollback PR',
  isReplacement: 'true if the upgrade is a replacement',
  isRange: 'true if the new value is a range',
  isSingleVersion:
    'true if the upgrade is to a single version rather than a range',
  logJSON: 'ChangeLogResult object for the upgrade',
  manager: 'The (package) manager which detected the dependency',
  newDigest: 'The new digest value',
  newDigestShort:
    'A shorted version of newDigest, for use when the full digest is too long to be conveniently displayed',
  newMajor:
    'The major version of the new version. e.g. "3" if the new version if "3.1.0"',
  newMinor:
    'The minor version of the new version. e.g. "1" if the new version if "3.1.0"',
  newName:
    'The name of the new dependency that replaces the current deprecated dependency',
  newValue:
    'The new value in the upgrade. Can be a range or version e.g. "^3.0.0" or "3.1.0"',
  newVersion: 'The new version in the upgrade, e.g. "3.1.0"',
  packageFile: 'The filename that the dependency was found in',
  packageFileDir:
    'The directory with full path where the packageFile was found',
  packageName: 'The full name that was used to look up the dependency',
  parentDir:
    'The name of the directory that the dependency was found in, without full path',
  platform: 'VCS platform in use, e.g. "github", "gitlab", etc.',
  prettyDepType: 'Massaged depType',
  prettyNewMajor: 'The new major value with v prepended to it.',
  prettyNewVersion: 'The new version value with v prepended to it.',
  project: 'ChangeLogProject object',
  recreateClosed: 'If true, this PR will be recreated if closed',
  references: 'A list of references for the upgrade',
  releases: 'An array of releases for an upgrade',
  releaseNotes: 'A ChangeLogNotes object for the release',
  repository: 'The current repository',
  semanticPrefix: 'The fully generated semantic prefix for commit messages',
  sourceRepo: 'The repository in the sourceUrl, if present',
  sourceRepoName: 'The repository name in the sourceUrl, if present',
  sourceRepoOrg: 'The repository organization in the sourceUrl, if present',
  sourceRepoSlug: 'The slugified pathname of the sourceUrl, if present',
  sourceUrl: 'The source URL for the package',
  updateType:
    'One of digest, pin, rollback, patch, minor, major, replacement, pinDigest',
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
  'hasWarningsErrors',
  'errors',
  'warnings',
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

const allowedTemplateFields = new Set([
  ...Object.keys(allowedFields),
  ...exposedConfigOptions,
]);

const compileInputProxyHandler: ProxyHandler<CompileInput> = {
  get(target: CompileInput, prop: keyof CompileInput): unknown {
    if (!allowedTemplateFields.has(prop)) {
      return undefined;
    }

    const value = target[prop];

    if (is.array(value)) {
      return value
        .filter(is.plainObject)
        .map((element) => proxyCompileInput(element as CompileInput));
    }

    if (is.plainObject(value)) {
      return proxyCompileInput(value);
    }

    return value;
  },
};

export function proxyCompileInput(input: CompileInput): CompileInput {
  return new Proxy<CompileInput>(input, compileInputProxyHandler);
}

const templateRegex =
  /{{(?:#(?:if|unless|with|each) )?([a-zA-Z.]+)(?: as \| [a-zA-Z.]+ \|)?}}/g; // TODO #12873

export function compile(
  template: string,
  input: CompileInput,
  filterFields = true
): string {
  const data = { ...GlobalConfig.get(), ...input };
  const filteredInput = filterFields ? proxyCompileInput(data) : data;
  logger.trace({ template, filteredInput }, 'Compiling template');
  if (filterFields) {
    const matches = template.matchAll(templateRegex);
    for (const match of matches) {
      const varNames = match[1].split('.');
      for (const varName of varNames) {
        if (!allowedFieldsList.includes(varName)) {
          logger.info(
            { varName, template },
            'Disallowed variable name in template'
          );
        }
      }
    }
  }
  return handlebars.compile(template)(filteredInput);
}

export function containsTemplates(
  value: unknown,
  templates: string | string[]
): boolean {
  if (!is.string(value)) {
    return false;
  }
  for (const m of [...value.matchAll(templateRegex)]) {
    for (const template of is.string(templates) ? [templates] : templates) {
      if (m[1] === template || m[1].startsWith(`${template}.`)) {
        return true;
      }
    }
  }

  return false;
}
