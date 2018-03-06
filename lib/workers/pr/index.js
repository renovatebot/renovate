const handlebars = require('handlebars');
const changelogHelper = require('./changelog');
const showdown = require('showdown');

const converter = new showdown.Converter();
converter.setFlavor('github');

module.exports = {
  ensurePr,
  checkAutoMerge,
};

// Ensures that PR exists with matching title/body
async function ensurePr(prConfig) {
  const config = { ...prConfig };

  logger.trace({ config }, 'ensurePr');
  // If there is a group, it will use the config of the first upgrade in the array
  const { branchName, upgrades } = config;
  // Check if existing PR exists
  const existingPr = await platform.getBranchPr(branchName);
  if (existingPr) {
    logger.debug('Found existing PR');
  }
  config.upgrades = [];
  const branchStatus = await platform.getBranchStatus(
    branchName,
    config.requiredStatusChecks
  );

  // Only create a PR if a branch automerge has failed
  if (config.automerge === true && config.automergeType.startsWith('branch')) {
    logger.debug(
      `Branch is configured for branch automerge, branchStatus is: ${branchStatus}`
    );
    if (branchStatus === 'pending' || branchStatus === 'running') {
      logger.debug('Checking how long this branch has been pending');
      const lastCommitTime = await platform.getBranchLastCommitTime(branchName);
      const currentTime = new Date();
      const millisecondsPerHour = 1000 * 60 * 60;
      const elapsedHours = Math.round(
        (currentTime.getTime() - lastCommitTime.getTime()) / millisecondsPerHour
      );
      if (elapsedHours >= config.prNotPendingHours) {
        logger.info('Branch exceeds prNotPending hours - forcing PR creation');
        config.forcePr = true;
      }
    }
    if (config.forcePr || branchStatus === 'failure') {
      logger.debug(`Branch tests failed, so will create PR`);
    } else {
      return null;
    }
  }
  if (config.prCreation === 'status-success') {
    logger.debug('Checking branch combined status');
    if (branchStatus !== 'success') {
      logger.debug(`Branch status is "${branchStatus}" - not creating PR`);
      return null;
    }
    logger.debug('Branch status success');
  } else if (config.prCreation === 'not-pending' && !existingPr) {
    logger.debug('Checking branch combined status');
    if (branchStatus === 'pending' || branchStatus === 'running') {
      logger.debug(`Branch status is "${branchStatus}" - checking timeout`);
      const lastCommitTime = await platform.getBranchLastCommitTime(branchName);
      const currentTime = new Date();
      const millisecondsPerHour = 1000 * 60 * 60;
      const elapsedHours = Math.round(
        (currentTime.getTime() - lastCommitTime.getTime()) / millisecondsPerHour
      );
      if (elapsedHours < config.prNotPendingHours) {
        logger.debug(
          `Branch is ${elapsedHours} hours old - skipping PR creation`
        );
        return null;
      }
      logger.debug(
        `prNotPendingHours=${
          config.prNotPendingHours
        } threshold hit - creating PR`
      );
    }
    logger.debug('Branch status success');
  }

  const processedUpgrades = [];

  const issueRe = /([\s(])#(\d+)([)\s]?)/g;

  const commitRepos = [];

  let token;
  let endpoint;
  // istanbul ignore if
  if (process.env.GITHUB_ENDPOINT) {
    logger.debug('Removing GHE token before calling changelog');
    endpoint = process.env.GITHUB_ENDPOINT;
    delete process.env.GITHUB_ENDPOINT;
    token = process.env.GITHUB_TOKEN;
    process.env.GITHUB_TOKEN = process.env.GITHUB_COM_TOKEN;
  }
  // Get changelog and then generate template strings
  for (const upgrade of upgrades) {
    const upgradeKey = `${upgrade.depName}-${upgrade.manager}-${
      upgrade.changeLogFromVersion
    }-${upgrade.changeLogToVersion}`;
    if (processedUpgrades.indexOf(upgradeKey) !== -1) {
      continue; // eslint-disable-line no-continue
    }
    processedUpgrades.push(upgradeKey);

    let logJSON;
    if (
      upgrade.manager !== 'travis' &&
      upgrade.manager !== 'nvm' &&
      upgrade.depType !== 'engines'
    ) {
      logJSON = await changelogHelper.getChangeLogJSON(
        upgrade.depName,
        upgrade.changeLogFromVersion,
        upgrade.changeLogToVersion
      );
    }
    if (logJSON) {
      upgrade.githubName = logJSON.project.github;
      upgrade.hasReleaseNotes = logJSON.hasReleaseNotes;
      upgrade.releases = [];
      if (!commitRepos.includes(upgrade.githubName)) {
        commitRepos.push(upgrade.githubName);
        logJSON.versions.forEach(version => {
          const release = { ...version };
          release.commits = [];
          if (release.changes) {
            release.changes.forEach(change => {
              const commit = { ...change };
              delete commit.date;
              commit.shortSha = change.sha.slice(0, 7);
              commit.url = `${logJSON.project.repository}/commit/${change.sha}`;
              if (change.message) {
                [commit.message] = change.message.split('\n');
                if (!config.isGitHub || config.privateRepo === true) {
                  commit.message = commit.message.replace(
                    issueRe,
                    `$1[#$2](${upgrade.repositoryUrl}/issues/$2)$3`
                  );
                }
              }
              release.commits.push(commit);
            });
          }
          release.hasCommits = release.commits.length > 0;
          upgrade.hasCommits = upgrade.hasCommits || release.hasCommits;
          upgrade.releases.push(release);
        });
      }
    }
    config.upgrades.push(upgrade);
  }
  // istanbul ignore if
  if (endpoint) {
    logger.debug('Restoring GHE token and endpoint');
    process.env.GITHUB_TOKEN = token;
    process.env.GITHUB_ENDPOINT = endpoint;
  }

  // Update the config object
  Object.assign(config, upgrades[0]);
  if (config.errors && config.errors.length) {
    config.hasErrors = true;
  }
  if (config.warnings && config.warnings.length) {
    config.hasWarnings = true;
  }
  config.hasReleaseNotes = config.upgrades.some(upg => upg.hasReleaseNotes);
  config.hasCommits = config.upgrades.some(upg => upg.hasCommits);

  const releaseNoteRepos = [];
  for (const upgrade of config.upgrades) {
    if (releaseNoteRepos.includes(upgrade.repositoryUrl)) {
      logger.debug(
        { depName: upgrade.depName },
        'Removing duplicate release notes'
      );
      upgrade.hasReleaseNotes = false;
    } else {
      releaseNoteRepos.push(upgrade.repositoryUrl);
    }
  }

  const prTitle = handlebars.compile(config.prTitle)(config);
  let prBody = handlebars.compile(config.prBody)(config);
  // istanbul ignore if
  if (config.global && config.global.prBanner) {
    prBody = config.global.prBanner + '\n\n' + prBody;
  }
  if (config.isGitHub && !config.privateRepo) {
    // Put a zero width space after every # followed by a digit
    prBody = prBody.replace(/#(\d)/gi, '#&#8203;$1');
    // Put a zero width space after every @ symbol to prevent unintended hyperlinking
    prBody = prBody.replace(/@/g, '@&#8203;');
    prBody = prBody.replace(/(`\[?@)&#8203;/g, '$1');
    // Public GitHub repos need links prevented - see #489
    prBody = prBody.replace(issueRe, '$1#&#8203;$2$3');
    prBody = prBody.replace(
      /(https?:\/\/github.com\/[^/]*\/[^/]*\/(issues|pull)\/\w+)/g,
      '`$1`'
    );
    logger.trace('Escaping links to GitHub users');
    prBody = prBody.replace(
      /]\(https?:\/\/github.com\/[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}\)/gi,
      ']'
    );
    // convert escaped backticks back to `
    const backTickRe = /&#x60;([^/]*?)&#x60;/g;
    prBody = prBody.replace(backTickRe, '`$1`');
  }
  // It would be nice to abstract this to the platform layer but made difficult due to our create/update check
  if (config.isGitLab) {
    // Convert to HTML using GitHub-flavoured markdown as it is more feature-rich than GitLab's flavour
    prBody = converter
      .makeHtml(prBody)
      .replace(/<\/?h4[^>]*>/g, '**') // See #954
      .replace(/Pull Request/g, 'Merge Request')
      .replace(/PR/g, 'MR')
      .replace(/<summary>/g, '<h1>')
      .replace(/<\/summary><\/p>/g, '</h1>')
      .replace(/<p><details><br \/>\n/g, '')
      .replace(/<p><\/details><\/p>\n/g, '');
  } else if (config.isVsts) {
    // Remove any HTML we use
    prBody = prBody
      .replace('<summary>', '**')
      .replace('</summary>', '**')
      .replace('<details>', '')
      .replace('</details>', '');
  }

  try {
    if (existingPr) {
      logger.debug('Processing existing PR');
      if (config.automerge && branchStatus === 'failure') {
        logger.debug(`Setting assignees and reviewers as status checks failed`);
        await addAssigneesReviewers(config, existingPr);
      }
      // Check if existing PR needs updating
      if (existingPr.title === prTitle && existingPr.body === prBody) {
        logger.info(`${existingPr.displayNumber} does not need updating`);
        return existingPr;
      }
      // PR must need updating
      if (existingPr.title !== prTitle) {
        logger.debug(
          {
            oldPrTitle: existingPr.title,
            newPrTitle: prTitle,
          },
          'PR title changed'
        );
      } else {
        logger.debug(
          {
            prTitle,
            oldPrBody: existingPr.body,
            newPrBody: prBody,
          },
          'PR body changed'
        );
      }

      await platform.updatePr(existingPr.number, prTitle, prBody);
      logger.info({ pr: existingPr.displayNumber }, `Updated PR`);
      return existingPr;
    }
    logger.info({ branchName, prTitle }, `Creating PR`);
    let pr;
    try {
      pr = await platform.createPr(
        branchName,
        prTitle,
        prBody,
        config.labels,
        false,
        config.statusCheckVerify
      );
    } catch (err) {
      logger.warn({ err, message: err.message }, `Failed to create PR`);
      if (err.message === 'Validation Failed (422)') {
        logger.info({ branchName }, 'Deleting invalid branch');
        await platform.deleteBranch(branchName);
      }
      return null;
    }
    // Skip assign and review if automerging PR
    if (config.automerge && branchStatus !== 'failure') {
      logger.debug(
        `Skipping assignees and reviewers as automerge=${config.automerge}`
      );
    } else {
      await addAssigneesReviewers(config, pr);
    }
    logger.info(`Created ${pr.displayNumber}`);
    return pr;
  } catch (err) {
    logger.error({ err }, 'Failed to ensure PR:', err);
  }
  return null;
}

async function addAssigneesReviewers(config, pr) {
  if (config.assignees.length > 0) {
    try {
      const assignees = config.assignees.map(
        assignee =>
          assignee.length && assignee[0] === '@' ? assignee.slice(1) : assignee
      );
      await platform.addAssignees(pr.number, assignees);
      logger.info({ assignees: config.assignees }, 'Added assignees');
    } catch (err) {
      logger.info(
        { assignees: config.assignees, err },
        'Failed to add assignees'
      );
    }
  }
  if (config.reviewers.length > 0) {
    try {
      const reviewers = config.reviewers.map(
        reviewer =>
          reviewer.length && reviewer[0] === '@' ? reviewer.slice(1) : reviewer
      );
      await platform.addReviewers(pr.number, reviewers);
      logger.info({ reviewers: config.reviewers }, 'Added reviewers');
    } catch (err) {
      logger.info(
        { assignees: config.assignees, err },
        'Failed to add reviewers'
      );
    }
  }
}

async function checkAutoMerge(pr, config) {
  logger.trace({ config }, 'checkAutoMerge');
  logger.debug(`Checking #${pr.number} for automerge`);
  if (config.automerge) {
    logger.info('PR is configured for automerge');
    // Return if PR not ready for automerge
    if (pr.isUnmergeable) {
      logger.info('PR is not mergeable');
      logger.debug({ pr });
      return false;
    }
    if (config.requiredStatusChecks && pr.canMerge !== true) {
      logger.info('PR is not ready for merge');
      return false;
    }
    // Check branch status
    const branchStatus = await platform.getBranchStatus(
      pr.branchName,
      config.requiredStatusChecks
    );
    logger.debug(`branchStatus=${branchStatus}`);
    if (branchStatus !== 'success') {
      logger.info('Branch status is not "success"');
      return false;
    }
    // Check if it's been touched
    if (!pr.canRebase) {
      logger.info('PR is ready for automerge but has been modified');
      return false;
    }
    // Let's merge this
    logger.info(`Automerging #${pr.number}`);
    return platform.mergePr(pr.number, config.branchName);
  }
  logger.debug('No automerge');
  return false;
}
