import is from '@sindresorhus/is';
import { DateTime } from 'luxon';
import { GlobalConfig } from '../../config/global';
import type { RenovateConfig } from '../../config/types';
import { logger } from '../../logger';
import type { PackageFile } from '../../modules/manager/types';
import { platform } from '../../modules/platform';
import { coerceArray } from '../../util/array';
import { regEx } from '../../util/regex';
import { coerceString } from '../../util/string';
import * as template from '../../util/template';
import type { BranchConfig, SelectAllConfig } from '../types';
import { extractRepoProblems } from './common';
import type { ConfigMigrationResult } from './config-migration';
import { getDepWarningsDashboard } from './errors-warnings';
import { PackageFiles } from './package-files';
import type { Vulnerability } from './process/types';
import { Vulnerabilities } from './process/vulnerabilities';

interface DependencyDashboard {
  dependencyDashboardChecks: Record<string, string>;
  dependencyDashboardRebaseAllOpen: boolean;
  dependencyDashboardAllPending: boolean;
  dependencyDashboardAllRateLimited: boolean;
}

const rateLimitedRe = regEx(
  ` - \\[ \\] ${getMarkdownComment('unlimit-branch=([^\\s]+)')}`,
  'g',
);
const pendingApprovalRe = regEx(
  ` - \\[ \\] ${getMarkdownComment('approve-branch=([^\\s]+)')}`,
  'g',
);
const generalBranchRe = regEx(
  ` ${getMarkdownComment('([a-zA-Z]+)-branch=([^\\s]+)')}`,
);
const markedBranchesRe = regEx(
  ` - \\[x\\] ${getMarkdownComment('([a-zA-Z]+)-branch=([^\\s]+)')}`,
  'g',
);

const approveAllPendingPrs = 'approve-all-pending-prs';
const createAllRateLimitedPrs = 'create-all-rate-limited-prs';
const createConfigMigrationPr = 'create-config-migration-pr';
const configMigrationPrInfo = 'config-migration-pr-info';
const rebaseAllOpenPrs = 'rebase-all-open-prs';

function getMarkdownComment(comment: string): string {
  return `<!-- ${comment} -->`;
}

function isBoxChecked(issueBody: string, type: string): boolean {
  return issueBody.includes(getCheckbox(type, true));
}

function isBoxUnchecked(issueBody: string, type: string): boolean {
  return issueBody.includes(getCheckbox(type));
}

function getCheckbox(type: string, checked = false): string {
  return ` - [${checked ? 'x' : ' '}] ${getMarkdownComment(type)}`;
}

function checkOpenAllRateLimitedPR(issueBody: string): boolean {
  return isBoxChecked(issueBody, createAllRateLimitedPrs);
}

function checkApproveAllPendingPR(issueBody: string): boolean {
  return isBoxChecked(issueBody, approveAllPendingPrs);
}

function checkRebaseAll(issueBody: string): boolean {
  return isBoxChecked(issueBody, rebaseAllOpenPrs);
}

function getConfigMigrationCheckboxState(
  issueBody: string,
): 'no-checkbox' | 'checked' | 'unchecked' | 'migration-pr-exists' {
  if (issueBody.includes(getMarkdownComment(configMigrationPrInfo))) {
    return 'migration-pr-exists';
  }

  if (isBoxChecked(issueBody, createConfigMigrationPr)) {
    return 'checked';
  }

  if (isBoxUnchecked(issueBody, createConfigMigrationPr)) {
    return 'unchecked';
  }

  return 'no-checkbox';
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
  dependencyDashboardChecks: Record<string, string>,
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
    dependencyDashboardChecks,
  );
  return dependencyDashboardChecks;
}

function parseDashboardIssue(issueBody: string): DependencyDashboard {
  const dependencyDashboardChecks = getCheckedBranches(issueBody);
  const dependencyDashboardRebaseAllOpen = checkRebaseAll(issueBody);
  const dependencyDashboardAllPending = checkApproveAllPendingPR(issueBody);
  const dependencyDashboardAllRateLimited =
    checkOpenAllRateLimitedPR(issueBody);
  dependencyDashboardChecks.configMigrationCheckboxState =
    getConfigMigrationCheckboxState(issueBody);
  return {
    dependencyDashboardChecks,
    dependencyDashboardRebaseAllOpen,
    dependencyDashboardAllPending,
    dependencyDashboardAllRateLimited,
  };
}

