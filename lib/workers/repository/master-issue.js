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
async function ensureOrCloseMasterIssue(config) {
  if (config.masterIssueAutoclose) {
    logger.debug('Closing master issue');
    await platform.ensureIssueClosing(config.masterIssueTitle);
    return;
  }
  await platform.ensureIssue(
    config.masterIssueTitle,
    'This repository is up-to-date and has no outstanding updates open or pending.'
  );
}

// istanbul ignore next
function addPendingApprovalsToIssueBody(issueBody, branches) {
  let pendingApprovalsBody = '';
  const pendingApprovals = branches.filter(
    branch => branch.res === 'needs-approval'
  );
  if (pendingApprovals.length) {
    pendingApprovalsBody += '## Pending Approval\n\n';
    pendingApprovalsBody += `These PRs will be created by ${appName} only once you click their checkbox below.\n\n`;
    for (const branch of pendingApprovals) {
      pendingApprovalsBody += getListItem(branch, 'approve');
    }
    pendingApprovalsBody += '\n';
  }
  return issueBody + pendingApprovalsBody;
}

// istanbul ignore next
function addAwaitingScheduleToIssueBody(issueBody, branches) {
  let awaitingScheduleBody = '';
  const awaitingSchedule = branches.filter(
    branch => branch.res === 'not-scheduled'
  );
  if (awaitingSchedule.length) {
    awaitingScheduleBody += '## Awaiting Schedule\n\n';
    awaitingScheduleBody +=
      'These updates are awaiting their schedule. Click on a checkbox to ignore the schedule.\n';
    for (const branch of awaitingSchedule) {
      awaitingScheduleBody += getListItem(branch, 'unschedule');
    }
    awaitingScheduleBody += '\n';
  }
  return issueBody + awaitingScheduleBody;
}

// istanbul ignore next
function addRateLimitedToIssueBody(issueBody, branches) {
  let rateLimitedBody = '';
  const rateLimited = branches.filter(
    branch => branch.res && branch.res.endsWith('pr-hourly-limit-reached')
  );
  if (rateLimited.length) {
    rateLimitedBody += '## Rate Limited\n\n';
    rateLimitedBody +=
      'These updates are currently rate limited. Click on a checkbox below to override.\n\n';
    for (const branch of rateLimited) {
      rateLimitedBody += getListItem(branch, 'unlimit');
    }
    rateLimitedBody += '\n';
  }
  return issueBody + rateLimitedBody;
}

// istanbul ignore next
function addErrorListToIssueBody(issueBody, branches) {
  let errorListBody = '';
  const errorList = branches.filter(
    branch => branch.res && branch.res.endsWith('error')
  );
  if (errorList.length) {
    errorListBody += '## Errored\n\n';
    errorListBody +=
      'These updates encountered an error and will be retried. Click a checkbox below to force a retry now.\n\n';
    for (const branch of errorList) {
      errorListBody += getListItem(branch, 'retry');
    }
    errorListBody += '\n';
  }
  return issueBody + errorListBody;
}

// istanbul ignore next
async function addPREditedToIssueBody(issueBody, branches) {
  let prEditedBody = '';
  const prEdited = branches.filter(branch => branch.res === 'pr-edited');
  if (prEdited.length) {
    prEditedBody += '## Edited/Blocked\n\n';
    prEditedBody += `These updates have been manually edited so ${appName} will no longer make changes. To discard all commits and start over, check the box below.\n\n`;
    for (const branch of prEdited) {
      const pr = await platform.getBranchPr(branch.branchName);
      prEditedBody += getListItem(branch, 'rebase', pr);
    }
    prEditedBody += '\n';
  }
  return issueBody + prEditedBody;
}

// istanbul ignore next
async function addInProgressToIssueBody(issueBody, branches) {
  let inProgressBody = '';
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
    inProgressBody += '## Open\n\n';
    inProgressBody +=
      'These updates have all been created already. Click a checkbox below to force a retry/rebase of any.\n\n';
    for (const branch of inProgress) {
      const pr = await platform.getBranchPr(branch.branchName);
      inProgressBody += getListItem(branch, 'rebase', pr);
    }
    inProgressBody += '\n';
  }
  return issueBody + inProgressBody;
}

// istanbul ignore next
async function addAlreadyExistedToIssueBody(issueBody, branches) {
  let alreadyExistedBody = '';
  const alreadyExisted = branches.filter(
    branch => branch.res && branch.res.endsWith('already-existed')
  );
  if (alreadyExisted.length) {
    alreadyExistedBody += '## Closed/Ignored\n\n';
    alreadyExistedBody +=
      'These updates were closed unmerged and will not be recreated unless you click a checkbox below.\n\n';
    for (const branch of alreadyExisted) {
      const pr = await platform.findPr(
        branch.branchName,
        branch.prTitle,
        '!open'
      );
      alreadyExistedBody += getListItem(branch, 'recreate', pr);
    }
    alreadyExistedBody += '\n';
  }
  return issueBody + alreadyExistedBody;
}

// istanbul ignore next
async function createIssueBody(branches) {
  let issueBody = `This issue contains a list of ${appName} updates and their statuses.\n\n`;

  issueBody = addPendingApprovalsToIssueBody(issueBody, branches);
  issueBody = addAwaitingScheduleToIssueBody(issueBody, branches);
  issueBody = addRateLimitedToIssueBody(issueBody, branches);
  issueBody = addErrorListToIssueBody(issueBody, branches);
  issueBody = await addPREditedToIssueBody(issueBody, branches);
  issueBody = await addInProgressToIssueBody(issueBody, branches);
  issueBody = await addAlreadyExistedToIssueBody(issueBody, branches);
  return issueBody;
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
    await ensureOrCloseMasterIssue(config);
    return;
  }
  const issueBody = await createIssueBody(branches);
  await platform.ensureIssue(config.masterIssueTitle, issueBody);
}
