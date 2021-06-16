import is from '@sindresorhus/is';
import { nameFromLevel } from 'bunyan';
import { getAdminConfig } from '../../config/admin';
import type { RenovateConfig } from '../../config/types';
import { getProblems, logger } from '../../logger';
import { platform } from '../../platform';
import { BranchConfig, BranchResult } from '../types';

interface DependencyDashboard {
  dependencyDashboardChecks: Record<string, string>;
  dependencyDashboardRebaseAllOpen: boolean;
}

function parseDashboardIssue(issueBody: string): DependencyDashboard {
  const checkMatch = ' - \\[x\\] <!-- ([a-zA-Z]+)-branch=([^\\s]+) -->';
  const checked = issueBody.match(new RegExp(checkMatch, 'g'));
  const dependencyDashboardChecks: Record<string, string> = {};
  if (checked?.length) {
    const re = new RegExp(checkMatch);
    checked.forEach((check) => {
      const [, type, branchName] = re.exec(check);
      dependencyDashboardChecks[branchName] = type;
    });
  }
  const checkedRebaseAll = issueBody.includes(
    ' - [x] <!-- rebase-all-open-prs -->'
  );
  let dependencyDashboardRebaseAllOpen = false;
  if (checkedRebaseAll) {
    dependencyDashboardRebaseAllOpen = true;
    /* eslint-enable no-param-reassign */
  }
  return { dependencyDashboardChecks, dependencyDashboardRebaseAllOpen };
}

export async function readDashboardBody(config: RenovateConfig): Promise<void> {
  /* eslint-disable no-param-reassign */
  config.dependencyDashboardChecks = {};
  const stringifiedConfig = JSON.stringify(config);
  if (
    config.dependencyDashboard ||
    stringifiedConfig.includes('"dependencyDashboardApproval":true') ||
    stringifiedConfig.includes('"prCreation":"approval"')
  ) {
    config.dependencyDashboardTitle =
      config.dependencyDashboardTitle || `Dependency Dashboard`;
    const issue = await platform.findIssue(config.dependencyDashboardTitle);
    if (issue) {
      config.dependencyDashboardIssue = issue.number;
      Object.assign(config, parseDashboardIssue(issue.body));
    }
  }
  /* eslint-enable no-param-reassign */
}

function getListItem(branch: BranchConfig, type: string): string {
  let item = ' - [ ] ';
  item += `<!-- ${type}-branch=${branch.branchName} -->`;
  if (branch.prNo) {
    item += `[${branch.prTitle}](../pull/${branch.prNo})`;
  } else {
    item += branch.prTitle;
  }
  const uniquePackages = [
    ...new Set(branch.upgrades.map((upgrade) => '`' + upgrade.depName + '`')),
  ];
  if (uniquePackages.length < 2) {
    return item + '\n';
  }
  return item + ' (' + uniquePackages.join(', ') + ')\n';
}

function appendRepoProblems(config: RenovateConfig, issueBody: string): string {
  let newIssueBody = issueBody;
  const repoProblems = new Set(
    getProblems()
      .filter(
        (problem) =>
          problem.repository === config.repository && !problem.artifactErrors
      )
      .map(
        (problem) =>
          `${nameFromLevel[problem.level].toUpperCase()}: ${problem.msg}`
      )
  );
  if (repoProblems.size) {
    newIssueBody += '## Repository problems\n\n';
    newIssueBody +=
      'These problems occurred while renovating this repository.\n\n';
    for (const repoProblem of repoProblems) {
      newIssueBody += ` - ${repoProblem}\n`;
    }
    newIssueBody += '\n';
  }
  return newIssueBody;
}

