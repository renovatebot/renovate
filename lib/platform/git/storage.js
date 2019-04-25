const fs = require('fs-extra');
const { join } = require('path');
const path = require('path');
const URL = require('url');
const Git = require('simple-git/promise');
const convertHrtime = require('convert-hrtime');

class Storage {
  constructor() {
    let config = {};
    let git = null;
    let cwd = null;

    Object.assign(this, {
      initRepo,
      cleanRepo,
      getRepoStatus,
      setBaseBranch,
      branchExists,
      commitFilesToBranch,
      createBranch,
      deleteBranch,
      getAllRenovateBranches,
      getBranchCommit,
      getBranchLastCommitTime,
      getCommitMessages,
      getFile,
      getFileList,
      isBranchStale,
      mergeBranch,
    });

    // istanbul ignore next
    async function resetToBranch(branchName) {
      await git.raw(['reset', '--hard']);
      await git.checkout(branchName);
      await git.raw(['reset', '--hard', 'origin/' + branchName]);
    }

    // istanbul ignore next
    async function cleanLocalBranches() {
      const existingBranches = (await git.raw(['branch']))
        .split('\n')
        .map(branch => branch.trim())
        .filter(branch => branch.length)
        .filter(branch => !branch.startsWith('* '));
      logger.debug({ existingBranches });
      for (const branchName of existingBranches) {
        await deleteLocalBranch(branchName);
      }
    }

    async function initRepo(args) {
      cleanRepo();
      config = { ...args };
      cwd = config.localDir;
      logger.info('Initialising git repository into ' + cwd);
      const gitHead = path.join(cwd, '.git/HEAD');
      let clone = true;
      async function determineBaseBranch() {
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
      if (process.env.NODE_ENV !== 'test' && (await fs.exists(gitHead))) {
        try {
          git = Git(cwd).silent(true);
          await git.raw(['remote', 'set-url', 'origin', config.url]);
          const fetchStart = process.hrtime();
          await git.fetch(config.url, ['--depth=2', '--no-single-branch']);
          await determineBaseBranch();
          await resetToBranch(config.baseBranch);
          await cleanLocalBranches();
          await git.raw(['remote', 'prune', 'origin']);
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
        git = Git(cwd).silent(true);
        const cloneStart = process.hrtime();
        try {
          await git.clone(config.url, '.', ['--depth=2', '--no-single-branch']);
        } catch (err) /* istanbul ignore next */ {
          logger.debug({ err }, 'git clone error');
          throw new Error('platform-failure');
        }
        const cloneSeconds =
          Math.round(
            1 + 10 * convertHrtime(process.hrtime(cloneStart)).seconds
          ) / 10;
        logger.info({ cloneSeconds }, 'git clone completed');
      }
      try {
        const latestCommitDate = (await git.log({ n: 1 })).latest.date;
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
        await git.raw(['config', 'commit.gpgsign', 'false']);
      }

      if (global.gitAuthor) {
        logger.info({ gitAuthor: global.gitAuthor }, 'Setting git author');
        try {
          await git.raw(['config', 'user.name', global.gitAuthor.name]);
          await git.raw(['config', 'user.email', global.gitAuthor.email]);
        } catch (err) /* istanbul ignore next */ {
          logger.debug({ err }, 'Error setting git config');
          throw new Error('temporary-error');
        }
      }

      await determineBaseBranch();
    }

    // istanbul ignore next
    function getRepoStatus() {
      return git.status();
    }

    async function createBranch(branchName, sha) {
      await git.reset('hard');
      await git.checkout(['-B', branchName, sha]);
      await git.push(['origin', branchName, '--force']);
    }

    // Return the commit SHA for a branch
    async function getBranchCommit(branchName) {
      const res = await git.revparse(['origin/' + branchName]);
      return res.trim();
    }

    async function getCommitMessages() {
      logger.debug('getCommitMessages');
      const res = await git.log({
        n: 10,
        format: { message: '%s' },
      });
      return res.all.map(commit => commit.message);
    }

    async function setBaseBranch(branchName) {
      if (branchName) {
        logger.debug(`Setting baseBranch to ${branchName}`);
        config.baseBranch = branchName;
        if (branchName !== 'master') {
          config.baseBranchSha = (await git.raw([
            'rev-parse',
            'origin/' + branchName,
          ])).trim();
        }
      }
    }

    async function getFileList(branchName) {
      const branch = branchName || config.baseBranch;
      const exists = await branchExists(branch);
      if (!exists) {
        return [];
      }
      const files = await git.raw([
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

    async function branchExists(branchName) {
      try {
        await git.raw(['show-branch', 'origin/' + branchName]);
        return true;
      } catch (ex) {
        return false;
      }
    }

    async function getAllRenovateBranches(branchPrefix) {
      const branches = await git.branch(['--remotes', '--verbose']);
      return branches.all
        .map(localName)
        .filter(branchName => branchName.startsWith(branchPrefix));
    }

    async function isBranchStale(branchName) {
      const branches = await git.branch([
        '--remotes',
        '--verbose',
        '--contains',
        config.baseBranchSha || `origin/${config.baseBranch}`,
      ]);
      return !branches.all.map(localName).includes(branchName);
    }

    async function deleteLocalBranch(branchName) {
      await git.branch(['-D', branchName]);
    }

    async function deleteBranch(branchName) {
      try {
        await git.raw(['push', '--delete', 'origin', branchName]);
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
        await deleteLocalBranch(branchName);
        // istanbul ignore next
        logger.debug({ branchName }, 'Deleted local branch');
      } catch (err) {
        logger.debug({ branchName }, 'No local branch to delete');
      }
    }

    async function mergeBranch(branchName) {
      await git.reset('hard');
      await git.checkout(['-B', branchName, 'origin/' + branchName]);
      await git.checkout(config.baseBranch);
      await git.merge([branchName]);
      await git.push('origin', config.baseBranch);
    }

    async function getBranchLastCommitTime(branchName) {
      try {
        const time = await git.show([
          '-s',
          '--format=%ai',
          'origin/' + branchName,
        ]);
        return new Date(Date.parse(time));
      } catch (ex) {
        return new Date();
      }
    }

    async function getFile(filePath, branchName) {
      if (branchName) {
        const exists = await branchExists(branchName);
        if (!exists) {
          logger.info({ branchName }, 'branch no longer exists - aborting');
          throw new Error('repository-changed');
        }
      }
      try {
        const content = await git.show([
          'origin/' + (branchName || config.baseBranch) + ':' + filePath,
        ]);
        return content;
      } catch (ex) {
        return null;
      }
    }

    async function commitFilesToBranch(
      branchName,
      files,
      message,
      parentBranch = config.baseBranch
    ) {
      try {
        await git.reset('hard');
        await git.raw(['clean', '-fd']);
        await git.checkout(['-B', branchName, 'origin/' + parentBranch]);
        const fileNames = [];
        const deleted = [];
        for (const file of files) {
          // istanbul ignore if
          if (file.name === '|delete|') {
            deleted.push(file.contents);
          } else {
            fileNames.push(file.name);
            await fs.outputFile(
              join(cwd, file.name),
              Buffer.from(file.contents)
            );
          }
        }
        // istanbul ignore if
        if (fileNames.length === 1 && fileNames[0] === 'renovate.json') {
          fileNames.unshift('-f');
        }
        if (fileNames.length) await git.add(fileNames);
        if (deleted.length) await git.rm(deleted);
        await git.commit(message);
        await git.push([
          'origin',
          `${branchName}:${branchName}`,
          '--force',
          '-u',
        ]);
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

    function cleanRepo() {}
  }
}

function localName(branchName) {
  return branchName.replace(/^origin\//, '');
}

Storage.getUrl = ({ gitFs, auth, hostname, host, repository }) => {
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
};

module.exports = Storage;
