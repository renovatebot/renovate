import convertHrtime from 'convert-hrtime';
import fs from 'fs-extra';
import { join } from 'path';
import Git from 'simple-git/promise';
import URL from 'url';
import { logger } from '../../logger';
import * as limits from '../../workers/global/limits';
import {
  CONFIG_VALIDATION,
  PLATFORM_FAILURE,
  REPOSITORY_CHANGED,
  REPOSITORY_EMPTY,
  REPOSITORY_TEMPORARY_ERROR,
} from '../../constants/error-messages';

declare module 'fs-extra' {
  // eslint-disable-next-line import/prefer-default-export
  export function exists(pathLike: string): Promise<boolean>;
}

export type StatusResult = Git.StatusResult;

/**
 * File to commit to branch
 */
export interface File {
  /**
   * Relative file path
   */
  name: string;

  /**
   * file contents
   */
  contents: string;
}

interface StorageConfig {
  localDir: string;
  baseBranch?: string;
  url: string;
  gitPrivateKey?: string;
}

interface LocalConfig extends StorageConfig {
  baseBranch: string;
  baseBranchSha: string;
  branchExists: Record<string, boolean>;
  branchPrefix: string;
}

export type CommitFilesConfig = {
  branchName: string;
  files: File[];
  message: string;
  parentBranch?: string;
};

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
      throw new Error(PLATFORM_FAILURE);
    }
  }
}

