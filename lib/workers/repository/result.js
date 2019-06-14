module.exports = {
  processResult,
};

function processResult(config, res) {
  const disabledStatuses = [
    'archived',
    'blocked',
    'cannot-fork',
    'disabled',
    'forbidden',
    'fork',
    'mirror',
    'no-package-files',
    'renamed',
    'uninitiated',
    'empty',
  ];
  let status;
  // istanbul ignore next
  if (disabledStatuses.includes(res)) {
    status = 'disabled';
  } else if (config.repoIsOnboarded) {
    status = 'enabled';
  } else if (config.repoIsOnboarded === false) {
    status = 'onboarding';
  } else {
    status = 'unknown';
  }
  return { res, status };
}
