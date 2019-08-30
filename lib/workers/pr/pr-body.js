import is from '@sindresorhus/is';
import { platform } from '../../platform';

const handlebars = require('handlebars');
const { logger } = require('../../logger');
const releaseNotesHbs = require('./changelog/hbs-template');
const { getPrConfigDescription } = require('./pr-body-config');

const versioning = require('../../versioning');

const { appName, appSlug } = require('../../config/app-strings');
const { emojify } = require('../../util/emoji');

handlebars.registerHelper('encodeURIComponent', encodeURIComponent);

export { getPrBody };

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
    const { homepage, sourceUrl, sourceDirectory, changelogUrl } = upgrade;
    let depNameLinked = upgrade.depName;
    const primaryLink = homepage || sourceUrl;
    if (primaryLink) {
      depNameLinked = `[${depNameLinked}](${primaryLink})`;
    }
    const otherLinks = [];
    if (homepage && sourceUrl) {
      otherLinks.push(`[source](${sourceUrl})`);
    }
    if (changelogUrl) {
      otherLinks.push(`[changelog](${changelogUrl})`);
    }
    if (otherLinks.length) {
      depNameLinked += ` (${otherLinks.join(', ')})`;
    }
    upgrade.depNameLinked = depNameLinked;
    const references = [];
    if (homepage) {
      references.push(`[homepage](${homepage})`);
    }
    if (sourceUrl) {
      let fullUrl = sourceUrl;
      if (sourceDirectory) {
        fullUrl =
          sourceUrl.replace(/\/?$/, '/') +
          'tree/HEAD/' +
          sourceDirectory.replace('^/?/', '');
      }
      references.push(`[source](${fullUrl})`);
    }
    if (changelogUrl) {
      references.push(`[changelog](${changelogUrl})`);
    }
    upgrade.references = references.join(', ');
    const { fromVersion, toVersion, updateType, versionScheme } = upgrade;
    // istanbul ignore if
    if (updateType === 'minor') {
      try {
        const version = versioning.get(versionScheme);
        if (version.getMinor(fromVersion) === version.getMinor(toVersion)) {
          upgrade.updateType = 'patch';
        }
      } catch (err) {
        // do nothing
      }
    }
    /* eslint-enable no-param-reassign */
  });
  const tableDefinitions = getTableDefinition(config);
  const tableValues = config.upgrades.map(upgrade => {
    const res = {};
    for (const column of tableDefinitions) {
      const { header, value } = column;
      try {
        // istanbul ignore else
        if (value) {
          res[header] = handlebars
            .compile(value)(upgrade)
            .replace(/^``$/, '');
        } else {
          res[header] = '';
        }
      } catch (err) /* istanbul ignore next */ {
        logger.warn({ header, value, err }, 'Handlebars compilation error');
      }
    }
    return res;
  });
  const tableColumns = getNonEmptyColumns(tableDefinitions, tableValues);
  let prBody = '';
  // istanbul ignore if
  if (config.prBanner && !config.isGroup) {
    prBody += handlebars.compile(config.prBanner)(config) + '\n\n';
  }
  prBody += '\n\nThis PR contains the following updates:\n\n';
  prBody += '| ' + tableColumns.join(' | ') + ' |\n';
  prBody += '|' + tableColumns.map(() => '---|').join('') + '\n';
  const rows = [];
  for (const row of tableValues) {
    let val = '|';
    for (const column of tableColumns) {
      val += ` ${row[column].replace(/^@/, '@&#8203;')} |`;
    }
    val += '\n';
    rows.push(val);
  }
  const uniqueRows = [...new Set(rows)];
  prBody += uniqueRows.join('');
  prBody += '\n\n';

  const notes = [];
  for (const upgrade of config.upgrades) {
    if (is.nonEmptyArray(upgrade.prBodyNotes)) {
      for (const note of upgrade.prBodyNotes) {
        try {
          const res = handlebars
            .compile(note)(upgrade)
            .trim();
          if (res && res.length) {
            notes.push(res);
          }
        } catch (err) {
          logger.warn({ note }, 'Error compiling upgrade note');
        }
      }
    }
  }
  const uniqueNotes = [...new Set(notes)];
  prBody += uniqueNotes.join('\n\n');
  prBody += '\n\n';

  if (config.upgrades.some(upgrade => upgrade.gitRef)) {
    prBody += emojify(
      ':abcd: If you wish to disable git hash updates, add `":disableDigestUpdates"` to the extends array in your config.\n\n',
      config
    );
  }

  if (config.updateType === 'lockFileMaintenance') {
    prBody += emojify(
      ':wrench: This Pull Request updates lock files to use the latest dependency versions.\n\n',
      config
    );
  }

  if (config.isPin) {
    prBody += emojify(
      `:pushpin: **Important**: ${appName} will wait until you have merged this Pin PR before creating any *upgrade* PRs for the affected packages. Add the preset \`:preserveSemverRanges\` your config if you instead don't wish to pin dependencies.\n\n`,
      config
    );
  }
  if (config.hasReleaseNotes) {
    let releaseNotes =
      '\n\n---\n\n' + handlebars.compile(releaseNotesHbs)(config) + '\n\n';
    releaseNotes = releaseNotes.replace(/### \[`vv/g, '### [`v');
    // Generic replacements/link-breakers

    // Put a zero width space after every # followed by a digit
    releaseNotes = releaseNotes.replace(/#(\d)/gi, '#&#8203;$1');
    // Put a zero width space after every @ symbol to prevent unintended hyperlinking
    releaseNotes = releaseNotes.replace(/@/g, '@&#8203;');
    releaseNotes = releaseNotes.replace(/(`\[?@)&#8203;/g, '$1');
    releaseNotes = releaseNotes.replace(/([a-z]@)&#8203;/gi, '$1');
    releaseNotes = releaseNotes.replace(/\/compare\/@&#8203;/g, '/compare/@');
    releaseNotes = releaseNotes.replace(
      /(\(https:\/\/[^)]*?)\.\.\.@&#8203;/g,
      '$1...@'
    );
    releaseNotes = releaseNotes.replace(
      /([\s(])#(\d+)([)\s]?)/g,
      '$1#&#8203;$2$3'
    );
    // convert escaped backticks back to `
    const backTickRe = /&#x60;([^/]*?)&#x60;/g;
    releaseNotes = releaseNotes.replace(backTickRe, '`$1`');
    releaseNotes = releaseNotes.replace(/`#&#8203;(\d+)`/g, '`#$1`');
    prBody += releaseNotes;
  }
  prBody += await getPrConfigDescription(config);
  prBody += `\n\n---\n\n - [ ] <!-- ${appSlug}-rebase -->If you want to rebase/retry this PR, check this box\n\n`;
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
  prBody = prBody.replace(/\n\n\n+/g, '\n\n');

  prBody = platform.getPrBody(prBody);
  return prBody;
}
