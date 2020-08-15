import { join } from 'path';
import URL from 'url';
import fs from 'fs-extra';
import Git, {
  DiffResult as DiffResult_,
  Options,
  ResetMode,
  SimpleGit,
  StatusResult as StatusResult_,
} from 'simple-git';
import {
  CONFIG_VALIDATION,
  REPOSITORY_CHANGED,
  REPOSITORY_EMPTY,
  REPOSITORY_TEMPORARY_ERROR,
  SYSTEM_INSUFFICIENT_DISK_SPACE,
} from '../../constants/error-messages';
import { logger } from '../../logger';
import { ExternalHostError } from '../../types/errors/external-host-error';
import * as limits from '../../workers/global/limits';
import { writePrivateKey } from './private-key';

export * from './private-key';

declare module 'fs-extra' {
  export function exists(pathLike: string): Promise<boolean>;
}

export type StatusResult = StatusResult_;

export type DiffResult = DiffResult_;

interface StorageConfig {
  localDir: string;
  currentBranch?: string;
  url: string;
  extraCloneOpts?: Options;
  gitAuthorName?: string;
  gitAuthorEmail?: string;
}

interface LocalConfig extends StorageConfig {
  currentBranch: string;
  currentBranchSha: string;
  branchExists: Record<string, boolean>;
  branchIsModified: Record<string, boolean>;
  branchPrefix: string;
}

// istanbul ignore next
function checkForPlatformFailure(err: Error): void {
  if (process.env.NODE_ENV === 'test') {
    return;
  }
  const platformFailureStrings = [
    'remote: Invalid username or password',
    'gnutls_handshake() failed',
    'The requested URL returned error: 5',
    'The remote end hung up unexpectedly',
    'access denied or repository not exported',
    'Could not write new index file',
    'Failed to connect to',
    'Connection timed out',
  ];
  for (const errorStr of platformFailureStrings) {
    if (err.message.includes(errorStr)) {
      logger.debug({ err }, 'Converting git error to ExternalHostError');
      throw new ExternalHostError(err, 'git');
    }
  }
}