export async function readDashboardBody(
  config: SelectAllConfig,
): Promise<void> {
  let dashboardChecks: DependencyDashboard = {
    dependencyDashboardChecks: {},
    dependencyDashboardAllPending: false,
    dependencyDashboardRebaseAllOpen: false,
    dependencyDashboardAllRateLimited: false,
  };
  const stringifiedConfig = JSON.stringify(config);
  if (
    config.dependencyDashboard === true ||
    stringifiedConfig.includes('"dependencyDashboardApproval":true') ||
    stringifiedConfig.includes('"prCreation":"approval"')
  ) {
    config.dependencyDashboardTitle =
      config.dependencyDashboardTitle ?? `Dependency Dashboard`;
    const issue = await platform.findIssue(config.dependencyDashboardTitle);
    if (issue) {
      config.dependencyDashboardIssue = issue.number;
      dashboardChecks = parseDashboardIssue(issue.body ?? '');
    }
  }

  if (config.checkedBranches) {
    const checkedBranchesRec: Record<string, string> = Object.fromEntries(
      config.checkedBranches.map((branchName) => [branchName, 'global-config']),
    );
    dashboardChecks.dependencyDashboardChecks = {
      ...dashboardChecks.dependencyDashboardChecks,
      ...checkedBranchesRec,
    };
  }

  Object.assign(config, dashboardChecks);
}

function getListItem(branch: BranchConfig, type: string): string {
  let item = getCheckbox(`${type}-branch=${branch.branchName}`);
  if (branch.prNo) {
    // TODO: types (#22198)
    item += `[${branch.prTitle!}](../pull/${branch.prNo})`;
  } else {
    item += branch.prTitle;
  }
  const uniquePackages = [
    // TODO: types (#22198)
    ...new Set(branch.upgrades.map((upgrade) => `\`${upgrade.depName!}\``)),
  ];
  if (uniquePackages.length < 2) {
    return item + '\n';
  }
  return item + ' (' + uniquePackages.join(', ') + ')\n';
}

function getBranchesListMd(
  branches: BranchConfig[],
  predicate: (
    value: BranchConfig,
    index: number,
    array: BranchConfig[],
  ) => unknown,
  title: string,
  description: string,
  listItemType = 'approvePr',
  bulkComment?: string,
  bulkMessage?: string,
  bulkIcon?: string,
): string {
  const filteredBranches = branches.filter(predicate);
  if (filteredBranches.length === 0) {
    return '';
  }
  let result = `## ${title}\n\n${description}\n\n`;
  result += `${filteredBranches
    .map((branch: BranchConfig): string => getListItem(branch, listItemType))
    .join('')}`;
  if (bulkComment && bulkMessage && filteredBranches.length > 1) {
    result += getCheckbox(bulkComment);
    result += `${bulkIcon ? bulkIcon + ' ' : ''}**${bulkMessage}**${bulkIcon ? ' ' + bulkIcon : ''}\n`;
  }
  return result + '\n';
}

function appendRepoProblems(config: RenovateConfig, issueBody: string): string {
  let newIssueBody = issueBody;
  const repoProblems = extractRepoProblems(config.repository);
  if (repoProblems.size) {
    newIssueBody += '## Repository problems\n\n';
    const repoProblemsHeader =
      config.customizeDashboard?.repoProblemsHeader ??
      'Renovate tried to run on this repository, but found these problems.';
    newIssueBody += template.compile(repoProblemsHeader, config) + '\n\n';

    for (const repoProblem of repoProblems) {
      newIssueBody += ` - ${repoProblem}\n`;
    }
    newIssueBody += '\n';
  }
  return newIssueBody;
}

