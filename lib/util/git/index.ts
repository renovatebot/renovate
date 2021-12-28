import URL from 'url';
import fs from 'fs-extra';
import type {
  Options,
  SimpleGit,
  TaskOptions,
  ResetMode as _ResetMode,
} from 'simple-git';
import * as simpleGit from 'simple-git';
import upath from 'upath';
import { configFileNames } from '../../config/app-strings';
import { GlobalConfig } from '../../config/global';
import type { RenovateConfig } from '../../config/types';
import {
  CONFIG_VALIDATION,
  REPOSITORY_CHANGED,
  REPOSITORY_DISABLED,
  REPOSITORY_EMPTY,
  SYSTEM_INSUFFICIENT_DISK_SPACE,
  TEMPORARY_ERROR,
} from '../../constants/error-messages';
import { logger } from '../../logger';
import { ExternalHostError } from '../../types/errors/external-host-error';
import type { GitProtocol } from '../../types/git';
import { api as semverCoerced } from '../../versioning/semver-coerced';
import { Limit, incLimitedValue } from '../../workers/global/limits';
import { regEx } from '../regex';
import { parseGitAuthor } from './author';
import { getNoVerify, simpleGitConfig } from './config';
import { configSigningKey, writePrivateKey } from './private-key';
import type {
  CommitFilesConfig,
  CommitSha,
  LocalConfig,
  StatusResult,
  StorageConfig,
} from './types';

export { setNoVerify } from './config';
export { setPrivateKey } from './private-key';

// TODO: fix upstream types https://github.com/steveukx/git-js/issues/704
const ResetMode = (simpleGit.default as any).ResetMode as typeof _ResetMode;

// istanbul ignore next
function checkForPlatformFailure(err: Error): void {
  if (process.env.NODE_ENV === 'test') {
    return;
  }
  const externalHostFailureStrings = [
    'remote: Invalid username or password',
    'gnutls_handshake() failed',
    'The requested URL returned error: 5',
    'The remote end hung up unexpectedly',
    'access denied or repository not exported',
    'Could not write new index file',
    'Failed to connect to',
    'Connection timed out',
    'malformed object name',
    'Could not resolve host',
    'early EOF',
    'fatal: bad config', // .gitmodules problem
    'expected flush after ref listing',
  ];
  for (const errorStr of externalHostFailureStrings) {
    if (err.message.includes(errorStr)) {
      logger.debug({ err }, 'Converting git error to ExternalHostError');
      throw new ExternalHostError(err, 'git');
    }
  }

  const configErrorStrings = [
    {
      error: 'GitLab: Branch name does not follow the pattern',
      message:
        "Cannot push because branch name does not follow project's push rules",
    },
    {
      error: 'GitLab: Commit message does not follow the pattern',
      message:
        "Cannot push because commit message does not follow project's push rules",
    },
    {
      error: ' is not a member of team',
      message:
        'The `Restrict commits to existing GitLab users` rule is blocking Renovate push. Check the Renovate `gitAuthor` setting',
    },
    {
      error: 'TF401027:',
      message:
        'You need the Git `GenericContribute` permission to perform this action',
    },
    {
      error: 'matches more than one',
      message:
        "Renovate cannot push branches if there are tags with names the same as Renovate's branches. Please remove conflicting tag names or change Renovate's branchPrefix to avoid conflicts.",
    },
  ];
  for (const { error, message } of configErrorStrings) {
    if (err.message.includes(error)) {
      logger.debug({ err }, 'Converting git error to CONFIG_VALIDATION error');
      const res = new Error(CONFIG_VALIDATION);
      res.validationError = message;
      res.validationMessage = err.message;
      throw res;
    }
  }
}

