module.exports = {
  processResult,
};

function processResult(config, result) {
  let res = result;
  const disabledStatuses = [
    'archived',
    'blocked',
    'disabled',
    'forbidden',
    'fork',
    'no-package-files',
    'not-found',
    'renamed',
    'uninitiated',
  ];
  const errorStatuses = [
    'config-validation',
    'error',
    'unknown-error',
    'not-found',
  ];
  let status;
  // istanbul ignore next
  if (disabledStatuses.includes(res)) {
    status = 'disabled';
  } else if (errorStatuses.includes(res)) {
    status = 'error';
  } else if (config.repoIsOnboarded) {
    status = 'enabled';
  } else {
    status = 'onboarding';
    res = 'done';
  }
  return { res, status };
}
