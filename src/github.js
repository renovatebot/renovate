const ghGot = require('gh-got');

var config = {};

module.exports = {
  // Initialize GitHub by getting base branch SHA
  init: function(token, repoName, baseBranch, verbose = false) {
    config.token = token;
    config.repoName = repoName;
    config.baseBranch = baseBranch;
    config.verbose = verbose;

    config.userName = repoName.split('/')[0];

    return ghGot(`repos/${config.repoName}/git/refs/head`, {token: config.token}).then(res => {
      // First, get the SHA for base branch
      res.body.forEach(function(branch) {
        // Loop through all branches because the base branch may not be the first
        if (branch.ref === `refs/heads/${config.baseBranch}`) {
          // This is the SHA we will create new branches from
          config.baseSHA = branch.object.sha;
        }
      });
    }).catch(function(err) {
      console.log('init error: ' + err);
    });
  },
  createBranch: function(branchName) {
    return ghGot.post(`repos/${config.repoName}/git/refs`, {
      token: config.token,
      body: {
        ref: `refs/heads/${branchName}`,
        sha: config.baseSHA,
      },
    });
  },
  createPr: function(branchName, title, body) {
    return ghGot.post(`repos/${config.repoName}/pulls`, {
      token: config.token,
      body: {
        title: title,
        head: branchName,
        base: config.baseBranch,
        body: body,
      }
    });
  },
  checkPrExists(branchName, prTitle) {
    if (config.verbose) {
      console.log(`Checking if branch/PR exists: ${branchName} / ${prTitle}`);
    }
    return ghGot(`repos/${config.repoName}/pulls?state=closed&head=${config.userName}:${branchName}`, { token: config.token })
      .then(res => {
        if (config.verbose) {
          console.log(`Got ${res.body.length} results for ${branchName}`);
        }
        let prAlreadyExists = false;
        res.body.forEach(function(result) {
          if (result.title === prTitle && result.head.label === `${config.userName}:${branchName}`) {
            prAlreadyExists = true;
          }
        });
        if (config.verbose) {
          if (prAlreadyExists) {
            console.log(`PR already exists for ${branchName}`);
          } else {
            console.log(`PR doesn't exist for ${branchName}`);
          }
        }
        return prAlreadyExists;
      }).catch((err) => {
        console.error('Error checking if PR already existed');
      });
  },
  getFile: function(filePath, branchName) {
    branchName = branchName || config.baseBranch;
    return ghGot(`repos/${config.repoName}/contents/${filePath}?ref=${branchName}`, {
      token: config.token,
    });
  },
  getFileContents: function(filePath, branchName) {
    return this.getFile(filePath, branchName).then(res => {
      return JSON.parse(new Buffer(res.body.content, 'base64').toString());
    });
  },
  getPrNo: function(branchName) {
    return ghGot(`repos/${config.repoName}/pulls?base=${config.baseBranch}&head=${config.userName}:${branchName}`, {
      token: config.token,
    }).then(res => {
      let prNo = 0;
      res.body.forEach(function(result) {
        if (result.state === 'open' && result.head.label === `${config.userName}:${branchName}`) {
          prNo = result.number;
        }
      });
      return prNo;
    });
  },
  writeFile: function(branchName, oldFileSHA, filePath, fileContents, message) {
    return ghGot.put(`repos/${config.repoName}/contents/${filePath}`, {
      token: config.token,
      body: {
        branch: branchName,
        sha: oldFileSHA,
        message: message,
        content: new Buffer(fileContents).toString('base64')
      }
    });
  },
  updatePr: function(prNo, title, body) {
    return ghGot.patch(`repos/${config.repoName}/pulls/${prNo}`, {
      token: config.token,
      body: {
        title: title,
        body: body,
      },
    });
  },
};
