const moment = require('moment');
const openpgp = require('openpgp');
const path = require('path');
const get = require('./gh-got-wrapper');
const { expandError } = require('./util');

class Storage {
  constructor(config) {
    // config
    this.config = config;
    this.gitAuthor = config.gitAuthor;
    this.gitPrivateKey = config.gitPrivateKey;
    this.forkToken = config.forkToken;
    this.repository = config.repository;
    this.baseBranch = config.baseBranch;
    // cache
    this.branchList = null;
  }

  // Returns true if branch exists, otherwise false
  async branchExists(branchName) {
    if (!this.branchList) {
      logger.debug('Retrieving branchList');
      this.branchList = (await get(
        `repos/${this.repository}/branches?per_page=100`,
        {
          paginate: true,
        }
      )).body.map(branch => branch.name);
      logger.debug({ branchList: this.branchList }, 'Retrieved branchList');
    }
    const res = this.branchList.includes(branchName);
    logger.debug(`branchExists(${branchName})=${res}`);
    return res;
  }

  // Get full file list
  async getFileList(branchName) {
    try {
      const res = await get(
        `repos/${this.repository}/git/trees/${branchName}?recursive=true`
      );
      if (res.body.truncated) {
        logger.warn(
          { repository: this.repository },
          'repository tree is truncated'
        );
      }
      const fileList = res.body.tree
        .filter(item => item.type === 'blob' && item.mode !== '120000')
        .map(item => item.path)
        .sort();
      logger.debug(`Retrieved fileList with length ${fileList.length}`);
      return fileList;
    } catch (err) /* istanbul ignore next */ {
      if (err.statusCode === 409) {
        logger.debug('Repository is not initiated');
        throw new Error('uninitiated');
      }
      logger.info(
        { repository: this.repository },
        'Error retrieving git tree - no files detected'
      );
      return [];
    }
  }

  async getAllRenovateBranches(branchPrefix) {
    logger.trace('getAllRenovateBranches');
    try {
      const allBranches = (await get(
        `repos/${this.repository}/git/refs/heads/${branchPrefix}`,
        {
          paginate: true,
        }
      )).body;
      return allBranches.reduce((arr, branch) => {
        if (branch.ref.startsWith(`refs/heads/${branchPrefix}`)) {
          arr.push(branch.ref.substring('refs/heads/'.length));
        }
        if (
          branchPrefix.endsWith('/') &&
          branch.ref === `refs/heads/${branchPrefix.slice(0, -1)}`
        ) {
          logger.warn(
            `Pruning branch "${branchPrefix.slice(
              0,
              -1
            )}" so that it does not block PRs`
          );
          arr.push(branch.ref.substring('refs/heads/'.length));
        }
        return arr;
      }, []);
    } catch (err) /* istanbul ignore next */ {
      return [];
    }
  }

  async isBranchStale(branchName) {
    // Check if branch's parent SHA = master SHA
    logger.debug(`isBranchStale(${branchName})`);
    const branchCommit = await this.getBranchCommit(branchName);
    logger.debug(`branchCommit=${branchCommit}`);
    const commitDetails = await getCommitDetails(this, branchCommit);
    logger.trace({ commitDetails }, `commitDetails`);
    const parentSha = commitDetails.parents[0].sha;
    logger.debug(`parentSha=${parentSha}`);
    const baseCommitSHA = await this.getBranchCommit(this.baseBranch);
    logger.debug(`baseCommitSHA=${baseCommitSHA}`);
    // Return true if the SHAs don't match
    return parentSha !== baseCommitSHA;
  }

  async deleteBranch(branchName) {
    const options = this.forkToken ? { token: this.forkToken } : undefined;
    try {
      await get.delete(
        `repos/${this.repository}/git/refs/heads/${branchName}`,
        options
      );
    } catch (err) /* istanbul ignore next */ {
      if (err.message.startsWith('Reference does not exist')) {
        logger.info({ branchName }, 'Branch to delete does not exist');
      } else {
        logger.warn(
          { err, body: err.response.body, branchName },
          'Error deleting branch'
        );
      }
    }
  }

  async mergeBranch(branchName) {
    logger.debug(`mergeBranch(${branchName})`);
    const url = `repos/${this.repository}/git/refs/heads/${this.baseBranch}`;
    const options = {
      body: {
        sha: await this.getBranchCommit(branchName),
      },
    };
    try {
      await get.patch(url, options);
    } catch (err) {
      logger.info(
        expandError(err),
        `Error pushing branch merge for ${branchName}`
      );
      throw new Error('Branch automerge failed');
    }
    // Delete branch
    await this.deleteBranch(branchName);
  }