function localName(branchName: string): string {
  return branchName.replace(regEx(/^origin\//), '');
}

async function isDirectory(dir: string): Promise<boolean> {
  try {
    return (await fs.stat(dir)).isDirectory();
  } catch (err) {
    return false;
  }
}

async function getDefaultBranch(git: SimpleGit): Promise<string> {
  // see https://stackoverflow.com/a/62352647/3005034
  try {
    const res = await git.raw(['rev-parse', '--abbrev-ref', 'origin/HEAD']);
    return res.replace('origin/', '').trim();
  } catch (err) /* istanbul ignore next */ {
    checkForPlatformFailure(err);
    if (
      err.message.startsWith(
        'fatal: ref refs/remotes/origin/HEAD is not a symbolic ref'
      )
    ) {
      throw new Error(REPOSITORY_EMPTY);
    }
    // istanbul ignore if
    if (err.message.includes("fatal: ambiguous argument 'origin/HEAD'")) {
      logger.warn({ err }, 'Error getting default branch');
      throw new Error(TEMPORARY_ERROR);
    }
    throw err;
  }
}

let config: LocalConfig = {} as any;

let git: SimpleGit | undefined;
let gitInitialized: boolean;

let privateKeySet = false;

export const GIT_MINIMUM_VERSION = '2.33.0'; // git show-current

export async function validateGitVersion(): Promise<boolean> {
  let version: string;
  const globalGit = simpleGit.default();
  try {
    const raw = await globalGit.raw(['--version']);
    for (const section of raw.split(/\s+/)) {
      if (semverCoerced.isVersion(section)) {
        version = section;
        break;
      }
    }
  } catch (err) /* istanbul ignore next */ {
    logger.error({ err }, 'Error fetching git version');
    return false;
  }
  // istanbul ignore if
  if (
    !(
      version &&
      (version === GIT_MINIMUM_VERSION ||
        semverCoerced.isGreaterThan(version, GIT_MINIMUM_VERSION))
    )
  ) {
    logger.error(
      { detectedVersion: version, minimumVersion: GIT_MINIMUM_VERSION },
      'Git version needs upgrading'
    );
    return false;
  }
  logger.debug(`Found valid git version: ${version}`);
  return true;
}

async function fetchBranchCommits(): Promise<void> {
  config.branchCommits = {};
  const opts = ['ls-remote', '--heads', config.url];
  if (config.extraCloneOpts) {
    Object.entries(config.extraCloneOpts).forEach((e) =>
      opts.unshift(e[0], `${e[1]}`)
    );
  }
  try {
    (await git.raw(opts))
      .split('\n')
      .filter(Boolean)
      .map((line) => line.trim().split(regEx(/\s+/)))
      .forEach(([sha, ref]) => {
        config.branchCommits[ref.replace('refs/heads/', '')] = sha;
      });
  } catch (err) /* istanbul ignore next */ {
    checkForPlatformFailure(err);
    logger.debug({ err }, 'git error');
    if (err.message?.includes('Please ask the owner to check their account')) {
      throw new Error(REPOSITORY_DISABLED);
    }
    throw err;
  }
}

export async function initRepo(args: StorageConfig): Promise<void> {
  config = { ...args } as any;
  config.ignoredAuthors = [];
  config.additionalBranches = [];
  config.branchIsModified = {};
  const { localDir } = GlobalConfig.get();
  git = simpleGit.default(localDir, simpleGitConfig());
  gitInitialized = false;
  await fetchBranchCommits();
}

async function resetToBranch(branchName: string): Promise<void> {
  logger.debug(`resetToBranch(${branchName})`);
  await git.raw(['reset', '--hard']);
  await git.checkout(branchName);
  await git.raw(['reset', '--hard', 'origin/' + branchName]);
  await git.raw(['clean', '-fd']);
}

async function deleteLocalBranch(branchName: string): Promise<void> {
  await git.branch(['-D', branchName]);
}

async function cleanLocalBranches(): Promise<void> {
  const existingBranches = (await git.raw(['branch']))
    .split('\n')
    .map((branch) => branch.trim())
    .filter((branch) => branch.length)
    .filter((branch) => !branch.startsWith('* '));
  logger.debug({ existingBranches });
  for (const branchName of existingBranches) {
    await deleteLocalBranch(branchName);
  }
}

export function setGitAuthor(gitAuthor: string): void {
  const gitAuthorParsed = parseGitAuthor(
    gitAuthor || 'Renovate Bot <renovate@whitesourcesoftware.com>'
  );
  if (!gitAuthorParsed) {
    const error = new Error(CONFIG_VALIDATION);
    error.validationSource = 'None';
    error.validationError = 'Invalid gitAuthor';
    error.validationMessage = `gitAuthor is not parsed as valid RFC5322 format: ${gitAuthor}`;
    throw error;
  }
  config.gitAuthorName = gitAuthorParsed.name;
  config.gitAuthorEmail = gitAuthorParsed.address;
}

export async function writeGitAuthor(): Promise<void> {
  const { gitAuthorName, gitAuthorEmail } = config;
  try {
    if (gitAuthorName) {
      logger.debug({ gitAuthorName }, 'Setting git author name');
      await git.addConfig('user.name', gitAuthorName);
    }
    if (gitAuthorEmail) {
      logger.debug({ gitAuthorEmail }, 'Setting git author email');
      await git.addConfig('user.email', gitAuthorEmail);
    }
  } catch (err) /* istanbul ignore next */ {
    checkForPlatformFailure(err);
    logger.debug(
      { err, gitAuthorName, gitAuthorEmail },
      'Error setting git author config'
    );
    throw new Error(TEMPORARY_ERROR);
  }
}

export function setUserRepoConfig({
  gitIgnoredAuthors,
  gitAuthor,
}: RenovateConfig): void {
  config.ignoredAuthors = gitIgnoredAuthors ?? [];
  setGitAuthor(gitAuthor);
}

export async function getSubmodules(): Promise<string[]> {
  try {
    return (
      (await git.raw([
        'config',
        '--file',
        '.gitmodules',
        '--get-regexp',
        '\\.path',
      ])) || ''
    )
      .trim()
      .split(regEx(/[\n\s]/))
      .filter((_e: string, i: number) => i % 2);
  } catch (err) /* istanbul ignore next */ {
    logger.warn({ err }, 'Error getting submodules');
    return [];
  }
}

export async function syncGit(): Promise<void> {
  if (gitInitialized) {
    return;
  }
  gitInitialized = true;
  const { localDir } = GlobalConfig.get();
  logger.debug('Initializing git repository into ' + localDir);
  const gitHead = upath.join(localDir, '.git/HEAD');
  let clone = true;

  if (await fs.pathExists(gitHead)) {
    try {
      await git.raw(['remote', 'set-url', 'origin', config.url]);
      await resetToBranch(await getDefaultBranch(git));
      const fetchStart = Date.now();
      await git.pull();
      await git.fetch();
      config.currentBranch =
        config.currentBranch || (await getDefaultBranch(git));
      await resetToBranch(config.currentBranch);
      await cleanLocalBranches();
      await git.raw(['remote', 'prune', 'origin']);
      const durationMs = Math.round(Date.now() - fetchStart);
      logger.info({ durationMs }, 'git fetch completed');
      clone = false;
    } catch (err) /* istanbul ignore next */ {
      if (err.message === REPOSITORY_EMPTY) {
        throw err;
      }
      logger.info({ err }, 'git fetch error');
    }
  }
  if (clone) {
    await fs.emptyDir(localDir);
    const cloneStart = Date.now();
    try {
      const opts = [];
      if (config.fullClone) {
        logger.debug('Performing full clone');
      } else {
        logger.debug('Performing blobless clone');
        opts.push('--filter=blob:none');
      }
      if (config.extraCloneOpts) {
        Object.entries(config.extraCloneOpts).forEach((e) =>
          opts.push(e[0], `${e[1]}`)
        );
      }
      await git.clone(config.url, '.', opts);
    } catch (err) /* istanbul ignore next */ {
      logger.debug({ err }, 'git clone error');
      if (err.message?.includes('No space left on device')) {
        throw new Error(SYSTEM_INSUFFICIENT_DISK_SPACE);
      }
      if (err.message === REPOSITORY_EMPTY) {
        throw err;
      }
      throw new ExternalHostError(err, 'git');
    }
    const durationMs = Math.round(Date.now() - cloneStart);
    logger.debug({ durationMs }, 'git clone completed');
  }
  config.currentBranchSha = (await git.raw(['rev-parse', 'HEAD'])).trim();
  if (config.cloneSubmodules) {
    const submodules = await getSubmodules();
    for (const submodule of submodules) {
      try {
        logger.debug(`Cloning git submodule at ${submodule}`);
        await git.submoduleUpdate(['--init', submodule]);
      } catch (err) {
        logger.warn(
          { err },
          `Unable to initialise git submodule at ${submodule}`
        );
      }
    }
  }
  try {
    const latestCommit = (await git.log({ n: 1 })).latest;
    logger.debug({ latestCommit }, 'latest repository commit');
  } catch (err) /* istanbul ignore next */ {
    checkForPlatformFailure(err);
    if (err.message.includes('does not have any commits yet')) {
      throw new Error(REPOSITORY_EMPTY);
    }
    logger.warn({ err }, 'Cannot retrieve latest commit');
  }
  config.currentBranch = config.currentBranch || (await getDefaultBranch(git));
}

// istanbul ignore next
export async function getRepoStatus(): Promise<StatusResult> {
  await syncGit();
  return git.status();
}

export function branchExists(branchName: string): boolean {
  return !!config.branchCommits[branchName];
}

// Return the commit SHA for a branch
export function getBranchCommit(branchName: string): CommitSha | null {
  return config.branchCommits[branchName] || null;
}

// Return the parent commit SHA for a branch
export async function getBranchParentSha(
  branchName: string
): Promise<CommitSha | null> {
  try {
    const branchSha = getBranchCommit(branchName);
    const parentSha = await git.revparse([`${branchSha}^`]);
    return parentSha;
  } catch (err) {
    logger.debug({ err }, 'Error getting branch parent sha');
    return null;
  }
}

export async function getCommitMessages(): Promise<string[]> {
  await syncGit();
  logger.debug('getCommitMessages');
  const res = await git.log({
    n: 10,
    format: { message: '%s' },
  });
  return res.all.map((commit) => commit.message);
}

export async function checkoutBranch(branchName: string): Promise<CommitSha> {
  logger.debug(`Setting current branch to ${branchName}`);
  await syncGit();
  try {
    config.currentBranch = branchName;
    config.currentBranchSha = (
      await git.raw(['rev-parse', 'origin/' + branchName])
    ).trim();
    await git.checkout(['-f', branchName, '--']);
    const latestCommitDate = (await git.log({ n: 1 }))?.latest?.date;
    if (latestCommitDate) {
      logger.debug({ branchName, latestCommitDate }, 'latest commit');
    }
    await git.reset(ResetMode.HARD);
    return config.currentBranchSha;
  } catch (err) /* istanbul ignore next */ {
    checkForPlatformFailure(err);
    if (err.message?.includes('fatal: ambiguous argument')) {
      logger.warn({ err }, 'Failed to checkout branch');
      throw new Error(TEMPORARY_ERROR);
    }
    throw err;
  }
}

export async function getFileList(): Promise<string[]> {
  await syncGit();
  const branch = config.currentBranch;
  const submodules = await getSubmodules();
  let files: string;
  try {
    files = await git.raw(['ls-tree', '-r', branch]);
  } catch (err) /* istanbul ignore next */ {
    if (err.message?.includes('fatal: Not a valid object name')) {
      logger.debug(
        { err },
        'Branch not found when checking branch list - aborting'
      );
      throw new Error(REPOSITORY_CHANGED);
    }
    throw err;
  }
  // istanbul ignore if
  if (!files) {
    return [];
  }
  return files
    .split('\n')
    .filter(Boolean)
    .filter((line) => line.startsWith('100'))
    .map((line) => line.split(regEx(/\t/)).pop())
    .filter((file: string) =>
      submodules.every((submodule: string) => !file.startsWith(submodule))
    );
}

export function getBranchList(): string[] {
  return Object.keys(config.branchCommits);
}

export async function isBranchStale(branchName: string): Promise<boolean> {
  await syncGit();
  try {
    const { currentBranchSha, currentBranch } = config;
    const branches = await git.branch([
      '--remotes',
      '--verbose',
      '--contains',
      config.currentBranchSha,
    ]);
    const isStale = !branches.all.map(localName).includes(branchName);
    logger.debug(
      { isStale, currentBranch, currentBranchSha },
      `isBranchStale=${isStale}`
    );
    return isStale;
  } catch (err) /* istanbul ignore next */ {
    checkForPlatformFailure(err);
    throw err;
  }
}

export async function isBranchModified(branchName: string): Promise<boolean> {
  await syncGit();
  // First check cache
  if (config.branchIsModified[branchName] !== undefined) {
    return config.branchIsModified[branchName];
  }
  if (!branchExists(branchName)) {
    logger.debug(
      { branchName },
      'Branch does not exist - cannot check isModified'
    );
    return false;
  }
  // Retrieve the author of the most recent commit
  let lastAuthor: string;
  try {
    lastAuthor = (
      await git.raw([
        'log',
        '-1',
        '--pretty=format:%ae',
        `origin/${branchName}`,
        '--',
      ])
    ).trim();
  } catch (err) /* istanbul ignore next */ {
    if (err.message?.includes('fatal: bad revision')) {
      logger.debug(
        { err },
        'Remote branch not found when checking last commit author - aborting run'
      );
      throw new Error(REPOSITORY_CHANGED);
    }
    logger.warn({ err }, 'Error checking last author for isBranchModified');
  }
  const { gitAuthorEmail } = config;
  if (
    lastAuthor === gitAuthorEmail ||
    config.ignoredAuthors.some((ignoredAuthor) => lastAuthor === ignoredAuthor)
  ) {
    // author matches - branch has not been modified
    logger.debug({ branchName }, 'Branch has not been modified');
    config.branchIsModified[branchName] = false;
    return false;
  }
  logger.debug(
    { branchName, lastAuthor, gitAuthorEmail },
    'Last commit author does not match git author email - branch has been modified'
  );
  config.branchIsModified[branchName] = true;
  return true;
}

export async function deleteBranch(branchName: string): Promise<void> {
  await syncGit();
  try {
    await git.raw(['push', '--delete', 'origin', branchName]);
    logger.debug({ branchName }, 'Deleted remote branch');
  } catch (err) /* istanbul ignore next */ {
    checkForPlatformFailure(err);
    logger.debug({ branchName }, 'No remote branch to delete');
  }
  try {
    await deleteLocalBranch(branchName);
    // istanbul ignore next
    logger.debug({ branchName }, 'Deleted local branch');
  } catch (err) {
    checkForPlatformFailure(err);
    logger.debug({ branchName }, 'No local branch to delete');
  }
  delete config.branchCommits[branchName];
}

export async function mergeBranch(branchName: string): Promise<void> {
  let status: StatusResult;
  try {
    await syncGit();
    await git.reset(ResetMode.HARD);
    await git.checkout(['-B', branchName, 'origin/' + branchName]);
    await git.checkout([
      '-B',
      config.currentBranch,
      'origin/' + config.currentBranch,
    ]);
    status = await git.status();
    await git.merge(['--ff-only', branchName]);
    await git.push('origin', config.currentBranch);
    incLimitedValue(Limit.Commits);
  } catch (err) {
    logger.debug(
      {
        baseBranch: config.currentBranch,
        baseSha: config.currentBranchSha,
        branchName,
        branchSha: getBranchCommit(branchName),
        status,
        err,
      },
      'mergeBranch error'
    );
    throw err;
  }
}

export async function getBranchLastCommitTime(
  branchName: string
): Promise<Date> {
  await syncGit();
  try {
    const time = await git.show(['-s', '--format=%ai', 'origin/' + branchName]);
    return new Date(Date.parse(time));
  } catch (err) {
    checkForPlatformFailure(err);
    return new Date();
  }
}

export async function getBranchFiles(branchName: string): Promise<string[]> {
  await syncGit();
  try {
    const diff = await git.diffSummary([
      `origin/${branchName}`,
      `origin/${branchName}^`,
    ]);
    return diff.files.map((file) => file.file);
  } catch (err) /* istanbul ignore next */ {
    logger.warn({ err }, 'getBranchFiles error');
    checkForPlatformFailure(err);
    return null;
  }
}

export async function getFile(
  filePath: string,
  branchName?: string
): Promise<string | null> {
  await syncGit();
  try {
    const content = await git.show([
      'origin/' + (branchName || config.currentBranch) + ':' + filePath,
    ]);
    return content;
  } catch (err) {
    checkForPlatformFailure(err);
    return null;
  }
}

export async function hasDiff(branchName: string): Promise<boolean> {
  await syncGit();
  try {
    return (await git.diff(['HEAD', branchName])) !== '';
  } catch (err) {
    return true;
  }
}

export async function commitFiles({
  branchName,
  files,
  message,
  force = false,
}: CommitFilesConfig): Promise<CommitSha | null> {
  await syncGit();
  logger.debug(`Committing files to branch ${branchName}`);
  if (!privateKeySet) {
    await writePrivateKey();
    privateKeySet = true;
  }
  const { localDir } = GlobalConfig.get();
  await configSigningKey(localDir);
  await writeGitAuthor();
  try {
    await git.reset(ResetMode.HARD);
    await git.raw(['clean', '-fd']);
    await git.checkout(['-B', branchName, 'origin/' + config.currentBranch]);
    const deletedFiles: string[] = [];
    const addedModifiedFiles: string[] = [];
    const ignoredFiles: string[] = [];
    for (const file of files) {
      let fileName = file.name;
      // istanbul ignore if
      if (fileName === '|delete|') {
        fileName = file.contents as string;
        try {
          await git.rm([fileName]);
          deletedFiles.push(fileName);
        } catch (err) /* istanbul ignore next */ {
          checkForPlatformFailure(err);
          logger.trace({ err, fileName }, 'Cannot delete file');
          ignoredFiles.push(fileName);
        }
      } else {
        if (await isDirectory(upath.join(localDir, fileName))) {
          // This is usually a git submodule update
          logger.trace({ fileName }, 'Adding directory commit');
        } else {
          let contents: Buffer;
          // istanbul ignore else
          if (typeof file.contents === 'string') {
            contents = Buffer.from(file.contents);
          } else {
            contents = file.contents;
          }
          // some file systems including Windows don't support the mode
          // so the index should be manually updated after adding the file
          await fs.outputFile(upath.join(localDir, fileName), contents, {
            mode: file.executable ? 0o777 : 0o666,
          });
        }
        try {
          // istanbul ignore next
          const addParams =
            fileName === configFileNames[0] ? ['-f', fileName] : fileName;
          await git.add(addParams);
          if (file.executable) {
            await git.raw(['update-index', '--chmod=+x', fileName]);
          }
          addedModifiedFiles.push(fileName);
        } catch (err) /* istanbul ignore next */ {
          if (
            !err.message.includes(
              'The following paths are ignored by one of your .gitignore files'
            )
          ) {
            throw err;
          }
          logger.debug({ fileName }, 'Cannot commit ignored file');
          ignoredFiles.push(file.name);
        }
      }
    }

    const commitOptions: Options = {};
    if (getNoVerify().includes('commit')) {
      commitOptions['--no-verify'] = null;
    }

    const commitRes = await git.commit(message, [], commitOptions);
    if (
      commitRes.summary &&
      commitRes.summary.changes === 0 &&
      commitRes.summary.insertions === 0 &&
      commitRes.summary.deletions === 0
    ) {
      logger.warn({ commitRes }, 'Detected empty commit - aborting git push');
      return null;
    }
    logger.debug(
      { deletedFiles, ignoredFiles, result: commitRes },
      `git commit`
    );
    const commit = commitRes?.commit || 'unknown';
    if (!force && !(await hasDiff(`origin/${branchName}`))) {
      logger.debug(
        { branchName, deletedFiles, addedModifiedFiles, ignoredFiles },
        'No file changes detected. Skipping commit'
      );
      return null;
    }

    const pushOptions: TaskOptions = {
      '--force-with-lease': null,
      '-u': null,
    };
    if (getNoVerify().includes('push')) {
      pushOptions['--no-verify'] = null;
    }

    const pushRes = await git.push(
      'origin',
      `${branchName}:${branchName}`,
      pushOptions
    );
    delete pushRes.repo;
    logger.debug({ result: pushRes }, 'git push');
    // Fetch it after create
    const ref = `refs/heads/${branchName}:refs/remotes/origin/${branchName}`;
    await git.fetch(['origin', ref, '--force']);
    config.branchCommits[branchName] = (
      await git.revparse([branchName])
    ).trim();
    config.branchIsModified[branchName] = false;
    incLimitedValue(Limit.Commits);
    return commit;
  } catch (err) /* istanbul ignore next */ {
    checkForPlatformFailure(err);
    if (err.message.includes(`'refs/heads/renovate' exists`)) {
      const error = new Error(CONFIG_VALIDATION);
      error.validationSource = 'None';
      error.validationError = 'An existing branch is blocking Renovate';
      error.validationMessage = `Renovate needs to create the branch "${branchName}" but is blocked from doing so because of an existing branch called "renovate". Please remove it so that Renovate can proceed.`;
      throw error;
    }
    if (
      err.message.includes(
        'refusing to allow a GitHub App to create or update workflow'
      )
    ) {
      logger.warn(
        'App has not been granted permissions to update Workflows - aborting branch.'
      );
      return null;
    }
    if (
      (err.message.includes('remote rejected') ||
        err.message.includes('403')) &&
      files?.some((file) => file.name?.startsWith('.github/workflows/'))
    ) {
      logger.debug({ err }, 'commitFiles error');
      logger.info('Workflows update rejection - aborting branch.');
      return null;
    }
    if (err.message.includes('protected branch hook declined')) {
      const error = new Error(CONFIG_VALIDATION);
      error.validationSource = branchName;
      error.validationError = 'Renovate branch is protected';
      error.validationMessage = `Renovate cannot push to its branch because branch protection has been enabled.`;
      throw error;
    }
    if (err.message.includes('can only push your own commits')) {
      const error = new Error(CONFIG_VALIDATION);
      error.validationSource = branchName;
      error.validationError = 'Bitbucket committer error';
      error.validationMessage = `Renovate has experienced the following error when attempting to push its branch to the server: "${String(
        err.message
      )}"`;
      throw error;
    }
    if (err.message.includes('remote: error: cannot lock ref')) {
      logger.error({ err }, 'Error committing files.');
      return null;
    }
    if (err.message.includes('[rejected] (stale info)')) {
      logger.info(
        'Branch update was rejected because local copy is not up-to-date.'
      );
      return null;
    }
    if (
      err.message.includes('denying non-fast-forward') ||
      err.message.includes('GH003: Sorry, force-pushing')
    ) {
      logger.debug({ err }, 'Permission denied to update branch');
      const error = new Error(CONFIG_VALIDATION);
      error.validationSource = branchName;
      error.validationError = 'Force push denied';
      error.validationMessage = `Renovate is unable to update branch(es) due to force pushes being disallowed.`;
      throw error;
    }
    logger.debug({ err }, 'Unknown error committing files');
    // We don't know why this happened, so this will cause bubble up to a branch error
    throw err;
  }
}

export function getUrl({
  protocol,
  auth,
  hostname,
  host,
  repository,
}: {
  protocol?: GitProtocol;
  auth?: string;
  hostname?: string;
  host?: string;
  repository: string;
}): string {
  if (protocol === 'ssh') {
    return `git@${hostname}:${repository}.git`;
  }
  return URL.format({
    protocol: protocol || 'https',
    auth,
    hostname,
    host,
    pathname: repository + '.git',
  });
}
