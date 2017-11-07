const github = require('./github');
const gitlab = require('./gitlab');

function initPlatform(val) {
  if (val === 'github') {
    global.platform = github;
  } else if (val === 'gitlab') {
    global.platform = gitlab;
  }
}

module.exports = {
  initPlatform,
};