function localName(branchName: string): string {
  return branchName.replace(/^origin\//, '');
}

function throwBaseBranchValidationError(branchName: string): never {
  const error = new Error(CONFIG_VALIDATION);
  error.validationError = 'baseBranch not found';
  error.validationMessage =
    'The following configured baseBranch could not be found: ' + branchName;
  throw error;
}

async function isDirectory(dir: string): Promise<boolean> {
  try {
    return (await fs.stat(dir)).isDirectory();
  } catch (err) {
    return false;
  }
}

export class Storage {
  private _config: LocalConfig = {} as any;

  private _git: Git.SimpleGit | undefined;

  private _cwd: string | undefined;

  private async _resetToBranch(branchName: string): Promise<void> {
    logger.debug(`resetToBranch(${branchName})`);
    await this._git!.raw(['reset', '--hard']);
    await this._git!.checkout(branchName);
    await this._git!.raw(['reset', '--hard', 'origin/' + branchName]);
    await this._git!.raw(['clean', '-fd']);
  }

  private async _cleanLocalBranches(): Promise<void> {
    const existingBranches = (await this._git!.raw(['branch']))
      .split('\n')
      .map(branch => branch.trim())
      .filter(branch => branch.length)
      .filter(branch => !branch.startsWith('* '));
    logger.debug({ existingBranches });
    for (const branchName of existingBranches) {
      await this._deleteLocalBranch(branchName);
    }
  }

  async initRepo(args: StorageConfig): Promise<void> {
    this.cleanRepo();
    // eslint-disable-next-line no-multi-assign
    const config: LocalConfig = (this._config = { ...args } as any);
    // eslint-disable-next-line no-multi-assign
    const cwd = (this._cwd = config.localDir);
    this._config.branchExists = {};
    logger.info('Initialising git repository into ' + cwd);
    const gitHead = join(cwd, '.git/HEAD');
    let clone = true;

    // TODO: move to private class scope
    async function determineBaseBranch(git: Git.SimpleGit): Promise<void> {
      // see https://stackoverflow.com/a/44750379/1438522
      try {
        config.baseBranch =
          config.baseBranch ||
          (await git.raw(['symbolic-ref', 'refs/remotes/origin/HEAD']))
            .replace('refs/remotes/origin/', '')
            .trim();
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

    if (await fs.exists(gitHead)) {
      try {
        this._git = Git(cwd).silent(true);
        await this._git.raw(['remote', 'set-url', 'origin', config.url]);
        const fetchStart = process.hrtime();
        await this._git.fetch(['--depth=10']);
        await determineBaseBranch(this._git);
        await this._resetToBranch(config.baseBranch);
        await this._cleanLocalBranches();
        await this._git.raw(['remote', 'prune', 'origin']);
        const fetchSeconds =
          Math.round(
            1 + 10 * convertHrtime(process.hrtime(fetchStart)).seconds
          ) / 10;
        logger.info({ fetchSeconds }, 'git fetch completed');
        clone = false;
      } catch (err) /* istanbul ignore next */ {
        logger.error({ err }, 'git fetch error');
      }
    }
    if (clone) {
      await fs.emptyDir(cwd);
      this._git = Git(cwd).silent(true);
      const cloneStart = process.hrtime();
      try {
        // clone only the default branch
        await this._git.clone(config.url, '.', ['--depth=2']);
      } catch (err) /* istanbul ignore next */ {
        logger.debug({ err }, 'git clone error');
        throw new Error(PLATFORM_FAILURE);
      }
      const cloneSeconds =
        Math.round(1 + 10 * convertHrtime(process.hrtime(cloneStart)).seconds) /
        10;
      logger.info({ cloneSeconds }, 'git clone completed');
    }
    const submodules = await this.getSubmodules();
    for (const submodule of submodules) {
      try {
        logger.debug(`Cloning git submodule at ${submodule}`);
        await this._git.submoduleUpdate(['--init', '--', submodule]);
      } catch (err) {
        logger.warn(`Unable to initialise git submodule at ${submodule}`);
      }
    }
    try {
      const latestCommitDate = (await this._git!.log({ n: 1 })).latest.date;
      logger.debug({ latestCommitDate }, 'latest commit');
    } catch (err) /* istanbul ignore next */ {
      checkForPlatformFailure(err);
      if (err.message.includes('does not have any commits yet')) {
        throw new Error(REPOSITORY_EMPTY);
      }
      logger.warn({ err }, 'Cannot retrieve latest commit date');
    }
    // istanbul ignore if
    if (config.gitPrivateKey) {
      logger.debug('Git private key configured, but not being set');
    } else {
      logger.debug('No git private key present - commits will be unsigned');
      await this._git!.raw(['config', 'commit.gpgsign', 'false']);
    }

    if (global.gitAuthor) {
      logger.info({ gitAuthor: global.gitAuthor }, 'Setting git author');
      try {
        await this._git!.raw(['config', 'user.name', global.gitAuthor.name]);
        await this._git!.raw(['config', 'user.email', global.gitAuthor.email]);
      } catch (err) /* istanbul ignore next */ {
        checkForPlatformFailure(err);
        logger.debug({ err }, 'Error setting git config');
        throw new Error(REPOSITORY_TEMPORARY_ERROR);
      }
    }

    await determineBaseBranch(this._git!);
  }

  // istanbul ignore next
  getRepoStatus(): Promise<StatusResult> {
    return this._git!.status();
  }

  async createBranch(branchName: string, sha: string): Promise<void> {
    logger.debug(`createBranch(${branchName})`);
    await this._git!.reset('hard');
    await this._git!.raw(['clean', '-fd']);
    await this._git!.checkout(['-B', branchName, sha]);
    await this._git!.push('origin', branchName, { '--force': true });
    this._config.branchExists[branchName] = true;
  }

  // Return the commit SHA for a branch
  async getBranchCommit(branchName: string): Promise<string> {
    if (!(await this.branchExists(branchName))) {
      throw Error(
        'Cannot fetch commit for branch that does not exist: ' + branchName
      );
    }
    const res = await this._git!.revparse(['origin/' + branchName]);
    return res.trim();
  }

  async getCommitMessages(): Promise<string[]> {
    logger.debug('getCommitMessages');
    const res = await this._git!.log({
      n: 10,
      format: { message: '%s' },
    });
    return res.all.map(commit => commit.message);
  }

  async setBaseBranch(branchName: string): Promise<void> {
    if (branchName) {
      if (!(await this.branchExists(branchName))) {
        throwBaseBranchValidationError(branchName);
      }
      logger.debug(`Setting baseBranch to ${branchName}`);
      this._config.baseBranch = branchName;
      try {
        if (branchName !== 'master') {
          this._config.baseBranchSha = (await this._git!.raw([
            'rev-parse',
            'origin/' + branchName,
          ])).trim();
        }
        await this._git!.checkout([branchName, '-f']);
        await this._git!.reset('hard');
        const latestCommitDate = (await this._git!.log({ n: 1 })).latest.date;
        logger.debug({ branchName, latestCommitDate }, 'latest commit');
      } catch (err) /* istanbul ignore next */ {
        checkForPlatformFailure(err);
        if (
          err.message.includes(
            'unknown revision or path not in the working tree'
          )
        ) {
          throwBaseBranchValidationError(branchName);
        }
        throw err;
      }
    }
  }

  /*
   * When we initially clone, we clone only the default branch so how no knowledge of other branches existing.
   * By calling this function once the repo's branchPrefix is known, we can fetch all of Renovate's branches in one command.
   */
  async setBranchPrefix(branchPrefix: string): Promise<void> {
    logger.debug('Setting branchPrefix: ' + branchPrefix);
    this._config.branchPrefix = branchPrefix;
    const ref = `refs/heads/${branchPrefix}*:refs/remotes/origin/${branchPrefix}*`;
    try {
      await this._git!.fetch(['origin', ref, '--depth=2', '--force']);
    } catch (err) /* istanbul ignore next */ {
      checkForPlatformFailure(err);
      throw err;
    }
  }

  async getFileList(branchName?: string): Promise<string[]> {
    const branch = branchName || this._config.baseBranch;
    const exists = await this.branchExists(branch);
    if (!exists) {
      return [];
    }
    const submodules = await this.getSubmodules();
    const files: string = await this._git!.raw([
      'ls-tree',
      '-r',
      '--name-only',
      'origin/' + branch,
    ]);
    // istanbul ignore if
    if (!files) {
      return [];
    }
    return files
      .split('\n')
      .filter(Boolean)
      .filter((file: string) =>
        submodules.every((submodule: string) => !file.startsWith(submodule))
      );
  }

  async getSubmodules(): Promise<string[]> {
    return (
      (await this._git!.raw([
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

  async branchExists(branchName: string): Promise<boolean> {
    // First check cache
    if (this._config.branchExists[branchName] !== undefined) {
      return this._config.branchExists[branchName];
    }
    if (!branchName.startsWith(this._config.branchPrefix)) {
      // fetch the branch only if it's not part of the existing branchPrefix
      try {
        await this._git!.raw([
          'remote',
          'set-branches',
          '--add',
          'origin',
          branchName,
        ]);
        await this._git!.fetch(['origin', branchName, '--depth=2']);
      } catch (err) {
        checkForPlatformFailure(err);
      }
    }
    try {
      await this._git!.raw(['show-branch', 'origin/' + branchName]);
      this._config.branchExists[branchName] = true;
      return true;
    } catch (err) {
      checkForPlatformFailure(err);
      this._config.branchExists[branchName] = false;
      return false;
    }
  }

  async getAllRenovateBranches(branchPrefix: string): Promise<string[]> {
    const branches = await this._git!.branch(['--remotes', '--verbose']);
    return branches.all
      .map(localName)
      .filter(branchName => branchName.startsWith(branchPrefix));
  }

  async isBranchStale(branchName: string): Promise<boolean> {
    if (!(await this.branchExists(branchName))) {
      throw Error(
        'Cannot check staleness for branch that does not exist: ' + branchName
      );
    }
    const branches = await this._git!.branch([
      '--remotes',
      '--verbose',
      '--contains',
      this._config.baseBranchSha || `origin/${this._config.baseBranch}`,
    ]);
    return !branches.all.map(localName).includes(branchName);
  }

  private async _deleteLocalBranch(branchName: string): Promise<void> {
    await this._git!.branch(['-D', branchName]);
  }

  async deleteBranch(branchName: string): Promise<void> {
    try {
      await this._git!.raw(['push', '--delete', 'origin', branchName]);
      logger.debug({ branchName }, 'Deleted remote branch');
    } catch (err) /* istanbul ignore next */ {
      checkForPlatformFailure(err);
      logger.debug({ branchName }, 'No remote branch to delete');
    }
    try {
      await this._deleteLocalBranch(branchName);
      // istanbul ignore next
      logger.debug({ branchName }, 'Deleted local branch');
    } catch (err) {
      checkForPlatformFailure(err);
      logger.debug({ branchName }, 'No local branch to delete');
    }
    this._config.branchExists[branchName] = false;
  }

  async mergeBranch(branchName: string): Promise<void> {
    await this._git!.reset('hard');
    await this._git!.checkout(['-B', branchName, 'origin/' + branchName]);
    await this._git!.checkout(this._config.baseBranch);
    await this._git!.merge(['--ff-only', branchName]);
    await this._git!.push('origin', this._config.baseBranch);
    limits.incrementLimit('prCommitsPerRunLimit');
  }

  async getBranchLastCommitTime(branchName: string): Promise<Date> {
    try {
      const time = await this._git!.show([
        '-s',
        '--format=%ai',
        'origin/' + branchName,
      ]);
      return new Date(Date.parse(time));
    } catch (err) {
      checkForPlatformFailure(err);
      return new Date();
    }
  }

  async getFile(filePath: string, branchName?: string): Promise<string | null> {
    if (branchName) {
      const exists = await this.branchExists(branchName);
      if (!exists) {
        logger.info({ branchName }, 'branch no longer exists - aborting');
        throw new Error(REPOSITORY_CHANGED);
      }
    }
    try {
      const content = await this._git!.show([
        'origin/' + (branchName || this._config.baseBranch) + ':' + filePath,
      ]);
      return content;
    } catch (err) {
      checkForPlatformFailure(err);
      return null;
    }
  }

  async commitFilesToBranch({
    branchName,
    files,
    message,
    parentBranch = this._config.baseBranch,
  }: CommitFilesConfig): Promise<void> {
    logger.debug(`Committing files to branch ${branchName}`);
    try {
      await this._git!.reset('hard');
      await this._git!.raw(['clean', '-fd']);
      await this._git!.checkout(['-B', branchName, 'origin/' + parentBranch]);
      const fileNames = [];
      const deleted = [];
      for (const file of files) {
        // istanbul ignore if
        if (file.name === '|delete|') {
          deleted.push(file.contents);
        } else if (await isDirectory(join(this._cwd!, file.name))) {
          fileNames.push(file.name);
          await this._git!.add(file.name);
        } else {
          fileNames.push(file.name);
          await fs.outputFile(
            join(this._cwd!, file.name),
            Buffer.from(file.contents)
          );
        }
      }
      // istanbul ignore if
      if (fileNames.length === 1 && fileNames[0] === 'renovate.json') {
        fileNames.unshift('-f');
      }
      if (fileNames.length) await this._git!.add(fileNames);
      if (deleted.length) {
        for (const f of deleted) {
          try {
            await this._git!.rm([f]);
          } catch (err) /* istanbul ignore next */ {
            checkForPlatformFailure(err);
            logger.debug({ err }, 'Cannot delete ' + f);
          }
        }
      }
      await this._git!.commit(message);
      await this._git!.push('origin', `${branchName}:${branchName}`, {
        '--force': true,
        '-u': true,
      });
      // Fetch it after create
      const ref = `refs/heads/${branchName}:refs/remotes/origin/${branchName}`;
      await this._git!.fetch(['origin', ref, '--depth=2', '--force']);
      this._config.branchExists[branchName] = true;
      limits.incrementLimit('prCommitsPerRunLimit');
    } catch (err) /* istanbul ignore next */ {
      checkForPlatformFailure(err);
      logger.debug({ err }, 'Error commiting files');
      throw new Error(REPOSITORY_CHANGED);
    }
  }

  // eslint-disable-next-line
  cleanRepo(): void {}

  static getUrl({
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
}

export default Storage;
