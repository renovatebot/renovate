const github = require('./github');
const gitlab = require('./gitlab');

// istanbul ignore next
function platform() {}

platform.init = function init(val) {
  if (val === 'github') {
    Object.keys(github).forEach(f => {
      platform[f] = github[f];
    });
  } else if (val === 'gitlab') {
    Object.keys(gitlab).forEach(f => {
      platform[f] = gitlab[f];
    });
  }
};

module.exports = platform;
