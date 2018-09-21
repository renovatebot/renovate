const handlebars = require('handlebars');
const releaseNotesHbs = require('./changelog/hbs-template');

module.exports = {
  getPrBody,
};

function getTableDefinition(config) {
  const res = [];
  for (const header of config.prBodyColumns) {
    const value = config.prBodyDefinitions[header];
    res.push({ header, value });
  }
  return res;
}

function getNonEmptyColumns(definitions, rows) {
  const res = [];
  for (const column of definitions) {
    const { header } = column;
    for (const row of rows) {
      if (row[header] && row[header].length) {
        if (!res.includes(header)) {
          res.push(header);
        }
      }
    }
  }
  return res;
}

async function getPrBody(config) {
  config.upgrades.forEach(upgrade => {
    /* eslint-disable no-param-reassign */
    const { homepage, repositoryUrl, changelogUrl } = upgrade;
    const references = [];
    if (homepage) {
      references.push(`[homepage](${homepage})`);
    }
    if (repositoryUrl) {
      references.push(`[source](${repositoryUrl})`);
    }
    if (changelogUrl) {
      references.push(`[changelog](${changelogUrl})`);
    }
    upgrade.references = references.join(', ');
    const { newValue, newDigestShort, updateType } = upgrade;
    if (newDigestShort) {
      if (updateType === 'pin') {
        upgrade.newValue = config.newDigestShort;
      }
      if (newValue) {
        upgrade.newVaue = newValue + '@' + newDigestShort;
      } else {
        upgrade.newValue = newDigestShort;
      }
    } else if (updateType !== 'lockFileMaintenance') {
      upgrade.newValue = newValue;
    }
    /* eslint-enable no-param-reassign */
  });
  const tableDefinitions = getTableDefinition(config);
  const tableValues = config.upgrades.map(upgrade => {
    const res = {};
    for (const column of tableDefinitions) {
      const { header, value } = column;
      try {
        res[header] = handlebars
          .compile(value)(upgrade)
          .replace(/^``$/, '');
      } catch (err) /* istanbul ignore next */ {
        logger.info({ header, value, err }, 'Handlebars compilation error');
      }
    }
    return res;
  });
  const tableColumns = getNonEmptyColumns(tableDefinitions, tableValues);
  logger.info({ tableDefinitions, tableValues, tableColumns });
  let prBody = '';
  // istanbul ignore if
  if (config.prBanner && !config.isGroup) {
    prBody += handlebars.compile(config.prBanner)(config) + '\n\n';
  }
  prBody += '\n\nThis PR contains the following updates:\n\n';
  prBody += '| ' + tableColumns.join(' | ') + ' |\n';
  prBody += '|' + tableColumns.map(() => '--|').join('') + '\n';
  const rows = [];
  for (const row of tableValues) {
    let val = '|';
    for (const column of tableColumns) {
      val += ` ${row[column]} |`;
    }
    val += '\n';
    rows.push(val);
  }
  const uniqueRows = [...new Set(rows)];
  prBody += uniqueRows.join('');
  prBody += '\n\n';

  if (config.upgrades.some(upgrade => upgrade.gitRef)) {
    prBody +=
      ':abcd: If you wish to disable git hash updates, add `":disableDigestUpdates"` to the extends array in your config.\n\n';
  }

  if (config.updateType === 'lockFileMaintenance') {
    prBody +=
      ':wrench: This Pull Request updates `package.json` lock files to use the latest dependency versions.\n\n';
  }

  if (config.isPin) {
    prBody +=
      ":pushpin: **Important**: Renovate will wait until you have merged this Pin PR before creating any *upgrade* PRs for the affected packages. Add the preset `:preserveSemverRanges` your config if you instead don't wish to pin dependencies.\n\n";
  }
  if (config.hasReleaseNotes) {
    prBody +=
      '\n\n---\n\n' + handlebars.compile(releaseNotesHbs)(config) + '\n\n';
  }
  prBody += '\n\n---\n\n### Renovate configuration\n\n';
  prBody += ':date: **Schedule**: ';
  if (config.schedule && config.schedule.length) {
    prBody += `PR created on schedule "${config.schedule}"`;
    if (config.timezone) {
      prBody += ` in timezone ${config.timezone}`;
    } else {
      prBody += ` (UTC)`;
    }
  } else {
    prBody += 'No schedule defined.';
  }
  prBody += '\n\n';
  prBody += ':vertical_traffic_light: **Automerge**: ';
  if (config.automerge) {
    const branchStatus = await platform.getBranchStatus(
      config.branchName,
      config.requiredStatusChecks
    );
    // istanbul ignore if
    if (branchStatus === 'failed') {
      prBody += 'Disabled due to failing status checks.';
    } else {
      prBody += 'Enabled.';
    }
  } else {
    prBody +=
      'Disabled by config. Please merge this manually once you are satisfied.';
  }
  prBody += '\n\n';
  prBody += ':recycle: **Rebasing**: ';
  if (config.rebaseStalePrs) {
    prBody +=
      'Renovate will keep this PR updated whenever it falls behind the base branch.';
  } else {
    prBody +=
      'Renovate will regenerate this PR any time it develops a merge conflict.';
  }
  prBody += '\n\n';
  if (config.recreateClosed) {
    prBody += `:ghost: **Immortal**: This PR will be recreated if closed unmerged. Get [config help](https://github.com/renovatebot/config-help/issues) if that's undesired.\n\n`;
  } else {
    prBody += `:no_bell: **Ignore**: Close this PR and you won't be reminded about ${
      config.upgrades.length === 1 ? 'this update' : 'these updates'
    } again.\n\n`;
  }
  // istanbul ignore if
  if (config.global) {
    if (config.global.prBanner) {
      prBody = config.global.prBanner + '\n\n' + prBody;
    }
    if (config.global.prFooter) {
      prBody = prBody + '\n---\n\n' + config.global.prFooter;
    }
  }
  prBody = prBody.trim();

  // Clean up double v's
  prBody = prBody.replace(/\bvv(\d)/g, 'v$1');

  // Generic replacements/link-breakers

  // Put a zero width space after every # followed by a digit
  prBody = prBody.replace(/#(\d)/gi, '#&#8203;$1');
  // Put a zero width space after every @ symbol to prevent unintended hyperlinking
  prBody = prBody.replace(/@/g, '@&#8203;');
  prBody = prBody.replace(/(`\[?@)&#8203;/g, '$1');
  prBody = prBody.replace(/([a-z]@)&#8203;/gi, '$1');
  prBody = prBody.replace(/([\s(])#(\d+)([)\s]?)/g, '$1#&#8203;$2$3');
  // convert escaped backticks back to `
  const backTickRe = /&#x60;([^/]*?)&#x60;/g;
  prBody = prBody.replace(backTickRe, '`$1`');
  prBody = prBody.replace(/`#&#8203;(\d+)`/g, '`#$1`');

  prBody = prBody.replace(/\n\n\n+/g, '\n\n');

  prBody = platform.getPrBody(prBody);
  return prBody;
}