export async function ensureDependencyDashboard(
  config: RenovateConfig,
  branches: BranchConfig[]
): Promise<void> {
  // legacy/migrated issue
  const reuseTitle = 'Update Dependencies (Renovate Bot)';
  if (
    !(
      config.dependencyDashboard ||
      config.dependencyDashboardApproval ||
      config.packageRules?.some((rule) => rule.dependencyDashboardApproval) ||
      branches.some(
        (branch) =>
          branch.dependencyDashboardApproval ||
          branch.dependencyDashboardPrApproval
      )
    )
  ) {
    return;
  }
  // istanbul ignore if
  if (config.repoIsOnboarded === false) {
    logger.debug('Repo is onboarding - skipping dependency dashboard');
    return;
  }
  logger.debug('Ensuring Dependency Dashboard');
  const hasBranches =
    is.nonEmptyArray(branches) &&
    branches.some((branch) => branch.result !== BranchResult.Automerged);
  if (config.dependencyDashboardAutoclose && !hasBranches) {
    if (getAdminConfig().dryRun) {
      logger.info(
        'DRY-RUN: Would close Dependency Dashboard ' +
          config.dependencyDashboardTitle
      );
    } else {
      logger.debug('Closing Dependency Dashboard');
      await platform.ensureIssueClosing(config.dependencyDashboardTitle);
    }
    return;
  }
  let issueBody = '';
  if (config.dependencyDashboardHeader?.length) {
    issueBody += `${config.dependencyDashboardHeader}\n\n`;
  }

  issueBody = appendRepoProblems(config, issueBody);

  const pendingApprovals = branches.filter(
    (branch) => branch.result === BranchResult.NeedsApproval
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
    (branch) => branch.result === BranchResult.NotScheduled
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
    (branch) =>
      branch.result === BranchResult.BranchLimitReached ||
      branch.result === BranchResult.PrLimitReached ||
      branch.result === BranchResult.CommitLimitReached
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
    (branch) => branch.result === BranchResult.Error
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
    (branch) => branch.result === BranchResult.NeedsPrApproval
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
  const prEdited = branches.filter(
    (branch) => branch.result === BranchResult.PrEdited
  );
  if (prEdited.length) {
    issueBody += '## Edited/Blocked\n\n';
    issueBody += `These updates have been manually edited so Renovate will no longer make changes. To discard all commits and start over, check the box below.\n\n`;
    for (const branch of prEdited) {
      issueBody += getListItem(branch, 'rebase');
    }
    issueBody += '\n';
  }
  const prPending = branches.filter(
    (branch) => branch.result === BranchResult.Pending
  );
  if (prPending.length) {
    issueBody += '## Pending Status Checks\n\n';
    issueBody += `These updates await pending status checks. To force their creation now, check the box below.\n\n`;
    for (const branch of prPending) {
      issueBody += getListItem(branch, 'approvePr');
    }
    issueBody += '\n';
  }
  const prPendingBranchAutomerge = branches.filter(
    (branch) => branch.prBlockedBy === 'BranchAutomerge'
  );
  if (prPendingBranchAutomerge.length) {
    issueBody += '## Pending Branch Automerge\n\n';
    issueBody += `These updates await pending status checks before automerging.\n\n`;
    for (const branch of prPendingBranchAutomerge) {
      issueBody += getListItem(branch, 'approvePr');
    }
    issueBody += '\n';
  }
  const otherRes = [
    BranchResult.Pending,
    BranchResult.NeedsApproval,
    BranchResult.NeedsPrApproval,
    BranchResult.NotScheduled,
    BranchResult.PrLimitReached,
    BranchResult.CommitLimitReached,
    BranchResult.BranchLimitReached,
    BranchResult.AlreadyExisted,
    BranchResult.Error,
    BranchResult.Automerged,
    BranchResult.PrEdited,
  ];
  let inProgress = branches.filter(
    (branch) =>
      !otherRes.includes(branch.result) &&
      branch.prBlockedBy !== 'BranchAutomerge'
  );
  const otherBranches = inProgress.filter(
    (branch) => branch.prBlockedBy || !branch.prNo
  );
  // istanbul ignore if
  if (otherBranches.length) {
    issueBody += '## Other Branches\n\n';
    issueBody += `These updates are pending. To force PRs open, check the box below.\n\n`;
    for (const branch of otherBranches) {
      logger.info(
        {
          prBlockedBy: branch.prBlockedBy,
          prNo: branch.prNo,
          result: branch.result,
        },
        'Blocked PR'
      );
      issueBody += getListItem(branch, 'other');
    }
    issueBody += '\n';
  }
  inProgress = inProgress.filter(
    (branch) => branch.prNo && !branch.prBlockedBy
  );
  if (inProgress.length) {
    issueBody += '## Open\n\n';
    issueBody +=
      'These updates have all been created already. Click a checkbox below to force a retry/rebase of any.\n\n';
    for (const branch of inProgress) {
      issueBody += getListItem(branch, 'rebase');
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
    (branch) => branch.result === BranchResult.AlreadyExisted
  );
  if (alreadyExisted.length) {
    issueBody += '## Ignored or Blocked\n\n';
    issueBody +=
      'These are blocked by an existing closed PR and will not be recreated unless you click a checkbox below.\n\n';
    for (const branch of alreadyExisted) {
      issueBody += getListItem(branch, 'recreate');
    }
    issueBody += '\n';
  }

  if (!hasBranches) {
    issueBody +=
      'This repository currently has no open or pending branches.\n\n';
  }

  if (config.dependencyDashboardFooter?.length) {
    issueBody += `---\n${config.dependencyDashboardFooter}\n`;
  }

  if (getAdminConfig().dryRun) {
    logger.info(
      'DRY-RUN: Would ensure Dependency Dashboard ' +
        config.dependencyDashboardTitle
    );
  } else {
    await platform.ensureIssue({
      title: config.dependencyDashboardTitle,
      reuseTitle,
      body: issueBody,
    });
  }
}