  async getBranchLastCommitTime(branchName) {
    try {
      const res = await get(
        `repos/${this.repository}/commits?sha=${branchName}`
      );
      return new Date(res.body[0].commit.committer.date);
    } catch (err) {
      logger.error(expandError(err), `getBranchLastCommitTime error`);
      return new Date();
    }
  }

  // Generic File operations

  async getFile(filePath, branchName) {
    logger.trace(`getFile(filePath=${filePath}, branchName=${branchName})`);
    let res;
    try {
      res = await get(
        `repos/${this.repository}/contents/${encodeURI(
          filePath
        )}?ref=${branchName || this.baseBranch}`
      );
    } catch (error) {
      if (error.statusCode === 404) {
        // If file not found, then return null JSON
        logger.info({ filePath, branchName }, 'getFile 404');
        return null;
      }
      if (
        error.statusCode === 403 &&
        error.message &&
        error.message.startsWith('This API returns blobs up to 1 MB in size')
      ) {
        logger.info('Large file');
        // istanbul ignore if
        if (branchName && branchName !== this.baseBranch) {
          logger.info('Cannot retrieve large files from non-master branch');
          return null;
        }
        // istanbul ignore if
        if (path.dirname(filePath) !== '.') {
          logger.info('Cannot retrieve large files from non-root directories');
          return null;
        }
        const treeUrl = `repos/${this.repository}/git/trees/${this.baseBranch}`;
        const baseName = path.basename(filePath);
        let fileSha;
        (await get(treeUrl)).body.tree.forEach(file => {
          if (file.path === baseName) {
            fileSha = file.sha;
          }
        });
        if (!fileSha) {
          logger.warn('Could not locate file blob');
          throw error;
        }
        res = await get(`repos/${this.repository}/git/blobs/${fileSha}`);
      } else {
        // Propagate if it's any other error
        throw error;
      }
    }
    if (res && res.body.content) {
      return Buffer.from(res.body.content, 'base64').toString();
    }
    return null;
  }

  // Add a new commit, create branch if not existing
  async commitFilesToBranch(
    branchName,
    files,
    message,
    parentBranch = this.baseBranch
  ) {
    logger.debug(
      `commitFilesToBranch('${branchName}', files, message, '${parentBranch})'`
    );
    const parentCommit = await this.getBranchCommit(parentBranch);
    const parentTree = await getCommitTree(this, parentCommit);
    const fileBlobs = [];
    // Create blobs
    for (const file of files) {
      const blob = await createBlob(this, file.contents);
      fileBlobs.push({
        name: file.name,
        blob,
      });
    }
    // Create tree
    const tree = await createTree(this, parentTree, fileBlobs);
    const commit = await createCommit(this, parentCommit, tree, message);
    const isBranchExisting = await this.branchExists(branchName);
    try {
      if (isBranchExisting) {
        await updateBranch(this, branchName, commit);
      } else {
        await this.createBranch(branchName, commit);
      }
    } catch (err) /* istanbul ignore next */ {
      logger.debug({
        files: files.filter(
          file =>
            !file.name.endsWith('package-lock.json') &&
            !file.name.endsWith('npm-shrinkwrap.json') &&
            !file.name.endsWith('yarn.lock')
        ),
      });
      throw err;
    }
  }

  // Internal branch operations

  // Creates a new branch with provided commit
  async createBranch(branchName, sha) {
    logger.debug(`createBranch(${branchName})`);
    const options = {
      body: {
        ref: `refs/heads/${branchName}`,
        sha,
      },
    };
    // istanbul ignore if
    if (this.forkToken) {
      options.token = this.forkToken;
    }
    try {
      // istanbul ignore if
      if (branchName.includes('/')) {
        const [blockingBranch] = branchName.split('/');
        if (await this.branchExists(blockingBranch)) {
          logger.warn({ blockingBranch }, 'Deleting blocking branch');
          await this.deleteBranch(blockingBranch);
        }
      }
      logger.debug({ options, branchName }, 'Creating branch');
      await get.post(`repos/${this.repository}/git/refs`, options);
      this.branchList.push(branchName);
      logger.debug('Created branch');
    } catch (err) /* istanbul ignore next */ {
      const headers = err.response.req.getHeaders();
      delete headers.token;
      logger.warn(
        {
          err,
          message: err.message,
          responseBody: err.response.body,
          headers,
          options,
        },
        'Error creating branch'
      );
      if (err.statusCode === 422) {
        throw new Error('repository-changed');
      }
      throw err;
    }
  }

