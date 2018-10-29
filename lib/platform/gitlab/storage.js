const get = require('./gl-got-wrapper');

function urlEscape(str) {
  return str ? str.replace(/\//g, '%2F') : str;
}

class Storage {
  constructor() {
    // config
    let config = {};
    // cache
    let baseCommitSHA = null;
    let branchFiles = {};

    Object.assign(this, {
      initRepo,
      cleanRepo,
      getRepoStatus: () => ({}),
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
      setBaseBranch,
    });

    function initRepo(args) {
      cleanRepo();
      config = { ...args };
    }

    function cleanRepo() {
      baseCommitSHA = null;
      branchFiles = {};
    }

    // Branch

    // Returns true if branch exists, otherwise false
    async function branchExists(branchName) {
      logger.debug(`Checking if branch exists: ${branchName}`);
      try {
        const url = `projects/${
          config.repository
        }/repository/branches/${urlEscape(branchName)}`;
        const res = await get(url);
        if (res.statusCode === 200) {
          logger.debug('Branch exists');
          return true;
        }
        // This probably shouldn't happen
        logger.debug("Branch doesn't exist");
        return false;
      } catch (error) {
        if (error.statusCode === 404) {
          // If file not found, then return false
          logger.debug("Branch doesn't exist");
          return false;
        }
        // Propagate if it's any other error
        throw error;
      }
    }

    async function getAllRenovateBranches(branchPrefix) {
      logger.debug(`getAllRenovateBranches(${branchPrefix})`);
      const allBranches = await get(
        `projects/${config.repository}/repository/branches`
      );
      return allBranches.body.reduce((arr, branch) => {
        if (branch.name.startsWith(branchPrefix)) {
          arr.push(branch.name);
        }
        return arr;
      }, []);
    }

    async function isBranchStale(branchName) {
      logger.debug(`isBranchStale(${branchName})`);
      const branchDetails = await getBranchDetails(branchName);
      logger.trace({ branchDetails }, 'branchDetails');
      const parentSha = branchDetails.body.commit.parent_ids[0];
      logger.debug(`parentSha=${parentSha}`);
      const baseSHA = await getBaseCommitSHA();
      logger.debug(`baseSHA=${baseSHA}`);
      // Return true if the SHAs don't match
      return parentSha !== baseSHA;
    }

    // Add a new commit, create branch if not existing
    async function commitFilesToBranch(
      branchName,
      files,
      message,
      parentBranch = config.baseBranch
    ) {
      logger.debug(
        `commitFilesToBranch('${branchName}', files, message, '${parentBranch})'`
      );
      const opts = {
        body: {
          branch: branchName,
          commit_message: message,
          start_branch: parentBranch,
          actions: [],
        },
      };
      // istanbul ignore if
      if (config.gitAuthor) {
        opts.body.author_name = config.gitAuthor.name;
        opts.body.author_email = config.gitAuthor.address;
      }
      for (const file of files) {
        const action = {
          file_path: file.name,
          content: Buffer.from(file.contents).toString('base64'),
          encoding: 'base64',
        };
        action.action = (await getFile(file.name)) ? 'update' : 'create';
        opts.body.actions.push(action);
      }
      let res = 'created';
      try {
        if (await branchExists(branchName)) {
          logger.debug('Deleting existing branch');
          await deleteBranch(branchName);
          res = 'updated';
        }
      } catch (err) {
        // istanbul ignore next
        logger.info(`Ignoring branch deletion failure`);
      }
      logger.debug('Adding commits');
      await get.post(`projects/${config.repository}/repository/commits`, opts);
      return res;
    }

    async function createBranch(branchName, sha) {
      await get.post(
        `projects/${config.repository}/repository/branches?branch=${urlEscape(
          branchName
        )}&ref=${sha}`
      );
    }

    async function deleteBranch(branchName) {
      await get.delete(
        `projects/${config.repository}/repository/branches/${urlEscape(
          branchName
        )}`
      );
    }

    // Search

    // Get full file list
    async function getFileList(branchName = config.baseBranch) {
      if (branchFiles[branchName]) {
        return branchFiles[branchName];
      }
      try {
        let url = `projects/${
          config.repository
        }/repository/tree?ref=${branchName}&per_page=100`;
        if (!(process.env.RENOVATE_DISABLE_FILE_RECURSION === 'true')) {
          url += '&recursive=true';
        }
        const res = await get(url, { paginate: true });
        branchFiles[branchName] = res.body
          .filter(item => item.type === 'blob' && item.mode !== '120000')
          .map(item => item.path)
          .sort();
        logger.debug(
          `Retrieved fileList with length ${branchFiles[branchName].length}`
        );
      } catch (err) {
        logger.info('Error retrieving git tree - no files detected');
        branchFiles[branchName] = [];
      }
      return branchFiles[branchName];
    }

    // Generic File operations

    async function getFile(filePath, branchName) {
      logger.debug(`getFile(filePath=${filePath}, branchName=${branchName})`);
      if (!branchName || branchName === config.baseBranch) {
        if (
          branchFiles[branchName] &&
          !branchFiles[branchName].includes(filePath)
        ) {
          return null;
        }
      }
      try {
        const url = `projects/${config.repository}/repository/files/${urlEscape(
          filePath
        )}?ref=${branchName || config.baseBranch}`;
        const res = await get(url);
        return Buffer.from(res.body.content, 'base64').toString();
      } catch (error) {
        if (error.statusCode === 404) {
          // If file not found, then return null JSON
          return null;
        }
        // Propagate if it's any other error
        throw error;
      }
    }

    // GET /projects/:id/repository/commits
    async function getCommitMessages() {
      logger.debug('getCommitMessages');
      const res = await get(`projects/${config.repository}/repository/commits`);
      return res.body.map(commit => commit.title);
    }

    function getBranchDetails(branchName) {
      const url = `projects/${
        config.repository
      }/repository/branches/${urlEscape(branchName)}`;
      return get(url);
    }

    async function getBaseCommitSHA() {
      if (!baseCommitSHA) {
        const branchDetails = await getBranchDetails(config.baseBranch);
        baseCommitSHA = branchDetails.body.commit.id;
      }
      return baseCommitSHA;
    }

    async function mergeBranch(branchName) {
      logger.debug(`mergeBranch(${branchName}`);
      const branchURI = encodeURIComponent(branchName);
      try {
        await get.post(
          `projects/${
            config.repository
          }/repository/commits/${branchURI}/cherry_pick?branch=${
            config.baseBranch
          }`
        );
      } catch (err) {
        logger.info({ err }, `Error pushing branch merge for ${branchName}`);
        throw new Error('Branch automerge failed');
      }
      // Update base commit
      baseCommitSHA = null;
      // Delete branch
      await deleteBranch(branchName);
    }

    async function getBranchCommit(branchName) {
      const branchUrl = `projects/${
        config.repository
      }/repository/branches/${urlEscape(branchName)}`;
      try {
        const branch = (await get(branchUrl)).body;
        if (branch && branch.commit) {
          return branch.commit.id;
        }
      } catch (err) {
        // istanbul ignore next
        logger.error({ err }, `getBranchCommit error`);
      }
      // istanbul ignore next
      return null;
    }

    async function getBranchLastCommitTime(branchName) {
      try {
        const res = await get(
          `projects/${
            config.repository
          }/repository/commits?ref_name=${urlEscape(branchName)}`
        );
        return new Date(res.body[0].committed_date);
      } catch (err) {
        logger.error({ err }, `getBranchLastCommitTime error`);
        return new Date();
      }
    }

    async function setBaseBranch(branchName) {
      if (branchName) {
        logger.debug(`Setting baseBranch to ${branchName}`);
        config.baseBranch = branchName;
        branchFiles = {};
        await getFileList(branchName);
      }
    }
  }
}

module.exports = Storage;