export async function ensureDependencyDashboard(
  config: SelectAllConfig,
  allBranches: BranchConfig[],
  packageFiles: Record<string, PackageFile[]> = {},
  configMigrationRes: ConfigMigrationResult,
): Promise<void> {
  logger.debug('ensureDependencyDashboard()');
  if (config.mode === 'silent') {
    logger.debug(
      'Dependency Dashboard issue is not created, updated or closed when mode=silent',
    );
    return;
  }
  // legacy/migrated issue
  const reuseTitle = 'Update Dependencies (Renovate Bot)';
  const branches = allBranches.filter(
    (branch) =>
      branch.result !== 'automerged' &&
      !branch.upgrades?.every((upgrade) => upgrade.remediationNotPossible),
  );
  if (
    !(
      config.dependencyDashboard === true ||
      config.dependencyDashboardApproval === true ||
      config.packageRules?.some((rule) => rule.dependencyDashboardApproval) ===
        true ||
      branches.some(
        (branch) =>
          !!branch.dependencyDashboardApproval ||
          !!branch.dependencyDashboardPrApproval,
      )
    )
  ) {
    if (GlobalConfig.get('dryRun')) {
      logger.info(
        { title: config.dependencyDashboardTitle },
        'DRY-RUN: Would close Dependency Dashboard',
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

  // Check packageFiles for any deprecations
  let hasDeprecations = false;
  const deprecatedPackages: Record<string, Record<string, boolean>> = {};
  logger.debug('Checking packageFiles for deprecated packages');
  if (is.nonEmptyObject(packageFiles)) {
    for (const [manager, fileNames] of Object.entries(packageFiles)) {
      for (const fileName of fileNames) {
        for (const dep of fileName.deps) {
          const name = dep.packageName ?? dep.depName;
          const hasReplacement = !!dep.updates?.find(
            (updates) => updates.updateType === 'replacement',
          );
          if (name && (dep.deprecationMessage ?? hasReplacement)) {
            hasDeprecations = true;
            deprecatedPackages[manager] ??= {};
            deprecatedPackages[manager][name] ??= hasReplacement;
          }
        }
      }
    }
  }

  const hasBranches = is.nonEmptyArray(branches);
  if (config.dependencyDashboardAutoclose && !hasBranches && !hasDeprecations) {
    if (GlobalConfig.get('dryRun')) {
      logger.info(
        { title: config.dependencyDashboardTitle },
        'DRY-RUN: Would close Dependency Dashboard',
      );
    } else {
      logger.debug('Closing Dependency Dashboard');
      await platform.ensureIssueClosing(config.dependencyDashboardTitle!);
    }
    return;
  }
  let issueBody = '';

  if (config.dependencyDashboardHeader?.length) {
    issueBody +=
      template.compile(config.dependencyDashboardHeader, config) + '\n\n';
  }

  if (configMigrationRes.result === 'pr-exists') {
    issueBody +=
      '## Config Migration Needed\n\n' +
      getMarkdownComment(configMigrationPrInfo) +
      ` See Config Migration PR: #${configMigrationRes.prNumber}.\n\n`;
  } else if (configMigrationRes?.result === 'pr-modified') {
    issueBody +=
      '## Config Migration Needed (error)\n\n' +
      getMarkdownComment(configMigrationPrInfo) +
      ` The Config Migration branch exists but has been modified by another user. Renovate will not push to this branch unless it is first deleted. \n\n See Config Migration PR: #${configMigrationRes.prNumber}.\n\n`;
  } else if (configMigrationRes?.result === 'add-checkbox') {
    issueBody +=
      '## Config Migration Needed\n\n' +
      getCheckbox(createConfigMigrationPr) +
      ' Select this checkbox to let Renovate create an automated Config Migration PR.' +
      '\n\n';
  }

  issueBody = appendRepoProblems(config, issueBody);

  if (hasDeprecations) {
    issueBody += '> ⚠ **Warning**\n> \n';
    issueBody += 'These dependencies are deprecated:\n\n';
    issueBody += '| Datasource | Name | Replacement PR? |\n';
    issueBody += '|------------|------|--------------|\n';
    for (const manager of Object.keys(deprecatedPackages).sort()) {
      const deps = deprecatedPackages[manager];
      for (const depName of Object.keys(deps).sort()) {
        const hasReplacement = deps[depName];
        issueBody += `| ${manager} | \`${depName}\` | ${
          hasReplacement
            ? '![Available](https://img.shields.io/badge/available-green?style=flat-square)'
            : '![Unavailable](https://img.shields.io/badge/unavailable-orange?style=flat-square)'
        } |\n`;
      }
    }
    issueBody += '\n';
  }

  if (config.dependencyDashboardReportAbandonment) {
    issueBody += getAbandonedPackagesMd(packageFiles);
  }

  issueBody += getBranchesListMd(
    branches,
    (branch) => branch.result === 'needs-approval',
    'Pending Approval',
    'The following branches are pending approval. To create them, click on a checkbox below.',
    'approve',
    approveAllPendingPrs,
    'Create all pending approval PRs at once',
    '🔐',
  );
  issueBody += getBranchesListMd(
    branches,
    (branch) => branch.result === 'minimum-group-size-not-met',
    'Group Size Not Met',
    'The following branches have not met their minimum group size. To create them, click on a checkbox below.',
    'approveGroup',
  );
  issueBody += getBranchesListMd(
    branches,
    (branch) => branch.result === 'not-scheduled',
    'Awaiting Schedule',
    'The following updates are awaiting their schedule. To get an update now, click on a checkbox below.',
    'unschedule',
  );
  issueBody += getBranchesListMd(
    branches,
    (branch) =>
      branch.result === 'branch-limit-reached' ||
      branch.result === 'pr-limit-reached' ||
      branch.result === 'commit-limit-reached',
    'Rate-Limited',
    'The following updates are currently rate-limited. To force their creation now, click on a checkbox below.',
    'unlimit',
    createAllRateLimitedPrs,
    'Create all rate-limited PRs at once',
    '🔐',
  );
  issueBody += getBranchesListMd(
    branches,
    (branch) => branch.result === 'error',
    'Errored',
    'The following updates encountered an error and will be retried. To force a retry now, click on a checkbox below.',
    'retry',
  );
  issueBody += getBranchesListMd(
    branches,
    (branch) => branch.result === 'needs-pr-approval',
    'PR Creation Approval Required',
    'The following branches exist but PR creation requires approval. To approve PR creation, click on a checkbox below.',
  );
  issueBody += getBranchesListMd(
    branches,
    (branch) => branch.result === 'pr-edited',
    'Edited/Blocked',
    'The following updates have been manually edited so Renovate will no longer make changes. To discard all commits and start over, click on a checkbox below.',
    'rebase',
  );
  issueBody += getBranchesListMd(
    branches,
    (branch) => branch.result === 'pending',
    'Pending Status Checks',
    'The following updates await pending status checks. To force their creation now, click on a checkbox below.',
  );
  issueBody += getBranchesListMd(
    branches,
    (branch) => branch.prBlockedBy === 'BranchAutomerge',
    'Pending Branch Automerge',
    'The following updates await pending status checks before automerging. To abort the branch automerge and create a PR instead, click on a checkbox below.',
  );

  const warn = getDepWarningsDashboard(packageFiles, config);
  if (warn) {
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
    'minimum-group-size-not-met',
  ];
  const inProgress = branches.filter(
    (branch) =>
      !otherRes.includes(branch.result!) &&
      branch.prBlockedBy !== 'BranchAutomerge',
  );
  issueBody += getBranchesListMd(
    inProgress,
    (branch) => !!branch.prBlockedBy || !branch.prNo,
    'Other Branches',
    'The following updates are pending. To force the creation of a PR, click on a checkbox below.',
    'other',
  );
  issueBody += getBranchesListMd(
    inProgress,
    (branch) => branch.prNo && !branch.prBlockedBy,
    'Open',
    'The following updates have all been created. To force a retry/rebase of any, click on a checkbox below.',
    'rebase',
    rebaseAllOpenPrs,
    'Click on this checkbox to rebase all open PRs at once',
  );

  issueBody += getBranchesListMd(
    branches,
    (branch) => branch.result === 'already-existed',
    'Ignored or Blocked',
    'The following updates are blocked by an existing closed PR. To recreate the PR, click on a checkbox below.',
    'recreate',
  );

  if (!hasBranches) {
    issueBody +=
      'This repository currently has no open or pending branches.\n\n';
  }

  // add CVE section
  issueBody += await getDashboardMarkdownVulnerabilities(config, packageFiles);

  // fit the detected dependencies section
  const footer = getFooter(config);
  issueBody += PackageFiles.getDashboardMarkdown(
    platform.maxBodyLength() - issueBody.length - footer.length,
  );

  issueBody += footer;

  if (config.dependencyDashboardIssue) {
    // If we're not changing the dashboard issue, then we can skip checking if the user changed it.
    // The cached issue we get back here will reflect its state at the _start_ of our run
    const cachedIssue = await platform.getIssue?.(
      config.dependencyDashboardIssue,
    );
    if (cachedIssue?.body === issueBody) {
      logger.debug('No changes to dependency dashboard issue needed');
      return;
    }

    // Skip cache when getting the issue to ensure we get the latest body,
    // including any updates the user made after we started the run
    const updatedIssue = await platform.getIssue?.(
      config.dependencyDashboardIssue,
      false,
    );
    if (updatedIssue) {
      const { dependencyDashboardChecks } = parseDashboardIssue(
        coerceString(updatedIssue.body),
      );
      for (const branchName of Object.keys(config.dependencyDashboardChecks!)) {
        delete dependencyDashboardChecks[branchName];
      }
      for (const branchName of Object.keys(dependencyDashboardChecks)) {
        const checkText = getCheckbox(
          `${dependencyDashboardChecks[branchName]}-branch=${branchName}`,
        );
        issueBody = issueBody.replace(
          checkText,
          checkText.replace('[ ]', '[x]'),
        );
      }
    }
  }

  if (GlobalConfig.get('dryRun')) {
    logger.info(
      { title: config.dependencyDashboardTitle },
      'DRY-RUN: Would ensure Dependency Dashboard',
    );
  } else {
    await platform.ensureIssue({
      title: config.dependencyDashboardTitle!,
      reuseTitle,
      body: platform.massageMarkdown(issueBody, config.rebaseLabel),
      labels: config.dependencyDashboardLabels,
      confidential: config.confidential,
    });
  }
}

export function getAbandonedPackagesMd(
  packageFiles: Record<string, PackageFile[]>,
): string {
  const abandonedPackages: Record<
    string,
    Record<string, string | undefined | null>
  > = {};
  let abandonedCount = 0;

  for (const [manager, managerPackageFiles] of Object.entries(packageFiles)) {
    for (const packageFile of managerPackageFiles) {
      for (const dep of coerceArray(packageFile.deps)) {
        if (dep.depName && dep.isAbandoned) {
          abandonedCount++;
          abandonedPackages[manager] = abandonedPackages[manager] || {};
          abandonedPackages[manager][dep.depName] = dep.mostRecentTimestamp;
        }
      }
    }
  }

  if (abandonedCount === 0) {
    return '';
  }

  let abandonedMd = '> ℹ **Note**\n> \n';
  abandonedMd +=
    'These dependencies have not received updates for an extended period and may be unmaintained:\n\n';

  abandonedMd += '<details>\n';
  abandonedMd += `<summary>View abandoned dependencies (${abandonedCount})</summary>\n\n`;
  abandonedMd += '| Datasource | Name | Last Updated |\n';
  abandonedMd += '|------------|------|-------------|\n';

  for (const manager of Object.keys(abandonedPackages).sort()) {
    const deps = abandonedPackages[manager];
    for (const depName of Object.keys(deps).sort()) {
      const mostRecentTimestamp = deps[depName];
      const formattedDate = mostRecentTimestamp
        ? DateTime.fromISO(mostRecentTimestamp).toFormat('yyyy-MM-dd')
        : 'unknown';
      abandonedMd += `| ${manager} | \`${depName}\` | \`${formattedDate}\` |\n`;
    }
  }

  abandonedMd += '\n</details>\n\n';
  abandonedMd +=
    'Packages are marked as abandoned when they exceed the [`abandonmentThreshold`](https://docs.renovatebot.com/configuration-options/#abandonmentthreshold) since their last release.\n';
  abandonedMd +=
    'Unlike deprecated packages with official notices, abandonment is detected by release inactivity.\n\n';

  return abandonedMd + '\n';
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

export async function getDashboardMarkdownVulnerabilities(
  config: RenovateConfig,
  packageFiles: Record<string, PackageFile[]>,
): Promise<string> {
  let result = '';

  if (
    is.nullOrUndefined(config.dependencyDashboardOSVVulnerabilitySummary) ||
    config.dependencyDashboardOSVVulnerabilitySummary === 'none'
  ) {
    return result;
  }

  result += '## Vulnerabilities\n\n';

  const vulnerabilityFetcher = await Vulnerabilities.create();
  const vulnerabilities = await vulnerabilityFetcher.fetchVulnerabilities(
    config,
    packageFiles,
  );

  if (vulnerabilities.length === 0) {
    result +=
      'Renovate has not found any CVEs on [osv.dev](https://osv.dev).\n\n';
    return result;
  }

  const unresolvedVulnerabilities = vulnerabilities.filter((value) =>
    is.nullOrUndefined(value.fixedVersion),
  );
  const resolvedVulnerabilitiesLength =
    vulnerabilities.length - unresolvedVulnerabilities.length;

  result += `\`${resolvedVulnerabilitiesLength}\`/\`${vulnerabilities.length}\``;
  if (is.truthy(config.osvVulnerabilityAlerts)) {
    result += ' CVEs have Renovate fixes.\n';
  } else {
    result +=
      ' CVEs have possible Renovate fixes.\nSee [`osvVulnerabilityAlerts`](https://docs.renovatebot.com/configuration-options/#osvvulnerabilityalerts) to allow Renovate to supply fixes.\n';
  }

  let renderedVulnerabilities: Vulnerability[];
  switch (config.dependencyDashboardOSVVulnerabilitySummary) {
    // filter vulnerabilities to display based on configuration
    case 'unresolved':
      renderedVulnerabilities = unresolvedVulnerabilities;
      break;
    default:
      renderedVulnerabilities = vulnerabilities;
  }

  const managerRecords: Record<
    string,
    Record<string, Record<string, Vulnerability[]>>
  > = {};
  for (const vulnerability of renderedVulnerabilities) {
    const { manager, packageFile } = vulnerability.packageFileConfig;
    if (is.nullOrUndefined(managerRecords[manager!])) {
      managerRecords[manager!] = {};
    }
    if (is.nullOrUndefined(managerRecords[manager!][packageFile])) {
      managerRecords[manager!][packageFile] = {};
    }
    if (
      is.nullOrUndefined(
        managerRecords[manager!][packageFile][vulnerability.packageName],
      )
    ) {
      managerRecords[manager!][packageFile][vulnerability.packageName] = [];
    }
    managerRecords[manager!][packageFile][vulnerability.packageName].push(
      vulnerability,
    );
  }

  for (const [manager, packageFileRecords] of Object.entries(managerRecords)) {
    result += `<details><summary>${manager}</summary>\n<blockquote>\n\n`;
    for (const [packageFile, packageNameRecords] of Object.entries(
      packageFileRecords,
    )) {
      result += `<details><summary>${packageFile}</summary>\n<blockquote>\n\n`;
      for (const [packageName, cves] of Object.entries(packageNameRecords)) {
        result += `<details><summary>${packageName}</summary>\n<blockquote>\n\n`;
        for (const vul of cves) {
          const id = vul.vulnerability.id;
          const suffix = is.nonEmptyString(vul.fixedVersion)
            ? ` (fixed in ${vul.fixedVersion})`
            : '';
          result += `- [${id}](https://osv.dev/vulnerability/${id})${suffix}\n`;
        }
        result += `</blockquote>\n</details>\n\n`;
      }
      result += `</blockquote>\n</details>\n\n`;
    }
    result += `</blockquote>\n</details>\n\n`;
  }

  return result;
}
