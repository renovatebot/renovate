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
    'no-package-files',
    'not-found',
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
