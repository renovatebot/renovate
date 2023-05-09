import is from '@sindresorhus/is';
import { nameFromLevel } from 'bunyan';
import { GlobalConfig } from '../../config/global';
import type { RenovateConfig } from '../../config/types';
import { getProblems, logger } from '../../logger';
import type { PackageFile } from '../../modules/manager/types';
import { platform } from '../../modules/platform';
import { GitHubMaxPrBodyLen } from '../../modules/platform/github';
import { regEx } from '../../util/regex';
import * as template from '../../util/template';
import type {
  BranchConfig,
  Dashboard,
  DashboardBody,
  SelectAllConfig,
} from '../types';
import { getDepWarningsDashboard } from './errors-warnings';
import { PackageFiles } from './package-files';

interface DependencyDashboard {
  dependencyDashboardChecks: Record<string, string>;
  dependencyDashboardRebaseAllOpen: boolean;
  dependencyDashboardAllPending: boolean;
  dependencyDashboardAllRateLimited: boolean;
}

const rateLimitedRe = regEx(
  ' - \\[ \\] <!-- unlimit-branch=([^\\s]+) -->',
  'g'
);
const pendingApprovalRe = regEx(
  ' - \\[ \\] <!-- approve-branch=([^\\s]+) -->',
  'g'
);
const generalBranchRe = regEx(' <!-- ([a-zA-Z]+)-branch=([^\\s]+) -->');
const markedBranchesRe = regEx(
  ' - \\[x\\] <!-- ([a-zA-Z]+)-branch=([^\\s]+) -->',
  'g'
);

function checkOpenAllRateLimitedPR(issueBody: string): boolean {
  return issueBody.includes(' - [x] <!-- create-all-rate-limited-prs -->');
}

function checkApproveAllPendingPR(issueBody: string): boolean {
  return issueBody.includes(' - [x] <!-- approve-all-pending-prs -->');
}

function checkRebaseAll(issueBody: string): boolean {
  return issueBody.includes(' - [x] <!-- rebase-all-open-prs -->');
}

function selectAllRelevantBranches(issueBody: string): string[] {
  const checkedBranches = [];
  if (checkOpenAllRateLimitedPR(issueBody)) {
    for (const match of issueBody.matchAll(rateLimitedRe)) {
      checkedBranches.push(match[0]);
    }
  }
  if (checkApproveAllPendingPR(issueBody)) {
    for (const match of issueBody.matchAll(pendingApprovalRe)) {
      checkedBranches.push(match[0]);
    }
  }
  return checkedBranches;
}

function getAllSelectedBranches(
  issueBody: string,
  dependencyDashboardChecks: Record<string, string>
): Record<string, string> {
  const allRelevantBranches = selectAllRelevantBranches(issueBody);
  for (const branch of allRelevantBranches) {
    const [, type, branchName] = generalBranchRe.exec(branch)!;
    dependencyDashboardChecks[branchName] = type;
  }
  return dependencyDashboardChecks;
}

function getCheckedBranches(issueBody: string): Record<string, string> {
  let dependencyDashboardChecks: Record<string, string> = {};
  for (const [, type, branchName] of issueBody.matchAll(markedBranchesRe)) {
    dependencyDashboardChecks[branchName] = type;
  }
  dependencyDashboardChecks = getAllSelectedBranches(
    issueBody,
    dependencyDashboardChecks
  );
  return dependencyDashboardChecks;
}

function parseDashboardIssue(issueBody: string): DependencyDashboard {
  const dependencyDashboardChecks = getCheckedBranches(issueBody);
  const dependencyDashboardRebaseAllOpen = checkRebaseAll(issueBody);
  const dependencyDashboardAllPending = checkApproveAllPendingPR(issueBody);
  const dependencyDashboardAllRateLimited =
    checkOpenAllRateLimitedPR(issueBody);
  return {
    dependencyDashboardChecks,
    dependencyDashboardRebaseAllOpen,
    dependencyDashboardAllPending,
    dependencyDashboardAllRateLimited,
  };
}

