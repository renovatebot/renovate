const fs = require('fs-extra');
const { join } = require('path');
const tmp = require('tmp-promise');
const Git = require('simple-git/promise');

class Storage {
  constructor() {
    let config = {};
    let git = null;
    let repoDir = null;

    Object.assign(this, {
      initRepo,
      cleanRepo,
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

    async function initRepo(args) {
      cleanRepo();
      config = { ...args };
      repoDir = await tmp.dir({ unsafeCleanup: true });
      git = Git(repoDir.path).silent(true);
      await git.clone(config.url, '.');

      if (config.gitAuthor) {
        await git.raw(['config', 'user.name', config.gitAuthor.name]);
        await git.raw(['config', 'user.email', config.gitAuthor.address]);
        // not supported yet
        await git.raw(['config', 'commit.gpgsign', 'false']);
      }

      // see https://stackoverflow.com/a/44750379/1438522
      config.baseBranch =
        config.baseBranch ||
        (await git.raw(['symbolic-ref', 'refs/remotes/origin/HEAD']))
          .replace('refs/remotes/origin/', '')
          .trim();
    }

    async function createBranch(branchName, sha) {
      await git.reset('hard');
      await git.checkoutBranch(branchName, sha);
      await git.push('origin', branchName, ['--force']);
    }

    // Return the commit SHA for a branch
    async function getBranchCommit(branchName) {
      const res = await git.revparse([branchName]);
      return res;
    }

    async function getCommitMessages() {
      logger.debug('getCommitMessages');
      const res = await git.log('master', 'master^10');
      return res.all.map(commit => commit.message);
    }

    function setBaseBranch(branchName) {
      if (branchName) {
        logger.debug(`Setting baseBranch to ${branchName}`);
        config.baseBranch = branchName;
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
        config.baseBranch,
      ]);
      return !branches.all.map(localName).includes(branchName);
    }

    async function deleteBranch(branchName) {
      await git.raw(['push', '--delete', 'origin', branchName]);
      try {
        await git.deleteLocalBranch(branchName);
      } catch (ex) {
        // local branch may not exist
      }
    }

    async function mergeBranch(branchName) {
      await git.reset('hard');
      await git.checkoutBranch(branchName, 'origin/' + branchName);
      await git.checkout(config.baseBranch);
      await git.merge([branchName]);
      await git.push('origin', config.baseBranch);
    }

    async function getBranchLastCommitTime(branchName) {
      try {
        const time = await git.show(['-s', '--format=%ai', branchName]);
        return new Date(Date.parse(time));
      } catch (ex) {
        return new Date();
      }
    }

    async function getFile(filePath, branchName) {
      if (branchName) {
        const exists = await branchExists(branchName);
        if (!exists) {
          return null;
        }
      }
      try {
        const content = await git.show([
          (branchName || config.baseBranch) + ':' + filePath,
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
      await git.reset('hard');
      await git.checkoutBranch(branchName, parentBranch);
      for (const file of files) {
        await fs.writeFile(
          join(repoDir.path, file.name),
          Buffer.from(file.contents)
        );
      }
      await git.add(files.map(f => f.name));
      await git.commit(message);
      await git.push('origin', branchName, ['--force']);
    }

    function cleanRepo() {
      if (repoDir) {
        repoDir.cleanup();
        repoDir = null;
      }
    }
  }
}

function localName(branchName) {
  return branchName.replace(/^origin\//, '');
}

module.exports = Storage;