  // Return the commit SHA for a branch
  async getBranchCommit(branchName) {
    const res = await get(
      `repos/${this.repository}/git/refs/heads/${branchName}`
    );
    return res.body.object.sha;
  }

  async getCommitMessages() {
    logger.debug('getCommitMessages');
    const res = await get(`repos/${this.repository}/commits`);
    return res.body.map(commit => commit.commit.message);
  }
}

// Internal: Updates an existing branch to new commit sha
async function updateBranch(self, branchName, commit) {
  logger.debug(`Updating branch ${branchName} with commit ${commit}`);
  const options = {
    body: {
      sha: commit,
      force: true,
    },
  };
  // istanbul ignore if
  if (self.forkToken) {
    options.token = self.forkToken;
  }
  try {
    await get.patch(
      `repos/${self.repository}/git/refs/heads/${branchName}`,
      options
    );
  } catch (err) /* istanbul ignore next */ {
    if (err.statusCode === 422) {
      logger.info(expandError(err), 'Branch no longer exists - exiting');
      throw new Error('repository-changed');
    }
    throw err;
  }
}
// Low-level commit operations

// Create a blob with fileContents and return sha
async function createBlob(self, fileContents) {
  logger.debug('Creating blob');
  const options = {
    body: {
      encoding: 'base64',
      content: Buffer.from(fileContents).toString('base64'),
    },
  };
  // istanbul ignore if
  if (self.forkToken) {
    options.token = self.forkToken;
  }
  return (await get.post(`repos/${self.repository}/git/blobs`, options)).body
    .sha;
}

// Return the tree SHA for a commit
async function getCommitTree(self, commit) {
  logger.debug(`getCommitTree(${commit})`);
  return (await get(`repos/${self.repository}/git/commits/${commit}`)).body.tree
    .sha;
}

// Create a tree and return SHA
async function createTree(self, baseTree, files) {
  logger.debug(`createTree(${baseTree}, files)`);
  const body = {
    base_tree: baseTree,
    tree: [],
  };
  files.forEach(file => {
    body.tree.push({
      path: file.name,
      mode: '100644',
      type: 'blob',
      sha: file.blob,
    });
  });
  logger.trace({ body }, 'createTree body');
  const options = { body };
  // istanbul ignore if
  if (self.forkToken) {
    options.token = self.forkToken;
  }
  return (await get.post(`repos/${self.repository}/git/trees`, options)).body
    .sha;
}

// Create a commit and return commit SHA
async function createCommit(self, parent, tree, message) {
  logger.debug(`createCommit(${parent}, ${tree}, ${message})`);
  const { gitAuthor, gitPrivateKey } = self;
  const now = moment();
  let author;
  if (gitAuthor) {
    logger.trace('Setting gitAuthor');
    author = {
      name: gitAuthor.name,
      email: gitAuthor.address,
      date: now.format(),
    };
  }
  const body = {
    message,
    parents: [parent],
    tree,
  };
  if (author) {
    body.author = author;
    // istanbul ignore if
    if (gitPrivateKey) {
      logger.debug('Found gitPrivateKey');
      const privKeyObj = openpgp.key.readArmored(gitPrivateKey).keys[0];
      const commit = `tree ${tree}\nparent ${parent}\nauthor ${author.name} <${
        author.email
      }> ${now.format('X ZZ')}\ncommitter ${author.name} <${
        author.email
      }> ${now.format('X ZZ')}\n\n${message}`;
      const { signature } = await openpgp.sign({
        data: openpgp.util.str2Uint8Array(commit),
        privateKeys: privKeyObj,
        detached: true,
        armor: true,
      });
      body.signature = signature;
    }
  }
  const options = {
    body,
  };
  // istanbul ignore if
  if (self.forkToken) {
    options.token = self.forkToken;
  }
  return (await get.post(`repos/${self.repository}/git/commits`, options)).body
    .sha;
}

async function getCommitDetails(self, commit) {
  logger.debug(`getCommitDetails(${commit})`);
  const results = await get(`repos/${self.repository}/git/commits/${commit}`);
  return results.body;
}

module.exports = Storage;
