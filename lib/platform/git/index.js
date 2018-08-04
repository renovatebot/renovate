const fs = require('fs-extra');
const { join } = require('path');
const tmp = require('tmp-promise');
const Git = require('simple-git/promise');

module.exports = {
  // Initialization
  cleanRepo,
  initRepo,
  setBaseBranch,
  // Search
  getFileList,
  // Branch
  branchExists,
  getAllRenovateBranches,
  isBranchStale,
  deleteBranch,
  mergeBranch,
  getBranchLastCommitTime,
  // file
  commitFilesToBranch,
  getFile,
};

let config = {};

async function initRepo({ url, gitAuthor }) {
  const tmpDir = await tmp.dir({ unsafeCleanup: true });
  const git = Git(tmpDir.path).silent(true);
  await git.clone(url, '.');

  config.gitAuthor = gitAuthor;
  if (gitAuthor) {
    await git.raw(['config', 'user.name', gitAuthor.name]);
    await git.raw(['config', 'user.email', gitAuthor.address]);
    // not supported yet
    await git.raw(['config', 'commit.gpgsign', 'false']);
  }

  config.git = git;
  // see https://stackoverflow.com/a/44750379/1438522
  config.baseBranch = (await git.raw([
    'symbolic-ref',
    'refs/remotes/origin/HEAD',
  ]))
    .replace('refs/remotes/origin/', '')
    .trim();
  config.dir = tmpDir;
}

function setBaseBranch(branchName) {
  if (branchName) {
    logger.debug(`Setting baseBranch to ${branchName}`);
    config.baseBranch = branchName;
  }
}

async function getFileList(branchName = config.baseBranch) {
  const exists = await branchExists(branchName);
  if (!exists) {
    return [];
  }
  const files = await config.git.raw([
    'ls-tree',
    '-r',
    '--name-only',
    'origin/' + branchName,
  ]);
  return files.split('\n').filter(Boolean);
}

function localName(branchName) {
  return branchName.replace(/^origin\//, '');
}

async function branchExists(branchName) {
  try {
    await config.git.raw([
      'show-branch',
      'origin/' + branchName,
    ]);
    return true;
  } catch (ex) {
    return false;
  }
}

async function getAllRenovateBranches(branchPrefix) {
  const branches = await config.git.branch(['--remotes', '--verbose']);
  return branches.all
    .map(localName)
    .filter(branchName => branchName.startsWith(branchPrefix));
}

async function isBranchStale(branchName) {
  const branches = await config.git.branch([
    '--remotes',
    '--verbose',
    '--contains',
    config.baseBranch,
  ]);
  return !branches.all.map(localName).includes(branchName);
}

async function deleteBranch(branchName) {
  await config.git.raw(['push', '--delete', 'origin', branchName]);
  try {
    await config.git.deleteLocalBranch(branchName);
  } catch (ex) {
    // local branch may not exist
  }
}

async function mergeBranch(branchName) {
  await config.git.reset('hard');
  await config.git.checkoutBranch(branchName, 'origin/' + branchName);
  await config.git.checkout(config.baseBranch);
  await config.git.merge([branchName]);
  await config.git.push('origin', config.baseBranch);
}

async function getBranchLastCommitTime(branchName) {
  try {
    const time = await config.git.show(['-s', '--format=%ai', branchName]);
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
    const content = await config.git.show([
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
  await config.git.reset('hard');
  await config.git.checkoutBranch(branchName, parentBranch);
  for (const file of files) {
    await fs.writeFile(
      join(config.dir.path, file.name),
      Buffer.from(file.contents)
    );
  }
  await config.git.add(files.map(f => f.name));
  await config.git.commit(message);
  await config.git.push('origin', branchName, ['--force']);
}

function cleanRepo() {
  if (config.dir) {
    config.dir.cleanup();
  }
  config = {};
}