function localName(branchName: string): string {
  return branchName.replace(/^origin\//, '');
}

function throwBranchValidationError(branchName: string): never {
  const error = new Error(CONFIG_VALIDATION);
  error.validationError = 'branch not found';
  error.validationMessage =
    'The following branch could not be found: ' + branchName;
  throw error;
}

async function isDirectory(dir: string): Promise<boolean> {
  try {
    return (await fs.stat(dir)).isDirectory();
  } catch (err) {
    return false;
  }
}

async function getDefaultBranch(git: SimpleGit): Promise<string> {
  // see https://stackoverflow.com/a/44750379/1438522
  try {
    const res = await git.raw(['symbolic-ref', 'refs/remotes/origin/HEAD']);
    return res.replace('refs/remotes/origin/', '').trim();
  } catch (err) /* istanbul ignore next */ {
    checkForPlatformFailure(err);
    if (
      err.message.startsWith(
        'fatal: ref refs/remotes/origin/HEAD is not a symbolic ref'
      )
    ) {
      throw new Error(REPOSITORY_EMPTY);
    }
    throw err;
  }
}

let config: LocalConfig = {} as any;

let git: SimpleGit | undefined;

let privateKeySet = false;

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

/*
 * When we initially clone, we clone only the default branch so how no knowledge of other branches existing.
 * By calling this function once the repo's branchPrefix is known, we can fetch all of Renovate's branches in one command.
 */
export async function setBranchPrefix(branchPrefix: string): Promise<void> {
  logger.debug('Setting branchPrefix: ' + branchPrefix);
  config.branchPrefix = branchPrefix;
  const ref = `refs/heads/${branchPrefix}*:refs/remotes/origin/${branchPrefix}*`;
  try {
    await git.fetch(['origin', ref, '--depth=2', '--force']);
  } catch (err) /* istanbul ignore next */ {
    checkForPlatformFailure(err);
    throw err;
  }
}

export async function getSubmodules(): Promise<string[]> {
  return (
    (await git.raw([
      'config',
      '--file',
      '.gitmodules',
      '--get-regexp',
      'path',
    ])) || ''
  )
    .trim()
    .split(/[\n\s]/)
    .filter((_e: string, i: number) => i % 2);
}

export async function syncGit(): Promise<void> {
  if (git) {
    return;
  }
  logger.debug('Initializing git repository into ' + config.localDir);
  const gitHead = join(config.localDir, '.git/HEAD');
  let clone = true;

  if (await fs.exists(gitHead)) {
    try {
      git = Git(config.localDir).silent(true);
      await git.raw(['remote', 'set-url', 'origin', config.url]);
      const fetchStart = Date.now();
      await git.fetch(['--depth=10']);
      config.currentBranch =
        config.currentBranch || (await getDefaultBranch(git));
      await resetToBranch(config.currentBranch);
      await cleanLocalBranches();
      await git.raw(['remote', 'prune', 'origin']);
      const durationMs = Math.round(Date.now() - fetchStart);
      logger.debug({ durationMs }, 'git fetch completed');
      clone = false;
    } catch (err) /* istanbul ignore next */ {
      logger.error({ err }, 'git fetch error');
    }
  }
  if (clone) {
    await fs.emptyDir(config.localDir);
    git = Git(config.localDir).silent(true);
    const cloneStart = Date.now();
    try {
      // clone only the default branch
      let opts = ['--depth=2'];
      if (config.extraCloneOpts) {
        opts = opts.concat(
          Object.entries(config.extraCloneOpts).map((e) => `${e[0]}=${e[1]}`)
        );
      }
      await git.clone(config.url, '.', opts);
    } catch (err) /* istanbul ignore next */ {
      logger.debug({ err }, 'git clone error');
      if (err.message?.includes('No space left on device')) {
        throw new Error(SYSTEM_INSUFFICIENT_DISK_SPACE);
      }
      throw new ExternalHostError(err, 'git');
    }
    const durationMs = Math.round(Date.now() - cloneStart);
    logger.debug({ durationMs }, 'git clone completed');
  }
  const submodules = await getSubmodules();
  for (const submodule of submodules) {
    try {
      logger.debug(`Cloning git submodule at ${submodule}`);
      await git.submoduleUpdate(['--init', '--', submodule]);
    } catch (err) {
      logger.warn(`Unable to initialise git submodule at ${submodule}`);
    }
  }
  try {
    const latestCommitDate = (await git.log({ n: 1 })).latest.date;
    logger.debug({ latestCommitDate }, 'latest commit');
  } catch (err) /* istanbul ignore next */ {
    checkForPlatformFailure(err);
    if (err.message.includes('does not have any commits yet')) {
      throw new Error(REPOSITORY_EMPTY);
    }
    logger.warn({ err }, 'Cannot retrieve latest commit date');
  }
  try {
    const { gitAuthorName, gitAuthorEmail } = config;
    if (gitAuthorName) {
      logger.debug({ gitAuthorName }, 'Setting git author name');
      await git.raw(['config', 'user.name', gitAuthorName]);
    }
    if (gitAuthorEmail) {
      logger.debug({ gitAuthorEmail }, 'Setting git author email');
      await git.raw(['config', 'user.email', gitAuthorEmail]);
    }
  } catch (err) /* istanbul ignore next */ {
    checkForPlatformFailure(err);
    logger.debug({ err }, 'Error setting git author config');
    throw new Error(REPOSITORY_TEMPORARY_ERROR);
  }

  config.currentBranch = config.currentBranch || (await getDefaultBranch(git));
}

export async function initRepo(args: StorageConfig): Promise<void> {
  config = { ...args } as any;
  config.branchExists = {};
  config.branchIsModified = {};
  git = undefined;
  await syncGit();
}

// istanbul ignore next
export function getRepoStatus(): Promise<StatusResult> {
  return git.status();
}

export async function createBranch(
  branchName: string,
  sha: string
): Promise<void> {
  logger.debug(`createBranch(${branchName})`);
  await git.reset(ResetMode.HARD);
  await git.raw(['clean', '-fd']);
  await git.checkout(['-B', branchName, sha]);
  await git.push('origin', branchName, { '--force': true });
  config.branchExists[branchName] = true;
  config.branchIsModified[branchName] = false;
}

export async function branchExists(branchName: string): Promise<boolean> {
  // First check cache
  if (config.branchExists[branchName] !== undefined) {
    return config.branchExists[branchName];
  }
  if (!branchName.startsWith(config.branchPrefix)) {
    // fetch the branch only if it's not part of the existing branchPrefix
    try {
      await git.raw(['remote', 'set-branches', '--add', 'origin', branchName]);
      await git.fetch(['origin', branchName, '--depth=2']);
    } catch (err) {
      checkForPlatformFailure(err);
    }
  }
  try {
    await git.raw(['show-branch', 'origin/' + branchName]);
    config.branchExists[branchName] = true;
    return true;
  } catch (err) {
    checkForPlatformFailure(err);
    config.branchExists[branchName] = false;
    return false;
  }
}

// Return the commit SHA for a branch
export async function getBranchCommit(branchName: string): Promise<string> {
  if (!(await branchExists(branchName))) {
    throw Error(
      'Cannot fetch commit for branch that does not exist: ' + branchName
    );
  }
  const res = await git.revparse(['origin/' + branchName]);
  return res.trim();
}

export async function getCommitMessages(): Promise<string[]> {
  logger.debug('getCommitMessages');
  const res = await git.log({
    n: 10,
    format: { message: '%s' },
  });
  return res.all.map((commit) => commit.message);
}

export async function setBranch(branchName: string): Promise<string> {
  if (!(await branchExists(branchName))) {
    throwBranchValidationError(branchName);
  }
  logger.debug(`Setting current branch to ${branchName}`);
  try {
    config.currentBranch = branchName;
    config.currentBranchSha = (
      await git.raw(['rev-parse', 'origin/' + branchName])
    ).trim();
    await git.checkout([branchName, '-f']);
    const latestCommitDate = (await git.log({ n: 1 }))?.latest?.date;
    if (latestCommitDate) {
      logger.debug({ branchName, latestCommitDate }, 'latest commit');
    }
    await git.reset(ResetMode.HARD);
    return config.currentBranchSha;
  } catch (err) /* istanbul ignore next */ {
    checkForPlatformFailure(err);
    if (
      err.message.includes(
        'unknown revision or path not in the working tree'
      ) ||
      err.message.includes('did not match any file(s) known to git')
    ) {
      throwBranchValidationError(branchName);
    }
    throw err;
  }
}

export async function getFileList(): Promise<string[]> {
  const branch = config.currentBranch;
  const submodules = await getSubmodules();
  const files: string = await git.raw(['ls-tree', '-r', branch]);
  // istanbul ignore if
  if (!files) {
    return [];
  }
  return files
    .split('\n')
    .filter(Boolean)
    .filter((line) => line.startsWith('100'))
    .map((line) => line.split(/\t/).pop())
    .filter((file: string) =>
      submodules.every((submodule: string) => !file.startsWith(submodule))
    );
}

export async function getAllRenovateBranches(
  branchPrefix: string
): Promise<string[]> {
  const branches = await git.branch(['--remotes', '--verbose']);
  return branches.all
    .map(localName)
    .filter((branchName) => branchName.startsWith(branchPrefix));
}

export async function isBranchStale(branchName: string): Promise<boolean> {
  if (!(await branchExists(branchName))) {
    throw Error(
      'Cannot check staleness for branch that does not exist: ' + branchName
    );
  }
  const branches = await git.branch([
    '--remotes',
    '--verbose',
    '--contains',
    config.currentBranchSha,
  ]);
  return !branches.all.map(localName).includes(branchName);
}

export async function isBranchModified(branchName: string): Promise<boolean> {
  // First check cache
  if (config.branchIsModified[branchName] !== undefined) {
    return config.branchIsModified[branchName];
  }
  if (!(await branchExists(branchName))) {
    throw Error(
      'Cannot check modification for branch that does not exist: ' + branchName
    );
  }
  // Retrieve the author of the most recent commit
  const lastAuthor = (
    await git.raw(['log', '-1', '--pretty=format:%ae', `origin/${branchName}`])
  ).trim();
  const { gitAuthorEmail } = config;
  if (
    lastAuthor === process.env.RENOVATE_LEGACY_GIT_AUTHOR_EMAIL || // remove in next major release
    lastAuthor === gitAuthorEmail
  ) {
    // author matches - branch has not been modified
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
  config.branchExists[branchName] = false;
}

export async function mergeBranch(branchName: string): Promise<void> {
  await git.reset(ResetMode.HARD);
  await git.checkout(['-B', branchName, 'origin/' + branchName]);
  await git.checkout(config.currentBranch);
  await git.merge(['--ff-only', branchName]);
  await git.push('origin', config.currentBranch);
  limits.incrementLimit('prCommitsPerRunLimit');
}

export async function getBranchLastCommitTime(
  branchName: string
): Promise<Date> {
  try {
    const time = await git.show(['-s', '--format=%ai', 'origin/' + branchName]);
    return new Date(Date.parse(time));
  } catch (err) {
    checkForPlatformFailure(err);
    return new Date();
  }
}

export async function getBranchFiles(branchName: string): Promise<string[]> {
  try {
    const diff = await git.diffSummary([branchName, config.currentBranch]);
    return diff.files.map((file) => file.file);
  } catch (err) /* istanbul ignore next */ {
    checkForPlatformFailure(err);
    return null;
  }
}

export async function getFile(
  filePath: string,
  branchName?: string
): Promise<string | null> {
  if (branchName) {
    const exists = await branchExists(branchName);
    if (!exists) {
      logger.debug({ branchName }, 'branch no longer exists - aborting');
      throw new Error(REPOSITORY_CHANGED);
    }
  }
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
  try {
    return (await git.diff(['HEAD', branchName])) !== '';
  } catch (err) {
    return true;
  }
}

/**
 * File to commit
 */
export interface File {
  /**
   * Relative file path
   */
  name: string;

  /**
   * file contents
   */
  contents: string | Buffer;
}

export type CommitFilesConfig = {
  branchName: string;
  files: File[];
  message: string;
  force?: boolean;
};

export async function commitFiles({
  branchName,
  files,
  message,
  force = false,
}: CommitFilesConfig): Promise<string | null> {
  logger.debug(`Committing files to branch ${branchName}`);
  if (!privateKeySet) {
    await writePrivateKey(config.localDir);
    privateKeySet = true;
  }
  try {
    await git.reset(ResetMode.HARD);
    await git.raw(['clean', '-fd']);
    await git.checkout(['-B', branchName, 'origin/' + config.currentBranch]);
    const fileNames: string[] = [];
    const deleted: string[] = [];
    for (const file of files) {
      // istanbul ignore if
      if (file.name === '|delete|') {
        deleted.push(file.contents as string);
      } else if (await isDirectory(join(config.localDir, file.name))) {
        fileNames.push(file.name);
        await git.add(file.name);
      } else {
        fileNames.push(file.name);
        let contents: Buffer;
        // istanbul ignore else
        if (typeof file.contents === 'string') {
          contents = Buffer.from(file.contents);
        } else {
          contents = file.contents;
        }
        await fs.outputFile(join(config.localDir, file.name), contents);
      }
    }
    // istanbul ignore if
    if (fileNames.length === 1 && fileNames[0] === 'renovate.json') {
      fileNames.unshift('-f');
    }
    if (fileNames.length) {
      await git.add(fileNames);
    }
    if (deleted.length) {
      for (const f of deleted) {
        try {
          await git.rm([f]);
        } catch (err) /* istanbul ignore next */ {
          checkForPlatformFailure(err);
          logger.debug({ err }, 'Cannot delete ' + f);
        }
      }
    }
    const commitRes = await git.commit(message, [], {
      '--no-verify': true,
    });
    const commit = commitRes?.commit || 'unknown';
    if (!force && !(await hasDiff(`origin/${branchName}`))) {
      logger.debug(
        { branchName, fileNames },
        'No file changes detected. Skipping commit'
      );
      return null;
    }
    await git.push('origin', `${branchName}:${branchName}`, {
      '--force': true,
      '-u': true,
      '--no-verify': true,
    });
    // Fetch it after create
    const ref = `refs/heads/${branchName}:refs/remotes/origin/${branchName}`;
    await git.fetch(['origin', ref, '--depth=2', '--force']);
    config.branchExists[branchName] = true;
    config.branchIsModified[branchName] = false;
    limits.incrementLimit('prCommitsPerRunLimit');
    return commit;
  } catch (err) /* istanbul ignore next */ {
    checkForPlatformFailure(err);
    if (
      err.message.includes(
        'refusing to allow a GitHub App to create or update workflow'
      )
    ) {
      logger.warn(
        'App has not been granted permissios to update Workflows - aborting branch.'
      );
      return null;
    }
    logger.debug({ err }, 'Error commiting files');
    throw new Error(REPOSITORY_CHANGED);
  }
}

export function getUrl({
  protocol,
  auth,
  hostname,
  host,
  repository,
}: {
  protocol?: 'ssh' | 'http' | 'https';
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
