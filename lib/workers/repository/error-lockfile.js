const { DateTime } = require('luxon');

module.exports = {
  raiseLockFileIssue,
};

function raiseLockFileIssue(err) {
  logger.debug('raiseLockFileIssue()');
  if (!err.releaseTimestamp) {
    logger.warn('lock file error without release timestamp');
    return;
  }
  let body =
    'Renovate encountered an error when updating a lock file, and this may need your manual intervention to resolve. ';
  body +=
    "It's possible that this lock file problem could prevent most or all PRs from being created. ";
  body +=
    'Renovate will close this issue automatically if it no longer experiences any lock file updating errors (such as if this was a temporary error).\n\n';
  body +=
    'The most common cause for failed lock file updating is the use of private npm modules or a private npm server while Renovate has been given no credentials to download them. ';
  body +=
    "If this is the case, then please check out Renovate's [private module support documentation](https://renovatebot.com/docs/private-modules/).\n\n\n";
  body +=
    'If you just want this error to go away, the simplest options are either:\n';
  body += ' - Delete any lockfiles you do not care about, or \n';
  body +=
    ' - Add setting `updateLockFiles=false` to your renovate config and Renovate will skip lock files in PRs. This is not recommended in most circumstances because then your lock file is invalidated.\n\n';
  body += `File name: \`${err.fileName}\`\n\n`;
  body += `Details:\n\n`;
  body += '```\n';
  const details = (err.details || '')
    .replace(/npm ERR! A complete log of this run can be found in.*\n.*/g, '')
    .replace(/\n+$/, '');
  body += `${details}\n`;
  body += '```\n';
  const releaseTimestamp = DateTime.fromISO(err.releaseTimestamp);
  if (releaseTimestamp.plus({ days: 1 }) < DateTime.local()) {
    /*
    const res = await platform.ensureIssue(
      'Action Required: Fix Renovate Configuration',
      body
    );
    logger.info('Lock file warning issue: ' + res);
    */
    logger.warn(
      { body },
      'Failed lockfile generation for release over one day old'
    );
  }
}
