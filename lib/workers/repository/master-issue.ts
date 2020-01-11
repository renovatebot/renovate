import { logger } from '../../logger';
import { platform, Pr } from '../../platform';
import { BranchConfig } from '../common';
import { RenovateConfig } from '../../config';

function getListItem(branch: BranchConfig, type: string, pr?: Pr): string {
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

export async function ensureMasterIssue(
  config: RenovateConfig,
  branches: BranchConfig[]
): Promise<void> {
  if (
    !(
      config.masterIssue ||
      branches.some(
        branch => branch.masterIssueApproval || branch.masterIssuePrApproval
      )
    )
  ) {
    return;
  }
  logger.info('Ensuring master issue');
  if (
    !branches.length ||
    branches.every(branch => branch.res === 'automerged')
  ) {
    if (config.masterIssueAutoclose) {
      logger.debug('Closing master issue');
      if (config.dryRun) {
        logger.info(
          'DRY-RUN: Would close Master Issue ' + config.masterIssueTitle
        );
      } else {
        await platform.ensureIssueClosing(config.masterIssueTitle);
      }
      return;
    }
    if (config.dryRun) {
      logger.info(
        'DRY-RUN: Would ensure Master Issue ' + config.masterIssueTitle
      );
    } else {
      await platform.ensureIssue({
        title: config.masterIssueTitle,
        body:
          'This repository is up-to-date and has no outstanding updates open or pending.',
      });
    }
    return;
  }
  let issueBody = `This [master issue](https://renovatebot.com/blog/master-issue) contains a list of Renovate updates and their statuses.\n\n`;
  const pendingApprovals = branches.filter(
    branch => branch.res === 'needs-approval'
  );
  if (pendingApprovals.length) {
    issueBody += '## Pending Approval\n\n';
    issueBody += `These branches will be created by Renovate only once you click their checkbox below.\n\n`;
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
      'These updates are currently rate limited. Click on a checkbox below to force their creation now.\n\n';
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
  const awaitingPr = branches.filter(
    branch => branch.res === 'needs-pr-approval'
  );
  if (awaitingPr.length) {
    issueBody += '## PR Creation Approval Required\n\n';
    issueBody +=
      "These branches exist but PRs won't be created until you approve by ticking the checkbox.\n\n";
    for (const branch of awaitingPr) {
      issueBody += getListItem(branch, 'approvePr');
    }
    issueBody += '\n';
  }
  const prEdited = branches.filter(branch => branch.res === 'pr-edited');
  if (prEdited.length) {
    issueBody += '## Edited/Blocked\n\n';
    issueBody += `These updates have been manually edited so Renovate will no longer make changes. To discard all commits and start over, check the box below.\n\n`;
    for (const branch of prEdited) {
      const pr = await platform.getBranchPr(branch.branchName);
      issueBody += getListItem(branch, 'rebase', pr);
    }
    issueBody += '\n';
  }
  const prPending = branches.filter(branch => branch.res === 'pending');
  if (prPending.length) {
    issueBody += '## Pending Status Checks\n\n';
    issueBody += `These updates await pending status checks. To force their creation now, check the box below.\n\n`;
    for (const branch of prPending) {
      issueBody += getListItem(branch, 'approvePr');
    }
    issueBody += '\n';
  }
  const otherRes = [
    'pending',
    'needs-approval',
    'needs-pr-approval',
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
    if (inProgress.length > 2) {
      issueBody += ' - [ ] ';
      issueBody += '<!-- rebase-all-open-prs -->';
      issueBody +=
        '**Check this option to rebase all the above open PRs at once**';
      issueBody += '\n';
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

  // istanbul ignore if
  if (global.appMode) {
    issueBody +=
      '---\n<details><summary>Advanced</summary>\n\n- [ ] <!-- manual job -->Check this box to trigger a request for Renovate to run again on this repository\n\n</details>\n';
  }

  if (config.dryRun) {
    logger.info(
      'DRY-RUN: Would ensure Master Issue ' + config.masterIssueTitle
    );
  } else {
    await platform.ensureIssue({
      title: config.masterIssueTitle,
      body: issueBody,
    });
  }
}
