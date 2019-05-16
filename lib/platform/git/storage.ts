import convertHrtime from 'convert-hrtime';
import fs from 'fs-extra';
import { join } from 'path';
import Git from 'simple-git/promise';
import URL from 'url';

declare module 'fs-extra' {
  export function exists(pathLike: string): Promise<boolean>;
}

interface IStorageConfig {
  localDir: string;
  baseBranch?: string;
  url: string;
  gitPrivateKey?: string;
}

interface ILocalConfig extends IStorageConfig {
  baseBranch: string;
  baseBranchSha: string;
  branchExists: { [branch: string]: boolean };
}

class Storage {
  private _config: ILocalConfig = {} as any;
  private _git: Git.SimpleGit | undefined;
  private _cwd: string | undefined;

  // istanbul ignore next
  private async _resetToBranch(branchName: string) {
    logger.debug(`resetToBranch(${branchName})`);
    await this._git!.raw(['reset', '--hard']);
    await this._git!.checkout(branchName);
    await this._git!.raw(['reset', '--hard', 'origin/' + branchName]);
    await this._git!.raw(['clean', '-fd']);
  }

  // istanbul ignore next
  private async _cleanLocalBranches() {
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

  async initRepo(args: IStorageConfig) {
    this.cleanRepo();
    let config: ILocalConfig = (this._config = { ...args } as any);
    let cwd = (this._cwd = config.localDir);
    this._config.branchExists = {};
    logger.info('Initialising git repository into ' + cwd);
    const gitHead = join(cwd, '.git/HEAD');
    let clone = true;

    //TODO: move to private class scope
    async function determineBaseBranch(git: Git.SimpleGit) {
      // see https://stackoverflow.com/a/44750379/1438522
      try {
        config.baseBranch =
          config.baseBranch ||
          (await git.raw(['symbolic-ref', 'refs/remotes/origin/HEAD']))
            .replace('refs/remotes/origin/', '')
            .trim();
      } catch (err) /* istanbul ignore next */ {
        if (
          err.message.startsWith(
            'fatal: ref refs/remotes/origin/HEAD is not a symbolic ref'
          )
        ) {
          throw new Error('empty');
        }
        throw err;
      }
    }

    // istanbul ignore if
    if (
      process.env.NODE_ENV !== 'test' &&
      /* istanbul ignore next */ (await fs.exists(gitHead))
    ) {
      try {
        this._git = Git(cwd).silent(true);
        await this._git.raw(['remote', 'set-url', 'origin', config.url]);
        const fetchStart = process.hrtime();
        await this._git.fetch([config.url, '--depth=2']);
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
      } catch (err) {
        logger.error({ err }, 'git fetch error');
      }
    }
    if (clone) {
      await fs.emptyDir(cwd);
      this._git = Git(cwd).silent(true);
      const cloneStart = process.hrtime();
      try {
        await this._git.clone(config.url, '.', [
          '--depth=2',
          '--no-single-branch',
        ]);
      } catch (err) /* istanbul ignore next */ {
        logger.debug({ err }, 'git clone error');
        throw new Error('platform-failure');
      }
      const cloneSeconds =
        Math.round(1 + 10 * convertHrtime(process.hrtime(cloneStart)).seconds) /
        10;
      logger.info({ cloneSeconds }, 'git clone completed');
    }
    try {
      const latestCommitDate = (await this._git!.log({ n: 1 })).latest.date;
      logger.debug({ latestCommitDate }, 'latest commit');
    } catch (err) /* istanbul ignore next */ {
      if (err.message.includes('does not have any commits yet')) {
        throw new Error('empty');
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
        logger.debug({ err }, 'Error setting git config');
        throw new Error('temporary-error');
      }
    }

    await determineBaseBranch(this._git!);
  }

  // istanbul ignore next
  getRepoStatus() {
    return this._git!.status();
  }

  async createBranch(branchName: string, sha: string) {
    logger.debug(`createBranch(${branchName})`);
    await this._git!.reset('hard');
    await this._git!.raw(['clean', '-fd']);
    await this._git!.checkout(['-B', branchName, sha]);
    await this._git!.push('origin', branchName, { '--force': true });
    this._config.branchExists[branchName] = true;
  }

  // Return the commit SHA for a branch
  async getBranchCommit(branchName: string) {
    const res = await this._git!.revparse(['origin/' + branchName]);
    return res.trim();
  }

  async getCommitMessages() {
    logger.debug('getCommitMessages');
    const res = await this._git!.log({
      n: 10,
      format: { message: '%s' },
    });
    return res.all.map(commit => commit.message);
  }

  async setBaseBranch(branchName: string) {
    if (branchName) {
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
      } catch (err) /* istanbul ignore next */ {
        if (
          err.message.includes(
            'unknown revision or path not in the working tree'
          )
        ) {
          const error = new Error('config-validation');
          error.validationError = 'baseBranch not found';
          error.validationMessage =
            'The following configured baseBranch could not be found: ' +
            branchName;
          throw error;
        }
        throw err;
      }
    }
  }

