const handlebars = require('handlebars');
const releaseNotesHbs = require('./changelog/hbs-template');

module.exports = {
  getUpdateHeaders,
  getPrBody,
};

function getUpdateHeaders(config) {
  const updateHeaders = ['Package'];
  if (config.upgrades.some(upgrade => upgrade.depType)) {
    updateHeaders.push('Type');
  }
  updateHeaders.push('Update');
  updateHeaders.push('New value');
  if (
    config.upgrades.some(
      upgrade =>
        upgrade.homepage || upgrade.repositoryUrl || upgrade.changelogUrl
    )
  ) {
    updateHeaders.push('References');
  }
  return updateHeaders;
}

async function getPrBody(config) {
  let prBody = '';
  // istanbul ignore if
  if (config.prBanner && !config.isGroup) {
    prBody += handlebars.compile(config.prBanner)(config) + '\n\n';
  }
  prBody += '\n\nThis PR contains the following updates:\n\n';
  const updateHeaders = getUpdateHeaders(config);
  prBody += '| ' + updateHeaders.join(' | ') + ' |\n';
  prBody += '|' + updateHeaders.map(() => '--|').join('') + '\n';
  const seen = [];
  for (const upgrade of config.upgrades) {
    const {
      depName,
      depType,
      updateType,
      newValue,
      newDigestShort,
      homepage,
      repositoryUrl,
      changelogUrl,
    } = upgrade;
    const key = depName + depType + updateType + newValue;
    if (seen.includes(key)) {
      // don't have duplicate rows
      continue; // eslint-disable-line no-continue
    }
    seen.push(key);
    let references = [];
    if (homepage) {
      references.push(`[homepage](${homepage})`);
    }
    if (repositoryUrl) {
      references.push(`[source](${repositoryUrl})`);
    }
    if (changelogUrl) {
      references.push(`[changelog](${changelogUrl})`);
    }
    references = references.join(', ');
    let value = '';
    if (newDigestShort) {
      if (config.isPin) {
        value = config.newDigestShort;
      }
      if (newValue) {
        value = newValue + '@' + newDigestShort;
      } else {
        value = newDigestShort;
      }
    } else if (updateType !== 'lockFileMaintenance') {
      value = newValue;
    }
    const name =
      upgrade.updateType === 'lockFileMaintenance'
        ? 'all'
        : '`' + depName + '`';
    // prettier-ignore
    prBody += `| ${name} | ${updateHeaders.includes('Type') ? depType + ' |' : ''} ${updateType} | ${value} |`;
    if (updateHeaders.includes('References')) {
      prBody += references + ' |';
    }
    prBody += '\n';
  }
  prBody += '\n\n';

  if (config.upgrades.some(upgrade => upgrade.gitRef)) {
    prBody +=
      '\n\nNote: If you wish to disable git hash updates, add `":disableDigestUpdates"` to the extends array in your config.\n\n';
  }

  if (config.updateType === 'lockFileMaintenance') {
    prBody +=
      '\n\nThis Pull Request updates `package.json` lock files to use the latest dependency versions.\n\n';
  }

  if (config.isPin) {
    prBody +=
      "\n\n:pushpin: **Important**: Renovate will wait until you have merged this Pin PR before creating any *upgrade* PRs for the affected packages. Update your config if you don't wish to pin dependencies.\n\n";
  }
  if (config.hasReleaseNotes) {
    prBody +=
      '\n\n---\n\n' + handlebars.compile(releaseNotesHbs)(config) + '\n\n';
  }
  prBody += '\n\n---\n\n### Renovate configuration\n\n';
  prBody += ':calendar: **Schedule**: ';
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
    prBody += 'Enabled';
  } else {
    prBody += 'Disabled. Please merge this manually once you are satisfied.';
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
