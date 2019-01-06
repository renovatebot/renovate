const { appName } = require('../../config/app-strings');

module.exports = {
  ensureMasterIssue,
};

// istanbul ignore next
function getListItem(branch, type, pr) {
  let item = ' - [ ] ';
  item += `<!-- ${type}-branch=${branch.branchName} -->`;
  if (pr) {
    item += `[${branch.prTitle}](../pull/${pr.number})`;
  } else {
    item += branch.prTitle;
  }
  const uniquePackages = [
    ...new Set(branch.upgrades.map(upgrade => '`' + upgrade.depName + '`')),
  ];
  if (uniquePackages.length < 2) {
    return item + '\n';
  }
  return item + ' (' + uniquePackages.join(', ') + ')\n';
}

// istanbul ignore next
async function ensureMasterIssue(config, branches) {
  if (!(config.masterIssue || config.masterIssueApproval)) {
    return;
  }
  logger.info('Ensuring master issue');
  if (
    !branches.length ||
    branches.every(branch => branch.res === 'automerged')
  ) {
    if (config.masterIssueAutoclose) {
      logger.debug('Closing master issue');
      await platform.ensureIssueClosing(config.masterIssueTitle);
      return;
    }
    await platform.ensureIssue(
      config.masterIssueTitle,
      'This repository is up-to-date and has no outstanding updates open or pending.'
    );
    return;
  }
  let issueBody = `This issue contains a list of ${appName} updates and their statuses.\n\n`;
  const pendingApprovals = branches.filter(
    branch => branch.res === 'needs-approval'
  );
  if (pendingApprovals.length) {
    issueBody += '## Pending Approval\n\n';
    issueBody += `These PRs will be created by ${appName} only once you click their checkbox below.\n\n`;
    for (const branch of pendingApprovals) {
      issueBody += getListItem(branch, 'approve');
    }
    issueBody += '\n';
  }
  const awaitingSchedule = branches.filter(
    branch => branch.res === 'not-scheduled'
  );
  if (awaitingSchedule.length) {
    issueBody += '## Awaiting Schedule\n\n';
    issueBody +=
      'These updates are awaiting their schedule. Click on a checkbox to ignore the schedule.\n';
    for (const branch of awaitingSchedule) {
      issueBody += getListItem(branch, 'unschedule');
    }
    issueBody += '\n';
  }
  const rateLimited = branches.filter(
    branch => branch.res && branch.res.endsWith('pr-hourly-limit-reached')
  );
  if (rateLimited.length) {
    issueBody += '## Rate Limited\n\n';
    issueBody +=
      'These updates are currently rate limited. Click on a checkbox below to override.\n\n';
    for (const branch of rateLimited) {
      issueBody += getListItem(branch, 'unlimit');
    }
    issueBody += '\n';
  }
  const errorList = branches.filter(
    branch => branch.res && branch.res.endsWith('error')
  );
  if (errorList.length) {
    issueBody += '## Errored\n\n';
    issueBody +=
      'These updates encountered an error and will be retried. Click a checkbox below to force a retry now.\n\n';
    for (const branch of errorList) {
      issueBody += getListItem(branch, 'retry');
    }
    issueBody += '\n';
  }
  const prEdited = branches.filter(branch => branch.res === 'pr-edited');
  if (prEdited.length) {
    issueBody += '## Edited/Blocked\n\n';
    issueBody += `These updates have been manually edited so ${appName} will no longer make changes. To discard all commits and start over, check the box below.\n\n`;
    for (const branch of prEdited) {
      issueBody += getListItem(branch, 'reset');
    }
    issueBody += '\n';
  }
  const otherRes = [
    'needs-approval',
    'not-scheduled',
    'pr-hourly-limit-reached',
    'already-existed',
    'error',
    'automerged',
    'pr-edited',
  ];
  const inProgress = branches.filter(branch => !otherRes.includes(branch.res));
  if (inProgress.length) {
    issueBody += '## Open\n\n';
    issueBody +=
      'These updates have all been created already. Click a checkbox below to force a retry/rebase of any.\n\n';
    for (const branch of inProgress) {
      const pr = await platform.getBranchPr(branch.branchName);
      issueBody += getListItem(branch, 'rebase', pr);
    }
    issueBody += '\n';
  }
  const alreadyExisted = branches.filter(
    branch => branch.res && branch.res.endsWith('already-existed')
  );
  if (alreadyExisted.length) {
    issueBody += '## Closed/Ignored\n\n';
    issueBody +=
      'These updates were closed unmerged and will not be recreated unless you click a checkbox below.\n\n';
    for (const branch of alreadyExisted) {
      const pr = await platform.findPr(
        branch.branchName,
        branch.prTitle,
        '!open'
      );
      issueBody += getListItem(branch, 'recreate', pr);
    }
    issueBody += '\n';
  }
  await platform.ensureIssue(config.masterIssueTitle, issueBody);
}