export async function readDashboardBody(
  config: SelectAllConfig
): Promise<void> {
  config.dependencyDashboardChecks = {};
  const stringifiedConfig = JSON.stringify(config);
  if (
    config.dependencyDashboard ||
    stringifiedConfig.includes('"dependencyDashboardApproval":true') ||
    stringifiedConfig.includes('"prCreation":"approval"')
  ) {
    config.dependencyDashboardTitle =
      config.dependencyDashboardTitle ?? `Dependency Dashboard`;
    const issue = await platform.findIssue(config.dependencyDashboardTitle);
    if (issue) {
      config.dependencyDashboardIssue = issue.number;
      const dashboardChecks = parseDashboardIssue(issue.body!);

      if (config.checkedBranches) {
        const checkedBranchesRec: Record<string, string> = Object.fromEntries(
          config.checkedBranches.map((branchName) => [
            branchName,
            'global-config',
          ])
        );
        dashboardChecks.dependencyDashboardChecks = {
          ...dashboardChecks.dependencyDashboardChecks,
          ...checkedBranchesRec,
        };
      }

      Object.assign(config, dashboardChecks);
    }
  }
}

function getListItem(branch: Partial<BranchConfig>, type: string): string {
  let item = ' - [ ] ';
  item += `<!-- ${type}-branch=${branch.branchName!} -->`;
  if (branch.prNo) {
    // TODO: types (#7154)
    item += `[${branch.prTitle!}](../pull/${branch.prNo})`;
  } else {
    item += branch.prTitle;
  }
  const uniquePackages = [
    // TODO: types (#7154)
    ...new Set(branch.upgrades!.map((upgrade) => `\`${upgrade.depName!}\``)),
  ];
  if (uniquePackages.length < 2) {
    return item + '\n';
  }
  return item + ' (' + uniquePackages.join(', ') + ')\n';
}

