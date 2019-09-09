const { validatePrs } = require('./validate');
const { pruneStaleBranches } = require('./prune');
const { appName } = require('../../../config/app-strings');

module.exports = {
  finaliseRepo,
};

// istanbul ignore next
async function finaliseRepo(config, branchList) {
  // TODO: Promise.all
  await validatePrs(config);
  await pruneStaleBranches(config, branchList);
  await platform.ensureIssueClosing(
    `Action Required: Fix ${appName} Configuration`
  );
}
