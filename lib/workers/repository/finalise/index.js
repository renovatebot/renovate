const { validatePrs } = require('./validate');
const { pruneStaleBranches } = require('./prune');

module.exports = {
  finaliseRepo,
};

async function finaliseRepo(config, branchList) {
  // TODO: Promise.all
  await validatePrs(config);
  await pruneStaleBranches(config, branchList);
  platform.cleanRepo();
}