  async getFileList(branchName?: string) {
    const branch = branchName || this._config.baseBranch;
    const exists = await this.branchExists(branch);
    if (!exists) {
      return [];
    }
    const files = await this._git!.raw([
      'ls-tree',
      '-r',
      '--name-only',
      'origin/' + branch,
    ]);
    // istanbul ignore if
    if (!files) {
      return [];
    }
    return files.split('\n').filter(Boolean);
  }

  async branchExists(branchName: string) {
    // First check cache
    if (this._config.branchExists[branchName] !== undefined) {
      return this._config.branchExists[branchName];
    }
    try {
      await this._git!.raw(['show-branch', 'origin/' + branchName]);
      this._config.branchExists[branchName] = true;
      return true;
    } catch (ex) {
      this._config.branchExists[branchName] = false;
      return false;
    }
  }

  async getAllRenovateBranches(branchPrefix: string) {
    const branches = await this._git!.branch(['--remotes', '--verbose']);
    return branches.all
      .map(localName)
      .filter(branchName => branchName.startsWith(branchPrefix));
  }

  async isBranchStale(branchName: string) {
    const branches = await this._git!.branch([
      '--remotes',
      '--verbose',
      '--contains',
      this._config.baseBranchSha || `origin/${this._config.baseBranch}`,
    ]);
    return !branches.all.map(localName).includes(branchName);
  }

  private async _deleteLocalBranch(branchName: string) {
    await this._git!.branch(['-D', branchName]);
  }

  async deleteBranch(branchName: string) {
    try {
      await this._git!.raw(['push', '--delete', 'origin', branchName]);
      logger.debug({ branchName }, 'Deleted remote branch');
    } catch (err) /* istanbul ignore next */ {
      logger.info({ branchName, err }, 'Error deleting remote branch');
      if (err.message.includes('.github/main.workflow')) {
        logger.warn(
          'A GitHub bug prevents gitFs + GitHub Actions. Please disable gitFs'
        );
      } else {
        throw new Error('repository-changed');
      }
    }
    try {
      await this._deleteLocalBranch(branchName);
      // istanbul ignore next
      logger.debug({ branchName }, 'Deleted local branch');
    } catch (err) {
      logger.debug({ branchName }, 'No local branch to delete');
    }
    this._config.branchExists[branchName] = false;
  }

  async mergeBranch(branchName: string) {
    await this._git!.reset('hard');
    await this._git!.checkout(['-B', branchName, 'origin/' + branchName]);
    await this._git!.checkout(this._config.baseBranch);
    await this._git!.merge([branchName]);
    await this._git!.push('origin', this._config.baseBranch);
  }

  async getBranchLastCommitTime(branchName: string) {
    try {
      const time = await this._git!.show([
        '-s',
        '--format=%ai',
        'origin/' + branchName,
      ]);
      return new Date(Date.parse(time));
    } catch (ex) {
      return new Date();
    }
  }

  async getFile(filePath: string, branchName?: string) {
    if (branchName) {
      const exists = await this.branchExists(branchName);
      if (!exists) {
        logger.info({ branchName }, 'branch no longer exists - aborting');
        throw new Error('repository-changed');
      }
    }
    try {
      const content = await this._git!.show([
        'origin/' + (branchName || this._config.baseBranch) + ':' + filePath,
      ]);
      return content;
    } catch (ex) {
      return null;
    }
  }

  async commitFilesToBranch(
    branchName: string,
    files: any[],
    message: string,
    parentBranch = this._config.baseBranch
  ) {
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
            logger.debug({ err }, 'Cannot delete ' + f);
          }
        }
      }
      await this._git!.commit(message);
      await this._git!.push('origin', `${branchName}:${branchName}`, {
        '--force': true,
        '-u': true,
      });
    } catch (err) /* istanbul ignore next */ {
      logger.debug({ err }, 'Error commiting files');
      if (err.message.includes('.github/main.workflow')) {
        logger.warn(
          'A GitHub bug prevents gitFs + GitHub Actions. Please disable gitFs'
        );
        throw new Error('disable-gitfs');
      } else if (err.message.includes('[remote rejected]')) {
        throw new Error('repository-changed');
      }
      throw err;
    }
  }

  cleanRepo() {}

  static getUrl({
    gitFs,
    auth,
    hostname,
    host,
    repository,
  }: {
    gitFs?: 'ssh' | 'http' | 'https';
    auth?: string;
    hostname?: string;
    host?: string;
    repository: string;
  }) {
    let protocol = gitFs || 'https';
    // istanbul ignore if
    if (protocol.toString() === 'true') {
      protocol = 'https';
    }
    if (protocol === 'ssh') {
      return `git@${hostname}:${repository}.git`;
    }
    return URL.format({
      protocol,
      auth,
      hostname,
      host,
      pathname: repository + '.git',
    });
  }
}

function localName(branchName: string) {
  return branchName.replace(/^origin\//, '');
}

export = Storage;