function extractRepoProblems(config: RenovateConfig): Set<string> {
  return new Set(
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
}

export function createDashboardBody(
  header: string | undefined,
  repoProblems: Set<string>,
  branches: Partial<BranchConfig>[],
  packageFiles: Record<string, Partial<PackageFile>[]>
): DashboardBody {
  let issueBody = '';

  const dashboard: Dashboard = {
    awaitingSchedule: [],
    prCreationApprovalRequired: [],
    editedOrBlocked: [],
    errored: [],
    ignoredOrBlocked: [],
    open: [],
    otherBranches: [],
    pendingApprovals: [],
    pendingAutomerge: [],
    pendingStatusChecks: [],
    rateLimited: [],
    repositoryProblems: new Set<string>(),
    header: '',
  };

  if (header) {
    issueBody += header + '\n\n';
  }

  if (repoProblems.size) {
    issueBody += '## Repository problems\n\n';
    issueBody +=
      'These problems occurred while renovating this repository.\n\n';
    for (const repoProblem of repoProblems) {
      issueBody += ` - ${repoProblem}\n`;
    }
    issueBody += '\n';
    dashboard.repositoryProblems = repoProblems;
  }

  const pendingApprovals = branches.filter(
    (branch) => branch.result === 'needs-approval'
  );

  if (pendingApprovals.length) {
    issueBody += '## Pending Approval\n\n';
    issueBody += `These branches will be created by Renovate only once you click their checkbox below.\n\n`;
    for (const branch of pendingApprovals) {
      issueBody += getListItem(branch, 'approve');
      dashboard.pendingApprovals.push(branch);
    }
    if (pendingApprovals.length > 1) {
      issueBody += ' - [ ] ';
      issueBody += '<!-- approve-all-pending-prs -->';
      issueBody += '🔐 **Create all pending approval PRs at once** 🔐\n';
    }
    issueBody += '\n';
  }

  const awaitingSchedule = branches.filter(
    (branch) => branch.result === 'not-scheduled'
  );
  if (awaitingSchedule.length) {
    issueBody += '## Awaiting Schedule\n\n';
    issueBody +=
      'These updates are awaiting their schedule. Click on a checkbox to get an update now.\n\n';
    for (const branch of awaitingSchedule) {
      issueBody += getListItem(branch, 'unschedule');
      dashboard.awaitingSchedule.push(branch);
    }
    issueBody += '\n';
  }

  const rateLimited = branches.filter(
    (branch) =>
      branch.result === 'branch-limit-reached' ||
      branch.result === 'pr-limit-reached' ||
      branch.result === 'commit-limit-reached'
  );
  if (rateLimited.length) {
    issueBody += '## Rate-Limited\n\n';
    issueBody +=
      'These updates are currently rate-limited. Click on a checkbox below to force their creation now.\n\n';
    for (const branch of rateLimited) {
      issueBody += getListItem(branch, 'unlimit');
      dashboard.rateLimited.push(branch);
    }
    if (rateLimited.length > 1) {
      issueBody += ' - [ ] ';
      issueBody += '<!-- create-all-rate-limited-prs -->';
      issueBody += '🔐 **Create all rate-limited PRs at once** 🔐\n';
    }
    issueBody += '\n';
  }

  const errorList = branches.filter((branch) => branch.result === 'error');
  if (errorList.length) {
    issueBody += '## Errored\n\n';
    issueBody +=
      'These updates encountered an error and will be retried. Click on a checkbox below to force a retry now.\n\n';
    for (const branch of errorList) {
      issueBody += getListItem(branch, 'retry');
      dashboard.errored.push(branch);
    }
    issueBody += '\n';
  }

  const awaitingPr = branches.filter(
    (branch) => branch.result === 'needs-pr-approval'
  );
  if (awaitingPr.length) {
    issueBody += '## PR Creation Approval Required\n\n';
    issueBody +=
      "These branches exist but PRs won't be created until you approve them by clicking on a checkbox.\n\n";
    for (const branch of awaitingPr) {
      issueBody += getListItem(branch, 'approvePr');
      dashboard.prCreationApprovalRequired.push(branch);
    }
    issueBody += '\n';
  }

  const prEdited = branches.filter((branch) => branch.result === 'pr-edited');
  if (prEdited.length) {
    issueBody += '## Edited/Blocked\n\n';
    issueBody += `These updates have been manually edited so Renovate will no longer make changes. To discard all commits and start over, click on a checkbox.\n\n`;
    for (const branch of prEdited) {
      issueBody += getListItem(branch, 'rebase');
      dashboard.editedOrBlocked.push(branch);
    }
    issueBody += '\n';
  }
  const prPending = branches.filter((branch) => branch.result === 'pending');
  if (prPending.length) {
    issueBody += '## Pending Status Checks\n\n';
    issueBody += `These updates await pending status checks. To force their creation now, click the checkbox below.\n\n`;
    for (const branch of prPending) {
      issueBody += getListItem(branch, 'approvePr');
      dashboard.pendingStatusChecks.push(branch);
    }
    issueBody += '\n';
  }
  const prPendingBranchAutomerge = branches.filter(
    (branch) => branch.prBlockedBy === 'BranchAutomerge'
  );
  if (prPendingBranchAutomerge.length) {
    issueBody += '## Pending Branch Automerge\n\n';
    issueBody += `These updates await pending status checks before automerging. Click on a checkbox to abort the branch automerge, and create a PR instead.\n\n`;
    for (const branch of prPendingBranchAutomerge) {
      issueBody += getListItem(branch, 'approvePr');
      dashboard.pendingAutomerge.push(branch);
    }
    issueBody += '\n';
  }

  const warn = getDepWarningsDashboard(packageFiles);
  if (warn) {
    dashboard.warn = warn;
    issueBody += warn;
    issueBody += '\n';
  }

  const otherRes = [
    'pending',
    'needs-approval',
    'needs-pr-approval',
    'not-scheduled',
    'pr-limit-reached',
    'commit-limit-reached',
    'branch-limit-reached',
    'already-existed',
    'error',
    'automerged',
    'pr-edited',
  ];
  let inProgress = branches.filter(
    (branch) =>
      !otherRes.includes(branch.result!) &&
      branch.prBlockedBy !== 'BranchAutomerge'
  );
  const otherBranches = inProgress.filter(
    (branch) => !!branch.prBlockedBy || !branch.prNo
  );
  // istanbul ignore if
  if (otherBranches.length) {
    issueBody += '## Other Branches\n\n';
    issueBody += `These updates are pending. To force PRs open, click the checkbox below.\n\n`;
    for (const branch of otherBranches) {
      issueBody += getListItem(branch, 'other');
      dashboard.otherBranches.push(branch);
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
      dashboard.open.push(branch);
    }
    if (inProgress.length > 2) {
      issueBody += ' - [ ] ';
      issueBody += '<!-- rebase-all-open-prs -->';
      issueBody += '**Click on this checkbox to rebase all open PRs at once**';
      issueBody += '\n';
    }
    issueBody += '\n';
  }
  const alreadyExisted = branches.filter(
    (branch) => branch.result === 'already-existed'
  );
  if (alreadyExisted.length) {
    issueBody += '## Ignored or Blocked\n\n';
    issueBody +=
      'These are blocked by an existing closed PR and will not be recreated unless you click a checkbox below.\n\n';
    for (const branch of alreadyExisted) {
      issueBody += getListItem(branch, 'recreate');
      dashboard.ignoredOrBlocked.push(branch);
    }
    issueBody += '\n';
  }
  return { issueBody, dashboard };
}

export async function ensureDependencyDashboard(
  config: SelectAllConfig,
  allBranches: BranchConfig[],
  packageFiles: Record<string, PackageFile[]> = {}
): Promise<void> {
  // legacy/migrated issue
  const reuseTitle = 'Update Dependencies (Renovate Bot)';
  const branches = allBranches.filter(
    (branch) =>
      branch.result !== 'automerged' &&
      !branch.upgrades?.every((upgrade) => upgrade.remediationNotPossible)
  );
  if (
    !(
      config.dependencyDashboard ||
      config.dependencyDashboardApproval ||
      config.packageRules?.some((rule) => rule.dependencyDashboardApproval) ||
      branches.some(
        (branch) =>
          !!branch.dependencyDashboardApproval ||
          !!branch.dependencyDashboardPrApproval
      )
    )
  ) {
    if (GlobalConfig.get('dryRun')) {
      logger.info(
        { title: config.dependencyDashboardTitle },
        'DRY-RUN: Would close Dependency Dashboard'
      );
    } else {
      logger.debug('Closing Dependency Dashboard');
      await platform.ensureIssueClosing(config.dependencyDashboardTitle!);
    }
    return;
  }
  // istanbul ignore if
  if (config.repoIsOnboarded === false) {
    logger.debug('Repo is onboarding - skipping dependency dashboard');
    return;
  }
  logger.debug('Ensuring Dependency Dashboard');
  const hasBranches = is.nonEmptyArray(branches);
  if (config.dependencyDashboardAutoclose && !hasBranches) {
    if (GlobalConfig.get('dryRun')) {
      logger.info(
        { title: config.dependencyDashboardTitle },
        'DRY-RUN: Would close Dependency Dashboard'
      );
    } else {
      logger.debug('Closing Dependency Dashboard');
      await platform.ensureIssueClosing(config.dependencyDashboardTitle!);
    }
    return;
  }

  let header;
  if (config.dependencyDashboardHeader?.length) {
    header = template.compile(config.dependencyDashboardHeader, config);
  }
  const repoProblems = extractRepoProblems(config);

  let { issueBody } = createDashboardBody(
    header,
    repoProblems,
    branches,
    packageFiles
  );

  if (!hasBranches) {
    issueBody +=
      'This repository currently has no open or pending branches.\n\n';
  }

  // fit the detected dependencies section
  const footer = getFooter(config);
  issueBody += PackageFiles.getDashboardMarkdown(
    GitHubMaxPrBodyLen - issueBody.length - footer.length
  );

  issueBody += footer;

  if (config.dependencyDashboardIssue) {
    const updatedIssue = await platform.getIssue?.(
      config.dependencyDashboardIssue,
      false
    );
    if (updatedIssue) {
      const { dependencyDashboardChecks } = parseDashboardIssue(
        updatedIssue.body!
      );
      for (const branchName of Object.keys(config.dependencyDashboardChecks!)) {
        delete dependencyDashboardChecks[branchName];
      }
      for (const branchName of Object.keys(dependencyDashboardChecks)) {
        const checkText = `- [ ] <!-- ${dependencyDashboardChecks[branchName]}-branch=${branchName} -->`;
        issueBody = issueBody.replace(
          checkText,
          checkText.replace('[ ]', '[x]')
        );
      }
    }
  }

  if (GlobalConfig.get('dryRun')) {
    logger.info(
      { title: config.dependencyDashboardTitle },
      'DRY-RUN: Would ensure Dependency Dashboard'
    );
  } else {
    await platform.ensureIssue({
      title: config.dependencyDashboardTitle!,
      reuseTitle,
      body: platform.massageMarkdown(issueBody),
      labels: config.dependencyDashboardLabels,
      confidential: config.confidential,
    });
  }
}

function getFooter(config: RenovateConfig): string {
  let footer = '';
  if (config.dependencyDashboardFooter?.length) {
    footer +=
      '---\n' +
      template.compile(config.dependencyDashboardFooter, config) +
      '\n';
  }

  return footer;
}
