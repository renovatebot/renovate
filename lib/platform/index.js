const github = require('./github');
const gitlab = require('./gitlab');
const vsts = require('./vsts');
const bitbucket = require('./bitbucket');

function initPlatform(val) {
  if (val === 'github') {
    global.platform = github;
  } else if (val === 'gitlab') {
    global.platform = gitlab;
  } else if (val === 'vsts') {
    global.platform = vsts;
  } else if (val === 'bitbucket') {
    global.platform = bitbucket;
  }
}

module.exports = {
  initPlatform,
};
