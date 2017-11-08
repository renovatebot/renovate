const github = require('./github');
const gitlab = require('./gitlab');
const vsts = require('./vsts');

function initPlatform(val) {
  if (val === 'github') {
    global.platform = github;
  } else if (val === 'gitlab') {
    global.platform = gitlab;
  } else if (val === 'vsts') {
    global.platform = vsts;
  }
}

module.exports = {
  initPlatform,
};
